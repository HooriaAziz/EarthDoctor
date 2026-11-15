
import {
  Globe,
  Layers,
  Flame,
  Activity,
  CloudRain,
  Mountain,
} from "lucide-react";

import "./MapModeSidebar.css";

const MAP_MODES = [
  {
    id: "country",
    label: "Country Explorer",
    description: "Explore countries",
    icon: Globe,
  },
  {
    id: "all-events",
    label: "All Global Events",
    description: "Every event category",
    icon: Layers,
  },
  {
    id: "wildfires",
    label: "Wildfires",
    description: "Fire activity",
    icon: Flame,
  },
  {
    id: "earthquakes",
    label: "Earthquakes",
    description: "Seismic activity",
    icon: Activity,
  },
  {
    id: "storms-floods",
    label: "Storms & Floods",
    description: "Extreme weather",
    icon: CloudRain,
  },
  {
    id: "volcanoes",
    label: "Volcanoes",
    description: "Volcanic activity",
    icon: Mountain,
  },
];

export default function MapModeSidebar({
  activeMode,
  onModeChange,
}) {
  return (
    <aside className="map-mode-sidebar">
      <div className="map-sidebar-heading">
        <span className="map-sidebar-eyebrow">EARTH DOCTOR</span>
        <h3>Map Explorer</h3>
        <p>Choose what to explore</p>
      </div>

      <nav className="map-mode-list" aria-label="Map modes">
        {MAP_MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;

          return (
            <button
              type="button"
              key={mode.id}
              className={`map-mode-button ${isActive ? "is-active" : ""}`}
              onClick={() => onModeChange(mode.id)}
              aria-pressed={isActive}
            >
              <span className="map-mode-icon">
                <Icon size={19} strokeWidth={1.8} />
              </span>

              <span className="map-mode-text">
                <span className="map-mode-label">{mode.label}</span>
                <span className="map-mode-description">
                  {mode.description}
                </span>
              </span>

              {isActive && <span className="map-mode-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="map-sidebar-footer">
        Select a mode to update the globe.
      </div>
    </aside>
  );
}
