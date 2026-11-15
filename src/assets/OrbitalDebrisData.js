
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

  // ESA reports more than 660 fragmentation events.
  fragmentationEventsLowerBound: 660,
};

// These are all catalogued objects by orbital regime,
// including active satellites, rocket bodies, and debris.
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

// ESA's catalogue classification totals.
// These categories describe object types, not just debris.
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
