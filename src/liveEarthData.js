const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100";
const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

async function fetchJson(url, sourceName, signal, headers = {}) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json", ...headers },
  });

  if (!response.ok) {
    throw new Error(`${sourceName} returned HTTP ${response.status}`);
  }

  return response.json();
}

function firstCoordinatePair(value) {
  if (!Array.isArray(value)) return null;

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [value[0], value[1]];
  }

  for (const child of value) {
    const pair = firstCoordinatePair(child);
    if (pair) return pair;
  }

  return null;
}

function normalizeEonetEvent(event) {
  const latestGeometry = Array.isArray(event.geometry)
    ? event.geometry[event.geometry.length - 1]
    : null;
  const coordinates = firstCoordinatePair(latestGeometry?.coordinates);
  const category =
    event.categories?.map((item) => item.title).filter(Boolean).join(", ") ||
    "Natural event";

  return {
    id: `eonet-${event.id}`,
    source: "NASA EONET",
    category,
    title: event.title || "Unnamed natural event",
    place: category,
    observedAt: latestGeometry?.date || null,
    latitude: coordinates ? coordinates[1] : null,
    longitude: coordinates ? coordinates[0] : null,
    url: event.link || "https://eonet.gsfc.nasa.gov/",
    description: event.description || "Open event listed by NASA EONET.",
    magnitude: null,
  };
}

function normalizeUsgsFeature(feature) {
  const properties = feature.properties || {};
  const coordinates = feature.geometry?.coordinates || [];

  return {
    id: `usgs-${feature.id}`,
    source: "USGS",
    category: "Earthquake",
    title: `Magnitude ${Number.isFinite(properties.mag) ? properties.mag.toFixed(1) : "unknown"}`,
    place: properties.place || "Location not provided",
    observedAt: Number.isFinite(properties.time)
      ? new Date(properties.time).toISOString()
      : null,
    latitude: Number.isFinite(coordinates[1]) ? coordinates[1] : null,
    longitude: Number.isFinite(coordinates[0]) ? coordinates[0] : null,
    depthKm: Number.isFinite(coordinates[2]) ? coordinates[2] : null,
    magnitude: Number.isFinite(properties.mag) ? properties.mag : null,
    url: properties.url || "https://earthquake.usgs.gov/earthquakes/",
    description: properties.type || "Earthquake event",
  };
}

export async function fetchLiveEarthData(signal) {
  const [eonetResult, usgsResult] = await Promise.allSettled([
    fetchJson(EONET_URL, "NASA EONET", signal),
    fetchJson(USGS_URL, "USGS earthquake feed", signal),
  ]);

  if (signal?.aborted) {
    throw new DOMException("The request was aborted.", "AbortError");
  }

  const events = [];
  const sourceErrors = [];
  const sourceStatus = { eonet: "unavailable", usgs: "unavailable" };

  if (eonetResult.status === "fulfilled") {
    const eonetEvents = Array.isArray(eonetResult.value.events)
      ? eonetResult.value.events
      : [];
    events.push(...eonetEvents.map(normalizeEonetEvent));
    sourceStatus.eonet = "connected";
  } else {
    sourceErrors.push(`NASA EONET: ${eonetResult.reason?.message || "Request failed"}`);
  }

  if (usgsResult.status === "fulfilled") {
    const features = Array.isArray(usgsResult.value.features)
      ? usgsResult.value.features
      : [];
    events.push(...features.map(normalizeUsgsFeature));
    sourceStatus.usgs = "connected";
  } else {
    sourceErrors.push(`USGS: ${usgsResult.reason?.message || "Request failed"}`);
  }

  events.sort((a, b) => {
    const timeA = a.observedAt ? new Date(a.observedAt).getTime() : 0;
    const timeB = b.observedAt ? new Date(b.observedAt).getTime() : 0;
    return timeB - timeA;
  });

  return {
    events,
    sourceStatus,
    sourceErrors,
    fetchedAt: new Date().toISOString(),
  };
}

function isInsideLower48Bounds(latitude, longitude) {
  return (
    latitude >= 24.2 &&
    latitude <= 49.6 &&
    longitude >= -125.0 &&
    longitude <= -66.5
  );
}

export async function fetchSelectedLocationData({ latitude, longitude, signal }) {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timezone: "auto",
  }).toString();

  const airQualityUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airQualityUrl.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide",
    timezone: "auto",
    forecast_days: "1",
  }).toString();

  const inNwsBounds = isInsideLower48Bounds(latitude, longitude);
  const nwsUrl = new URL("https://api.weather.gov/alerts/active");
  nwsUrl.search = new URLSearchParams({
    point: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
  }).toString();

  const requests = [
    fetchJson(weatherUrl.toString(), "Open-Meteo weather", signal),
    fetchJson(airQualityUrl.toString(), "Open-Meteo air quality", signal),
  ];

  if (inNwsBounds) {
    requests.push(
      fetchJson(nwsUrl.toString(), "National Weather Service alerts", signal, {
        Accept: "application/geo+json, application/json",
      })
    );
  }

  const results = await Promise.allSettled(requests);

  if (signal?.aborted) {
    throw new DOMException("The request was aborted.", "AbortError");
  }

  const weatherResult = results[0];
  const airResult = results[1];
  const nwsResult = inNwsBounds ? results[2] : null;
  const errors = [];

  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const airQuality = airResult.status === "fulfilled" ? airResult.value : null;

  if (!weather) {
    errors.push(`Weather: ${weatherResult.reason?.message || "Unavailable"}`);
  }
  if (!airQuality) {
    errors.push(`Air quality: ${airResult.reason?.message || "Unavailable"}`);
  }

  let alerts = [];
  let alertsStatus = "not-covered";

  if (nwsResult) {
    if (nwsResult.status === "fulfilled") {
      alertsStatus = "connected";
      alerts = (nwsResult.value.features || []).map((feature) => {
        const properties = feature.properties || {};
        return {
          id: feature.id || `${properties.event}-${properties.effective}`,
          event: properties.event || "Weather alert",
          headline: properties.headline || properties.event || "Active weather alert",
          severity: properties.severity || "Unknown",
          certainty: properties.certainty || "Unknown",
          effective: properties.effective || properties.onset || null,
          expires: properties.expires || null,
          url: properties.web || "https://www.weather.gov/alerts",
        };
      });
    } else {
      alertsStatus = "unavailable";
      errors.push(
        `NWS alerts: ${nwsResult.reason?.message || "Request failed"}`
      );
    }
  }

  return {
    weather,
    airQuality,
    alerts,
    sourceStatus: {
      weather: weather ? "connected" : "unavailable",
      airQuality: airQuality ? "connected" : "unavailable",
      nws: alertsStatus,
    },
    errors,
    fetchedAt: new Date().toISOString(),
  };
}
