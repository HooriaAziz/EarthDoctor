// Shared, side-effect-free formatting helpers.

export function isNum(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function fmtNum(value, digits = 1) {
  if (!isNum(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(value) {
  if (!isNum(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

export function fmtCoord(latitude, longitude, digits = 2) {
  if (!isNum(latitude) || !isNum(longitude)) return "—";
  const lat = `${Math.abs(latitude).toFixed(digits)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(digits)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Absolute time in the viewer's zone, with zone label.
export function fmtDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function fmtUtc(value) {
  const date = toDate(value);
  if (!date) return "—";
  const iso = date.toISOString();
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}Z`;
}

export function fmtRelative(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((now - date.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const suffix = seconds >= 0 ? "ago" : "ahead";
  if (abs < 60) return seconds >= 0 ? "just now" : "in <1 min";
  if (abs < 3600) return `${Math.round(abs / 60)} min ${suffix}`;
  if (abs < 86400) return `${Math.round(abs / 3600)} h ${suffix}`;
  return `${Math.round(abs / 86400)} d ${suffix}`;
}

// Open-Meteo returns local wall-clock strings ("2026-11-15T14:00")
// when timezone=auto. Format them without re-interpreting the zone.
export function fmtLocalWallClock(value, { withDate = true } = {}) {
  if (typeof value !== "string" || value.length < 16) return "—";
  const [datePart, timePart] = value.split("T");
  const [, month, day] = datePart.split("-");
  const monthName = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][Number(month) - 1];
  const hhmm = timePart.slice(0, 5);
  return withDate ? `${monthName} ${Number(day)} ${hhmm}` : hhmm;
}

export function cardinal(degrees) {
  if (!isNum(degrees)) return "";
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

export function compactNumber(value, digits = 1) {
  if (!isNum(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(digits)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(abs >= 1e5 ? 0 : digits)}k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}
