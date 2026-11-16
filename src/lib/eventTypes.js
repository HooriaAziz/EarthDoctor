// One classification of natural-event categories, shared by the globe
// markers, the layer controls, the event explorer and the summaries.
// Every group has both a colour and a distinct marker shape so that
// type is never communicated by colour alone.

export const EVENT_GROUPS = [
  { id: "wildfire", label: "Wildfires", short: "Fire", color: "#E54858", shape: "triangle" },
  { id: "volcano", label: "Volcanoes", short: "Volcano", color: "#F0884B", shape: "diamond" },
  { id: "earthquake", label: "Earthquakes", short: "Quake", color: "#E8B341", shape: "circle" },
  { id: "storm", label: "Storms & floods", short: "Storm", color: "#398CF0", shape: "square" },
  { id: "ice", label: "Ice & snow", short: "Ice", color: "#7CC8E8", shape: "hex" },
  { id: "other", label: "Other events", short: "Other", color: "#8D9DB0", shape: "ring" },
];

export const EVENT_GROUP_BY_ID = Object.fromEntries(
  EVENT_GROUPS.map((group) => [group.id, group])
);

export function classifyEvent(event) {
  const category = String(event?.category || "").toLowerCase();
  if (category.includes("earthquake")) return "earthquake";
  if (category.includes("volcano")) return "volcano";
  if (category.includes("fire")) return "wildfire";
  if (
    category.includes("storm") ||
    category.includes("flood") ||
    category.includes("hurricane") ||
    category.includes("typhoon") ||
    category.includes("cyclone") ||
    category.includes("tornado")
  ) {
    return "storm";
  }
  if (category.includes("ice") || category.includes("snow")) return "ice";
  return "other";
}

// SVG path data in a 16×16 box.
const SHAPE_PATHS = {
  triangle: "M8 2 L14.5 13.5 L1.5 13.5 Z",
  diamond: "M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z",
  circle: "M8 2.5 A5.5 5.5 0 1 1 7.99 2.5 Z",
  square: "M3 3 H13 V13 H3 Z",
  hex: "M8 1.8 L13.4 4.9 L13.4 11.1 L8 14.2 L2.6 11.1 L2.6 4.9 Z",
  ring: "M8 3 A5 5 0 1 1 7.99 3 Z",
};

export function shapePath(shape) {
  return SHAPE_PATHS[shape] || SHAPE_PATHS.circle;
}

// Descriptive magnitude classes commonly used for earthquakes.
export function magnitudeClass(magnitude) {
  if (typeof magnitude !== "number" || !Number.isFinite(magnitude)) return null;
  if (magnitude >= 8) return { label: "Great", tone: "critical" };
  if (magnitude >= 7) return { label: "Major", tone: "critical" };
  if (magnitude >= 6) return { label: "Strong", tone: "critical" };
  if (magnitude >= 5) return { label: "Moderate", tone: "warning" };
  if (magnitude >= 4) return { label: "Light", tone: "neutral" };
  return { label: "Minor", tone: "muted" };
}
