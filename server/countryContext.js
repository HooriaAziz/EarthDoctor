// Builds the factual context sent to the model for each country, using only
// the bundled EDGAR 2026 inventory (plus an optional live NOAA CO₂ value).
import { createHash } from "node:crypto";
import { EDGAR_COUNTRIES, EDGAR_YEARS } from "../src/assets/edgarData.js";
import { EDGAR_GLOBAL } from "../src/assets/edgarGlobalData.js";

const I1990 = EDGAR_YEARS.indexOf(1990);
const I2020 = EDGAR_YEARS.indexOf(2020);
const LAST = EDGAR_YEARS.at(-1);

const round = (value, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? round(((a - b) / b) * 100, 1) : null);

const ranked = [...EDGAR_COUNTRIES]
  .filter((c) => Number.isFinite(c.annualEmissionsMtCO2e.at(-1)))
  .sort((a, b) => b.annualEmissionsMtCO2e.at(-1) - a.annualEmissionsMtCO2e.at(-1));
const rankByCode = new Map(ranked.map((c, i) => [c.code, i + 1]));

export function listCountries() {
  return EDGAR_COUNTRIES.map((c) => ({ code: c.code, name: c.name }));
}

export function countryContext(code) {
  const c = EDGAR_COUNTRIES.find((item) => item.code === code);
  if (!c) return null;
  const series = c.annualEmissionsMtCO2e;
  const latest = series.at(-1);
  const sectors = (c.sectors2025 || [])
    .filter((s) => Number.isFinite(s.emissionsMtCO2e) && s.emissionsMtCO2e > 0)
    .sort((a, b) => b.emissionsMtCO2e - a.emissionsMtCO2e);
  const sectorTotal = sectors.reduce((sum, s) => sum + s.emissionsMtCO2e, 0);

  return {
    code: c.code,
    name: c.name,
    year: LAST,
    totalMtCO2e: round(latest, 2),
    rankOf: { rank: rankByCode.get(c.code) ?? null, of: ranked.length },
    perCapitaT: round(c.perCapitaTCO2e, 2),
    worldPerCapitaT: round(EDGAR_GLOBAL.perCapitaT.at(-1), 2),
    perGdpTPerKUsd: round(c.perGDPtCO2ePerKUSD, 3),
    changeSince1990Pct: pct(latest, series[I1990]),
    changeSince2020Pct: pct(latest, series[I2020]),
    topSectors: sectors.slice(0, 4).map((s) => ({
      sector: s.name,
      mtCO2e: round(s.emissionsMtCO2e, 2),
      sharePct: sectorTotal > 0 ? round((s.emissionsMtCO2e / sectorTotal) * 100, 1) : null,
    })),
  };
}

// Hash of the inputs, so results can be reused when nothing changed.
export function contextHash(context, extra = {}) {
  return createHash("sha256").update(JSON.stringify({ context, extra })).digest("hex").slice(0, 16);
}

// One cheap request per run: latest NOAA Mauna Loa monthly CO₂.
export async function fetchLatestCo2() {
  try {
    const response = await fetch("https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt", {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const rows = (await response.text())
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter((cols) => cols[3] > 0);
    const last = rows.at(-1);
    return last ? { year: last[0], month: last[1], ppm: last[3], source: "NOAA GML Mauna Loa" } : null;
  } catch {
    return null;
  }
}
