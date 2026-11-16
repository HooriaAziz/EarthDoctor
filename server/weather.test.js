import assert from "node:assert/strict";
import { test } from "node:test";
import { weatherResponse } from "./weather.js";

const params = new URLSearchParams({ latitude: "41.88", longitude: "-87.63" });
const weather = {
  current: { time: "2026-11-15T23:30", temperature_2m: 12 },
  current_units: { temperature_2m: "°C" },
  hourly: { time: ["2026-11-16T00:00"], temperature_2m: [11] },
};

test("fallback uses only the fixed forecast endpoint and preserves the response", async () => {
  const input = new URLSearchParams(params);
  input.set("url", "http://127.0.0.1/private");
  input.set("apikey", "ignored");
  const result = await weatherResponse(input, {
    fetchImpl: async (url, options) => {
      assert.equal(url.origin, "https://api.open-meteo.com");
      assert.equal(url.pathname, "/v1/forecast");
      assert.equal(url.searchParams.get("latitude"), "41.88");
      assert.equal(url.searchParams.get("longitude"), "-87.63");
      assert.match(url.searchParams.get("current"), /temperature_2m/);
      assert.ok(url.searchParams.get("hourly"));
      assert.equal(url.searchParams.has("apikey"), false);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal);
      return Response.json(weather);
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, weather);
});

test("invalid or missing coordinates are rejected before any upstream request", async () => {
  for (const query of ["", "latitude=&longitude=0", "latitude=0&longitude=", "latitude=91&longitude=0", "latitude=0&longitude=-181", "latitude=NaN&longitude=0", "latitude=0&longitude=Infinity", "latitude=1,2&longitude=0"]) {
    const result = await weatherResponse(new URLSearchParams(query), {
      fetchImpl: () => assert.fail("Invalid coordinates must not be fetched"),
    });
    assert.equal(result.status, 400, query);
  }
});

test("upstream HTTP failures preserve diagnostic status and rate limits", async () => {
  for (const status of [400, 429, 503]) {
    const result = await weatherResponse(params, { fetchImpl: async () => new Response(null, { status }) });
    assert.equal(result.status, status === 429 ? 429 : 502);
    assert.equal(result.body.upstreamStatus, status);
    assert.match(result.body.reason, new RegExp(`HTTP ${status}`));
  }
});

test("timeouts and network failures are distinct and do not expose internal errors", async () => {
  for (const [error, status, code] of [
    [new DOMException("internal timeout detail", "TimeoutError"), 504, "weather-upstream-timeout"],
    [new TypeError("internal connection detail"), 502, "weather-upstream-unreachable"],
  ]) {
    const result = await weatherResponse(params, { fetchImpl: async () => { throw error; } });
    assert.equal(result.status, status);
    assert.equal(result.body.error, code);
    assert.doesNotMatch(JSON.stringify(result.body), /internal/);
  }
});

test("malformed or incomplete upstream data is not returned as successful weather", async () => {
  for (const response of [Response.json({}), Response.json({ error: true }), new Response("not json")]) {
    const result = await weatherResponse(params, { fetchImpl: async () => response });
    assert.equal(result.status, 502);
    assert.equal(result.body.error, "invalid-weather-response");
  }
});
