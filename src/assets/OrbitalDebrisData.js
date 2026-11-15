export const ORBITAL_DEBRIS_SOURCE = {
  name: "European Space Agency (ESA)",
  title: "Space Environment Statistics",
  url: "https://sdup.esoc.esa.int/discosweb/statistics/",
  lastUpdated: "13 November 2026",
  dataType: "Published statistical snapshot",
};

export const ORBITAL_DEBRIS_OVERVIEW = {
  // All catalogued objects, not debris alone.
  cataloguedObjects: 47272,

  // Model estimates: the >10 cm estimate includes active payloads.
  estimatedObjectsGreaterThan10cm: 68450,
  activePayloadsIncludedInEstimate: 11300,

  // Model estimates specifically for debris.
  estimatedDebris1To10cm: 1500000,
  estimatedDebris1mmTo1cm: 230000000,

  // ESA reports more than this amount.
  totalMassLowerBoundTonnes: 17600,
  fragmentationEventsLowerBound: 660,
};

// All catalogued objects by orbital regime, including active satellites,
// rocket bodies, and debris.
export const ORBITAL_REGIME_DATA = [
  { orbit: "LEO", label: "Low Earth Orbit", objects: 28018 },
  { orbit: "GEO", label: "Geostationary Orbit", objects: 939 },
  { orbit: "EGO", label: "Extended Geostationary Orbit", objects: 5121 },
  { orbit: "GTO", label: "Geostationary Transfer Orbit", objects: 1292 },
  { orbit: "NSO", label: "Navigation Satellite Orbit", objects: 465 },
  { orbit: "MEO", label: "Medium Earth Orbit", objects: 1292 },
  { orbit: "LMO", label: "LEO-MEO Crossing Orbit", objects: 2308 },
  { orbit: "MGO", label: "MEO-GEO Crossing Orbit", objects: 5400 },
  { orbit: "HEO", label: "Highly Eccentric Earth Orbit", objects: 2161 },
  { orbit: "Other", label: "Other orbital regimes", objects: 276 },
];

// ESA catalogue classification totals. These categories describe object
// types, not just debris.
export const ORBITAL_OBJECT_TYPES = [
  { code: "PL", label: "Payloads", objects: 19761 },
  { code: "PF", label: "Payload fragmentation debris", objects: 5730 },
  { code: "PD", label: "Payload debris", objects: 210 },
  { code: "PM", label: "Payload mission-related objects", objects: 388 },
  { code: "RB", label: "Rocket bodies", objects: 2109 },
  { code: "RF", label: "Rocket fragmentation debris", objects: 7355 },
  { code: "RD", label: "Rocket debris", objects: 66 },
  { code: "RM", label: "Rocket mission-related objects", objects: 778 },
  { code: "UI", label: "Unidentified objects", objects: 10875 },
];

// Historical end-of-year counts for the CelesTrak SATCAT "Debris" class.
// These are not total orbital-object counts. The series was reconstructed
// from catalogue launch and decay dates and is kept through the last complete
// calendar year in the source snapshot (2025); the partial/future 2026 point
// is intentionally excluded.
const debrisCounts1957To2025 = [
  0, 2, 7, 21, 361, 382, 596, 700, 1748, 1948,
  1976, 2294, 2534, 3080, 3256, 3439, 3664, 3909, 4468, 4914,
  5206, 5335, 5519, 5531, 5960, 8033, 8268, 8280, 8440, 9149,
  9547, 9302, 9100, 9075, 9224, 9498, 11332, 12303, 12562, 12460,
  12895, 12844, 16595, 16830, 16976, 16813, 16660, 16604, 16520,
  17307, 17346, 16900, 16846, 16748, 16794, 16676, 16460, 16185,
  15903, 15846, 15795, 16118, 16165, 16028, 15823, 14772, 13600,
  13348, 12708,
];

export const ORBITAL_DEBRIS_HISTORICAL_SERIES = debrisCounts1957To2025.map(
  (objects, index) => ({
    year: 1957 + index,
    value: objects,
  })
);

export const ORBITAL_DEBRIS_HISTORICAL_SOURCE = {
  name: "CelesTrak SATCAT, via Wedgetail historical reconstruction",
  url: "https://wedgetail.cc/chart/orbital-population",
  dataUrl: "https://wedgetail.cc/data/celestrak-satcat.json",
  retrieved: "14 September 2026",
  note:
    "Annual counts reconstructed from catalogue launch and decay dates. The Debris class excludes payloads and rocket bodies; objects too small to be catalogued are not represented.",
};
