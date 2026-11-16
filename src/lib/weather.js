// Reference tables used to interpret Open-Meteo and CAMS values.

// WMO weather interpretation codes (as documented by Open-Meteo).
const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function describeWeatherCode(code) {
  if (typeof code !== "number") return null;
  return WMO_CODES[code] ?? `WMO code ${code}`;
}

// US EPA AQI categories.
const AQI_BANDS = [
  { max: 50, label: "Good", tone: "good" },
  { max: 100, label: "Moderate", tone: "moderate" },
  { max: 150, label: "Unhealthy for sensitive groups", short: "USG", tone: "elevated" },
  { max: 200, label: "Unhealthy", tone: "critical" },
  { max: 300, label: "Very unhealthy", tone: "critical" },
  { max: Infinity, label: "Hazardous", tone: "critical" },
];

export function aqiCategory(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return AQI_BANDS.find((band) => value <= band.max);
}

export const AQI_SCALE_MAX = 300;
