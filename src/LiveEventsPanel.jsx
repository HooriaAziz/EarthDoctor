import "./LiveEventsPanel.css";

function formatDate(value) {
  if (!value) return "Timestamp not supplied";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default function LiveEventsPanel({ data, loading, limit = 8 }) {
  const events = data?.events || [];
  const statuses = data?.sourceStatus || { eonet: "loading", usgs: "loading" };
  const errors = data?.sourceErrors || [];
  const visibleEvents = events.slice(0, limit);
  const connectedCount = Object.values(statuses).filter(
    (status) => status === "connected"
  ).length;

  return (
    <section className="live-events-panel" aria-live="polite">
      <div className="live-events-heading">
        <div>
          <p className="live-events-eyebrow">LIVE GLOBAL EVENT FEEDS</p>
          <h2>Current Earth Events</h2>
          <p className="live-events-subtitle">
            Open natural events and magnitude 2.5+ earthquakes reported by public scientific feeds.
          </p>
        </div>
        <div className="live-events-status">
          <span className={connectedCount > 0 ? "live-status-dot is-online" : "live-status-dot"} />
          {loading && events.length === 0
            ? "Connecting"
            : `${connectedCount}/2 sources connected`}
        </div>
      </div>

      <div className="live-events-sources">
        <span className={statuses.eonet === "connected" ? "live-source is-online" : "live-source"}>
          NASA EONET
        </span>
        <span className={statuses.usgs === "connected" ? "live-source is-online" : "live-source"}>
          USGS Earthquakes
        </span>
        <span className="live-refresh-note">Checks every 5 minutes · source update timing varies</span>
      </div>

      {loading && events.length === 0 ? (
        <div className="live-events-empty">Loading current events from NASA and USGS…</div>
      ) : visibleEvents.length > 0 ? (
        <div className="live-events-list">
          {visibleEvents.map((event) => (
            <article className="live-event-item" key={event.id}>
              <div className="live-event-marker" aria-hidden="true">
                {event.category === "Earthquake" ? "◈" : "●"}
              </div>
              <div className="live-event-main">
                <div className="live-event-topline">
                  <span className="live-event-category">{event.category}</span>
                  <span className="live-event-source">{event.source}</span>
                </div>
                <h3>{event.title}</h3>
                <p>{event.place}</p>
                <div className="live-event-meta">
                  <span>Reported: {formatDate(event.observedAt)}</span>
                  {Number.isFinite(event.latitude) && Number.isFinite(event.longitude) && (
                    <span>{event.latitude.toFixed(2)}, {event.longitude.toFixed(2)}</span>
                  )}
                  {Number.isFinite(event.depthKm) && <span>Depth {event.depthKm.toFixed(1)} km</span>}
                </div>
              </div>
              <a className="live-event-link" href={event.url} target="_blank" rel="noreferrer">
                Source ↗
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="live-events-empty">
          The connected feeds returned no events. This does not establish that an area is hazard-free.
        </div>
      )}

      {errors.length > 0 && (
        <div className="live-events-errors">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <div className="live-events-footer">
        <span>Last checked: {formatDate(data?.fetchedAt)}</span>
        <span>Map markers show events with geographic coordinates.</span>
      </div>
    </section>
  );
}
