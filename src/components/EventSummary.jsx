import { useMemo } from "react";
import { Panel, StatusBadge, EventGlyph } from "./ui";
import { EVENT_GROUPS, classifyEvent, magnitudeClass } from "../lib/eventTypes";
import { fmtNum, fmtUtc } from "../lib/format";

export default function EventSummary({ data, loading, selectedEventId, onSelectEvent }) {
  const events = data.events;

  const { counts, max, quakes } = useMemo(() => {
    const result = {};
    for (const event of events) {
      const group = classifyEvent(event);
      result[group] = (result[group] || 0) + 1;
    }
    const strongest = events
      .filter((event) => Number.isFinite(event.magnitude))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5);
    return { counts: result, max: Math.max(1, ...Object.values(result)), quakes: strongest };
  }, [events]);

  const statuses = Object.values(data.sourceStatus);
  const connected = statuses.filter((status) => status === "connected").length;
  const overall = loading && !events.length
    ? "loading"
    : connected === statuses.length
      ? "connected"
      : connected > 0
        ? "partial"
        : "unavailable";

  return (
    <Panel
      id="event-summary"
      className="summary-panel"
      title="Global event activity"
      meta="Open EONET events · USGS M2.5+ past 24 h"
      actions={<StatusBadge status={overall} label={`${connected}/${statuses.length} feeds`} />}
    >
      <ul className="bar-list" aria-label="Event count by type">
        {EVENT_GROUPS.map((group) => {
          const count = counts[group.id] || 0;
          return (
            <li key={group.id}>
              <span className="bar-label">
                <EventGlyph group={group.id} size={10} />
                {group.label}
              </span>
              <span className="bar-track" aria-hidden="true">
                <span style={{ width: `${(count / max) * 100}%`, background: group.color }} />
              </span>
              <span className="num bar-value">{count}</span>
            </li>
          );
        })}
      </ul>

      <h3 className="subhead">Strongest earthquakes · past 24 h</h3>
      {quakes.length ? (
        <ol className="quake-list">
          {quakes.map((event) => {
            const mclass = magnitudeClass(event.magnitude);
            return (
              <li key={event.id}>
                <button
                  type="button"
                  className={`quake-row ${selectedEventId === event.id ? "is-selected" : ""}`}
                  onClick={() => onSelectEvent(event.id, { focus: true })}
                >
                  <span className={`mag num mag-${mclass?.tone}`}>M{fmtNum(event.magnitude, 1)}</span>
                  <span className="quake-place">{event.place}</span>
                  <span className="mono quake-time">{fmtUtc(event.observedAt)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="row-note">{loading ? "Loading USGS feed…" : "No USGS earthquakes available."}</p>
      )}

      {data.sourceErrors.length > 0 && (
        <p className="row-note tone-bad" role="alert">
          {data.sourceErrors.join(" · ")}
        </p>
      )}
    </Panel>
  );
}
