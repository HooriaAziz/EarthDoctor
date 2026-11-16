import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchSelectedLocationData } from "./liveEarthData.js";

const weather = {
  current: { time: "2026-11-15T23:30", temperature_2m: 12 },
  current_units: { temperature_2m: "°C" },
  hourly: { time: ["2026-11-16T00:00"], temperature_2m: [11] },
};
const air = { current: { time: "2026-11-15T23:00", us_aqi: 22 } };
const point = { latitude: 41.88, longitude: -87.63 };

function mockFeeds(t, weatherFetch) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(String(url));
    if (String(url).includes("air-quality-api")) return Response.json(air);
    if (String(url).includes("api.weather.gov")) return Response.json({ features: [] });
    return weatherFetch(String(url), options);
  });
  return calls;
}

test("successful direct weather requests preserve units and hourly data without fallback", async (t) => {
  const calls = mockFeeds(t, async () => Response.json(weather));
  const result = await fetchSelectedLocationData(point);
  assert.deepEqual(result.weather, weather);
  assert.equal(result.sourceStatus.weather, "connected");
  assert.equal(calls.some((url) => url.startsWith("/api/weather")), false);
  assert.deepEqual(result.errors, []);
});

for (const failure of [new TypeError("Failed to fetch"), new DOMException("Timed out", "TimeoutError")]) {
  test(`weather recovers through the server after ${failure.name}`, async (t) => {
    const calls = mockFeeds(t, async (url, options) => {
      assert.ok(options.signal);
      if (url.startsWith("https://api.open-meteo.com")) throw failure;
      const parsed = new URL(url, "http://localhost");
      assert.equal(parsed.pathname, "/api/weather");
      assert.equal(parsed.searchParams.get("latitude"), String(point.latitude));
      assert.equal(parsed.searchParams.get("longitude"), String(point.longitude));
      return Response.json(weather);
    });
    const result = await fetchSelectedLocationData(point);
    assert.deepEqual(result.weather, weather);
    assert.deepEqual(result.airQuality, air);
    assert.deepEqual(result.errors, []);
    assert.equal(calls.filter((url) => url.startsWith("/api/weather")).length, 1);
  });
}

test("HTTP rate limits are reported without retrying through the server", async (t) => {
  const calls = mockFeeds(t, async () => Response.json({ reason: "Rate limit exceeded" }, { status: 429 }));
  const result = await fetchSelectedLocationData(point);
  assert.equal(result.weather, null);
  assert.deepEqual(result.airQuality, air);
  assert.match(result.errors[0], /HTTP 429: Rate limit exceeded/);
  assert.equal(calls.some((url) => url.startsWith("/api/weather")), false);
});

test("fallback failure retains air quality and identifies the upstream HTTP error", async (t) => {
  mockFeeds(t, async (url) => {
    if (url.startsWith("https:")) throw new TypeError("Failed to fetch");
    return Response.json({ reason: "Open-Meteo returned HTTP 503" }, { status: 502 });
  });
  const result = await fetchSelectedLocationData(point);
  assert.equal(result.weather, null);
  assert.deepEqual(result.airQuality, air);
  assert.equal(result.sourceStatus.weather, "unavailable");
  assert.equal(result.sourceStatus.airQuality, "connected");
  assert.match(result.errors[0], /Direct weather request failed; Weather fallback returned HTTP 502: Open-Meteo returned HTTP 503/);
});

test("a missing fallback API is reported as HTTP 404, not a provider outage", async (t) => {
  mockFeeds(t, async (url) => {
    if (url.startsWith("https:")) throw new TypeError("Failed to fetch");
    return Response.json({ error: "not-found" }, { status: 404 });
  });
  const result = await fetchSelectedLocationData(point);
  assert.match(result.errors[0], /Weather fallback returned HTTP 404/);
});

test("cancelling a location request does not start a fallback", async (t) => {
  const controller = new AbortController();
  const calls = mockFeeds(t, async () => {
    controller.abort();
    throw controller.signal.reason;
  });
  await assert.rejects(fetchSelectedLocationData({ ...point, signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls.some((url) => url.startsWith("/api/weather")), false);
});
