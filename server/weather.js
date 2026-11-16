import { weatherUrl } from "../src/lib/weatherRequest.js";

export async function weatherResponse(params, { fetchImpl = fetch } = {}) {
  const lat = params.get("latitude");
  const lon = params.get("longitude");
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    !lat?.trim() || !lon?.trim() ||
    !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) {
    return { status: 400, body: { error: "invalid-coordinates" } };
  }

  try {
    // Never accept an upstream URL or arbitrary request options from the client.
    const response = await fetchImpl(weatherUrl(latitude, longitude), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
    if (!response.ok) {
      return {
        status: response.status === 429 ? 429 : 502,
        body: {
          error: "weather-upstream-error",
          upstreamStatus: response.status,
          reason: `Open-Meteo returned HTTP ${response.status}`,
        },
      };
    }
    const body = await response.json().catch(() => null);
    if (!body?.current || !body.current.time || body.error) {
      return { status: 502, body: { error: "invalid-weather-response", reason: "Open-Meteo returned invalid weather data" } };
    }
    return { status: 200, body };
  } catch (error) {
    const timedOut = error.name === "TimeoutError";
    return {
      status: timedOut ? 504 : 502,
      body: {
        error: timedOut ? "weather-upstream-timeout" : "weather-upstream-unreachable",
        reason: timedOut ? "The server's Open-Meteo request timed out" : "The server could not retrieve weather from Open-Meteo",
      },
    };
  }
}
