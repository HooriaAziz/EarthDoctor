// Shared by the browser request and the fixed-destination server fallback.
export function weatherUrl(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,weather_code",
    // Past model analysis and the next two calendar days of hourly data.
    hourly: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
    past_days: "1",
    forecast_days: "2",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timezone: "auto",
  }).toString();
  return url;
}
