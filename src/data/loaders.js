// Loaders for trend datasets. Each returns values exactly as published by
// the source, plus clearly-labelled derived aggregates (daily means, annual
// means, year-on-year growth) computed only from those values.

import { normalizeUsgsFeature } from "../liveEarthData";

async function getText(url, signal, name) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  return response.text();
}

async function getJson(url, signal, name) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  return response.json();
}

function valid(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values) {
  const v = values.filter(valid);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function max(values) {
  const v = values.filter(valid);
  return v.length ? Math.max(...v) : null;
}

function sum(values) {
  const v = values.filter(valid);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}

// ------------------------------------------------------------------ NOAA NCEI

export const NCEI_PAGE = "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series";

// NCEI rejects end years in the future, so request through the current year.
function nceiUrl() {
  const year = new Date().getUTCFullYear();
  return `https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/tavg/land_ocean/12/12/1850-${year}/data.json`;
}

export async function loadGlobalTemperature(signal) {
  const json = await getJson(nceiUrl(), signal, "NOAA NCEI");
  const points = Object.entries(json.data || {})
    .map(([year, row]) => ({ year: Number(year), value: Number(row?.departure ?? row?.anomaly ?? row) }))
    .filter((p) => Number.isInteger(p.year) && valid(p.value))
    .sort((a, b) => a.year - b.year);
  return {
    points,
    basePeriod: json.description?.base_period || "1901-2000",
    units: json.description?.units || "Degrees Celsius",
  };
}

// ------------------------------------------------------------------ NOAA GML

export const GML_SERIES = {
  co2_mlo: {
    url: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt",
    label: "CO₂ · Mauna Loa",
    unit: "ppm",
    avgCol: 3,
    trendCol: 4,
    page: "https://gml.noaa.gov/ccgg/trends/",
  },
  co2_gl: {
    url: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.txt",
    label: "CO₂ · global marine surface",
    unit: "ppm",
    avgCol: 3,
    trendCol: 5,
    page: "https://gml.noaa.gov/ccgg/trends/global.html",
  },
  ch4_gl: {
    url: "https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt",
    label: "CH₄ · global",
    unit: "ppb",
    avgCol: 3,
    trendCol: 5,
    page: "https://gml.noaa.gov/ccgg/trends_ch4/",
  },
  n2o_gl: {
    url: "https://gml.noaa.gov/webdata/ccgg/trends/n2o/n2o_mm_gl.txt",
    label: "N₂O · global",
    unit: "ppb",
    avgCol: 3,
    trendCol: 5,
    page: "https://gml.noaa.gov/ccgg/trends_n2o/",
  },
};

export async function loadGml(id, signal) {
  const meta = GML_SERIES[id];
  const text = await getText(meta.url, signal, "NOAA GML");
  const rows = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const cols = line.trim().split(/\s+/).map(Number);
    const year = cols[0];
    const month = cols[1];
    const avg = cols[meta.avgCol];
    const trend = cols[meta.trendCol];
    if (!Number.isInteger(year) || !Number.isInteger(month)) continue;
    rows.push({
      year,
      month,
      t: cols[2],
      avg: valid(avg) && avg > 0 ? avg : null,
      trend: valid(trend) && trend > 0 ? trend : null,
    });
  }

  // Annual means for complete calendar years only, and their growth.
  const byYear = new Map();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year).push(row.avg);
  }
  const annual = [...byYear.entries()]
    .filter(([, values]) => values.filter(valid).length === 12)
    .map(([year, values]) => ({ year, value: mean(values) }));
  const growth = annual.slice(1).map((row, i) =>
    row.year === annual[i].year + 1 ? { year: row.year, value: row.value - annual[i].value } : null
  ).filter(Boolean);

  const latest = [...rows].reverse().find((row) => valid(row.avg)) || null;
  return { ...meta, rows, annual, growth, latest };
}

// ------------------------------------------------------------------ USGS month

export const USGS_MONTH_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson";

export async function loadUsgsMonth(signal) {
  const json = await getJson(USGS_MONTH_URL, signal, "USGS");
  const events = (json.features || []).map(normalizeUsgsFeature);
  return { events, generated: json.metadata?.generated ?? null, title: json.metadata?.title };
}

// ------------------------------------------------------------------ NOAA SWPC

export const SWPC_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
export const SWPC_CYCLE_URL = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json";
export const SWPC_PREDICTED_URL = "https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json";

export async function loadKp(signal) {
  const json = await getJson(SWPC_KP_URL, signal, "NOAA SWPC");
  let rows = [];
  if (Array.isArray(json) && Array.isArray(json[0])) {
    // Legacy format: header row followed by arrays.
    const header = json[0];
    const ti = header.indexOf("time_tag");
    const ki = header.indexOf("Kp");
    rows = json.slice(1).map((r) => ({ time: r[ti], kp: Number(r[ki]) }));
  } else if (Array.isArray(json)) {
    rows = json.map((r) => ({ time: r.time_tag, kp: Number(r.Kp ?? r.kp_index) }));
  }
  return rows
    .filter((r) => r.time && valid(r.kp))
    .map((r) => ({ ...r, ms: Date.parse(`${r.time}Z`) }));
}

export async function loadSolarCycle(signal) {
  const [observed, predicted] = await Promise.all([
    getJson(SWPC_CYCLE_URL, signal, "NOAA SWPC"),
    getJson(SWPC_PREDICTED_URL, signal, "NOAA SWPC").catch(() => []),
  ]);
  const pick = (v) => (valid(v) && v >= 0 ? v : null);
  const toYear = (tag) => {
    const [y, m] = String(tag).split("-").map(Number);
    return y + (m - 0.5) / 12;
  };
  return {
    observed: observed.map((r) => ({
      tag: r["time-tag"],
      t: toYear(r["time-tag"]),
      ssn: pick(r.ssn),
      smoothed: pick(r.smoothed_ssn),
      f107: pick(r["f10.7"]),
    })),
    predicted: predicted.map((r) => ({
      tag: r["time-tag"],
      t: toYear(r["time-tag"]),
      ssn: pick(r.predicted_ssn),
      low: pick(r.low_ssn),
      high: pick(r.high_ssn),
      f107: pick(r["predicted_f10.7"]),
    })),
  };
}

// ------------------------------------------------------------------ Open-Meteo

function groupDaily(times, values, reducer) {
  const days = new Map();
  times.forEach((t, i) => {
    const day = t.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(values?.[i]);
  });
  return [...days.entries()].map(([day, list]) => ({ day, value: reducer(list), n: list.filter(valid).length }));
}

export const AIR_POLLUTANTS = [
  { key: "us_aqi", label: "US AQI", unit: "", reducer: "max", digits: 0 },
  { key: "pm2_5", label: "PM2.5", unit: "μg/m³", reducer: "mean", digits: 1, who24h: 15 },
  { key: "pm10", label: "PM10", unit: "μg/m³", reducer: "mean", digits: 1, who24h: 45 },
  { key: "nitrogen_dioxide", label: "NO₂", unit: "μg/m³", reducer: "mean", digits: 1, who24h: 25 },
  { key: "ozone", label: "O₃ (daily max 1 h)", unit: "μg/m³", reducer: "max", digits: 0 },
  { key: "sulphur_dioxide", label: "SO₂", unit: "μg/m³", reducer: "mean", digits: 1, who24h: 40 },
  { key: "carbon_monoxide", label: "CO", unit: "μg/m³", reducer: "mean", digits: 0, who24h: 4000 },
  { key: "dust", label: "Dust", unit: "μg/m³", reducer: "mean", digits: 1 },
  { key: "uv_index", label: "UV index (daily max)", unit: "", reducer: "max", digits: 1 },
];

export async function loadAirHistory(latitude, longitude, signal) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: AIR_POLLUTANTS.map((p) => p.key).join(","),
    past_days: "92",
    forecast_days: "1",
    timezone: "auto",
  }).toString();
  const json = await getJson(url.toString(), signal, "Open-Meteo air quality");
  const times = json.hourly?.time || [];

  const daily = {};
  for (const p of AIR_POLLUTANTS) {
    const reducer = p.reducer === "max" ? max : mean;
    // Keep only days with at least 18 hourly values so partial days
    // (the current day, model gaps) do not distort daily statistics.
    daily[p.key] = groupDaily(times, json.hourly?.[p.key], reducer).map((d) => ({
      ...d,
      value: d.n >= 18 ? d.value : null,
    }));
  }

  return {
    days: (daily.us_aqi || []).map((d) => d.day),
    daily,
    timezone: json.timezone,
    tz: json.timezone_abbreviation,
    units: json.hourly_units || {},
  };
}

export async function loadDailyWeather(latitude, longitude, signal) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,uv_index_max",
    past_days: "92",
    forecast_days: "16",
    timezone: "auto",
  }).toString();
  const json = await getJson(url.toString(), signal, "Open-Meteo forecast");
  // "Today" in the point's own time zone, so forecast shading is correct.
  const offsetMs = (json.utc_offset_seconds || 0) * 1000;
  const today = new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
  return { daily: json.daily || {}, units: json.daily_units || {}, timezone: json.timezone, tz: json.timezone_abbreviation, today };
}

export async function loadClimateRecord(latitude, longitude, signal) {
  const lastYear = new Date().getUTCFullYear() - 1;
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: "1950-01-01",
    end_date: `${lastYear}-12-31`,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "auto",
  }).toString();
  const json = await getJson(url.toString(), signal, "Open-Meteo archive (ERA5)");
  const times = json.daily?.time || [];
  const temp = json.daily?.temperature_2m_mean || [];
  const precip = json.daily?.precipitation_sum || [];

  const years = new Map();
  times.forEach((t, i) => {
    const year = Number(t.slice(0, 4));
    if (!years.has(year)) years.set(year, { temp: [], precip: [] });
    years.get(year).temp.push(temp[i]);
    years.get(year).precip.push(precip[i]);
  });

  // Annual aggregates only for years with ≥ 360 valid daily values.
  const annual = [...years.entries()]
    .map(([year, v]) => ({
      year,
      temp: v.temp.filter(valid).length >= 360 ? mean(v.temp) : null,
      precip: v.precip.filter(valid).length >= 360 ? sum(v.precip) : null,
    }))
    .sort((a, b) => a.year - b.year);

  return {
    annual,
    elevation: json.elevation,
    gridLatitude: json.latitude,
    gridLongitude: json.longitude,
    lastYear,
  };
}
