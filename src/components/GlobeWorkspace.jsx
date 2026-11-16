import { useCallback, useMemo, useRef, useState } from "react";
import { Crosshair, Home, Layers, Minus, Plus, Sun, Tags } from "lucide-react";

import CesiumGlobe from "../CesiumGlobe";
import { EVENT_GROUPS, classifyEvent } from "../lib/eventTypes";
import { fmtCoord, fmtDateTime } from "../lib/format";
import { EventGlyph } from "./ui";

function ToolButton({ label, onClick, disabled, pressed, children }) {
  return (
    <button
      type="button"
      className="tool-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
    >
      {children}
    </button>
  );
}

export default function GlobeWorkspace({
  events,
  eventsLoading,
  eventsFetchedAt,
  layers,
  onLayersChange,
  selectedLocation,
  selectedEvent,
  onLocationSelect,
  onEventSelect,
  searchTarget,
  command,
  onCommand,
}) {
  const readoutRef = useRef(null);
  const [showLabels, setShowLabels] = useState(true);
  const [dayNight, setDayNight] = useState(false);

  // Counts per layer come from the full feed, not the filtered set.
  const counts = useMemo(() => {
    const result = {};
    for (const event of events) {
      const group = classifyEvent(event);
      result[group] = (result[group] || 0) + 1;
    }
    return result;
  }, [events]);

  // Stable array identity so the globe only rebuilds markers when the
  // feed or the layer selection actually changes.
  const visibleEvents = useMemo(
    () => events.filter((event) => layers[classifyEvent(event)]),
    [events, layers]
  );
  const mappedCount = visibleEvents.filter(
    (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
  ).length;

  // Pointer readout is written straight to the DOM to avoid
  // re-rendering React on every mouse move.
  const handlePointerMove = useCallback((info) => {
    const node = readoutRef.current;
    if (!node) return;
    node.textContent = info
      ? `${fmtCoord(info.latitude, info.longitude, 3)}${info.label ? `  ·  ${info.label}` : ""}`
      : "Pointer off globe";
  }, []);

  const hasPoint =
    Number.isFinite(selectedLocation?.latitude) &&
    Number.isFinite(selectedLocation?.longitude);

  const allOn = EVENT_GROUPS.every((group) => layers[group.id]);

  return (
    <section className="panel globe-panel" aria-labelledby="globe-title">
      <header className="panel-head globe-head">
        <div className="panel-head-text">
          <h2 className="panel-title" id="globe-title">
            Global view
          </h2>
          <span className="panel-meta">
            <span className="num">{mappedCount}</span> events mapped
            {eventsLoading ? " · updating…" : eventsFetchedAt ? ` · checked ${fmtDateTime(eventsFetchedAt)}` : ""}
          </span>
        </div>

        <div className="toolbar" role="toolbar" aria-label="Globe controls">
          <div className="tool-group">
            <ToolButton label="Zoom in" onClick={() => onCommand({ type: "zoomIn" })}>
              <Plus size={14} />
            </ToolButton>
            <ToolButton label="Zoom out" onClick={() => onCommand({ type: "zoomOut" })}>
              <Minus size={14} />
            </ToolButton>
            <ToolButton label="Reset camera" onClick={() => onCommand({ type: "reset" })}>
              <Home size={14} />
            </ToolButton>
            <ToolButton
              label="Focus selected location"
              disabled={!hasPoint}
              onClick={() =>
                onCommand({
                  type: "focus",
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                })
              }
            >
              <Crosshair size={14} />
            </ToolButton>
          </div>
          <div className="tool-group">
            <ToolButton
              label="Boundaries and place labels"
              pressed={showLabels}
              onClick={() => setShowLabels((value) => !value)}
            >
              <Tags size={14} />
            </ToolButton>
            <ToolButton
              label="Day/night lighting (current sun position)"
              pressed={dayNight}
              onClick={() => setDayNight((value) => !value)}
            >
              <Sun size={14} />
            </ToolButton>
          </div>
        </div>
      </header>

      <div className="layer-strip" role="group" aria-label="Event layers">
        <span className="layer-strip-label">
          <Layers size={13} aria-hidden="true" /> Layers
        </span>
        {EVENT_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            className="layer-chip"
            aria-pressed={Boolean(layers[group.id])}
            onClick={() => onLayersChange({ ...layers, [group.id]: !layers[group.id] })}
          >
            <EventGlyph group={group.id} size={11} />
            <span>{group.label}</span>
            <span className="num layer-count">{counts[group.id] || 0}</span>
          </button>
        ))}
        <button
          type="button"
          className="layer-chip layer-chip-plain"
          onClick={() =>
            onLayersChange(
              Object.fromEntries(EVENT_GROUPS.map((group) => [group.id, !allOn]))
            )
          }
        >
          {allOn ? "Hide all" : "Show all"}
        </button>
      </div>

      <div className="globe-stage">
        <CesiumGlobe
          events={visibleEvents}
          selectedEventId={selectedEvent?.id ?? null}
          selectedPoint={hasPoint ? selectedLocation : null}
          selectedCountryName={selectedLocation?.name ?? null}
          searchTarget={searchTarget}
          command={command}
          showLabels={showLabels}
          dayNight={dayNight}
          onLocationSelect={onLocationSelect}
          onEventSelect={onEventSelect}
          onPointerMove={handlePointerMove}
        />

        {selectedEvent && (
          <div className="globe-callout" role="status">
            <EventGlyph group={classifyEvent(selectedEvent)} size={12} />
            <div>
              <strong>{selectedEvent.title}</strong>
              <span className="mono">
                {fmtCoord(selectedEvent.latitude, selectedEvent.longitude)} · {selectedEvent.source}
              </span>
            </div>
            <a href="#event-explorer" className="globe-callout-link">
              Details
            </a>
          </div>
        )}

        <div className="globe-readout mono" aria-hidden="true">
          <span ref={readoutRef}>Pointer off globe</span>
        </div>

        <p className="globe-hint">Click a point for local conditions · drag to rotate · scroll to zoom</p>
      </div>
    </section>
  );
}
