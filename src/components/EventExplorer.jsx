import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crosshair, ExternalLink, Search } from "lucide-react";
import { Panel, StatusBadge, EventGlyph, Tag } from "./ui";
import { EVENT_GROUPS, EVENT_GROUP_BY_ID, classifyEvent, magnitudeClass } from "../lib/eventTypes";
import { fmtCoord, fmtDateTime, fmtNum, fmtRelative, fmtUtc, isNum } from "../lib/format";

const PAGE_SIZE = 20;

const WINDOWS = [
  { id: "any", label: "Any time", ms: null },
  { id: "24h", label: "Last 24 h", ms: 864e5 },
  { id: "7d", label: "Last 7 days", ms: 7 * 864e5 },
  { id: "30d", label: "Last 30 days", ms: 30 * 864e5 },
];

const MAGS = [
  { id: "any", label: "Any", min: null },
  { id: "4.5", label: "M4.5+", min: 4.5 },
  { id: "5", label: "M5+", min: 5 },
  { id: "6", label: "M6+", min: 6 },
];

function detailText(event) {
  if (isNum(event.magnitude)) {
    return `M${fmtNum(event.magnitude, 1)}${event.magnitudeType ? ` ${event.magnitudeType}` : ""}`;
  }
  if (event.reportedMagnitude) {
    return `${fmtNum(event.reportedMagnitude.value, 0)} ${event.reportedMagnitude.unit}`;
  }
  return "—";
}

function timeValue(event) {
  const t = event.observedAt ? new Date(event.observedAt).getTime() : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}

function EventDetail({ event, hiddenByFilter, onFocus, referenceTime }) {
  if (!event) {
    return (
      <aside className="event-detail is-empty" aria-label="Event details">
        <p className="row-note">Select a row or a globe marker to inspect an event.</p>
      </aside>
    );
  }

  const group = classifyEvent(event);
  const mclass = magnitudeClass(event.magnitude);
  const hasCoords = isNum(event.latitude) && isNum(event.longitude);

  return (
    <aside className="event-detail" aria-label="Event details" aria-live="polite">
      <div className="event-detail-head">
        <span className="type-cell">
          <EventGlyph group={group} size={12} />
          {EVENT_GROUP_BY_ID[group].label}
        </span>
        <span className="mono muted">{event.source}</span>
      </div>
      <h3 className="event-detail-title">{event.title}</h3>
      {event.place && <p className="event-detail-place">{event.place}</p>}
      {hiddenByFilter && <p className="row-note tone-warn">Hidden by the current table filters.</p>}

      <dl className="kv">
        <div>
          <dt>Reported</dt>
          <dd className="mono">
            {fmtUtc(event.observedAt)} <span className="muted">({fmtRelative(event.observedAt, referenceTime)})</span>
          </dd>
        </div>
        <div>
          <dt>Local</dt>
          <dd className="mono">{fmtDateTime(event.observedAt)}</dd>
        </div>
        {event.firstObservedAt && event.firstObservedAt !== event.observedAt && (
          <div>
            <dt>First observed</dt>
            <dd className="mono">{fmtUtc(event.firstObservedAt)}</dd>
          </div>
        )}
        <div>
          <dt>Position</dt>
          <dd className="mono">{hasCoords ? fmtCoord(event.latitude, event.longitude, 3) : "Not supplied"}</dd>
        </div>
        {isNum(event.depthKm) && (
          <div>
            <dt>Depth</dt>
            <dd className="mono">{fmtNum(event.depthKm, 1)} km</dd>
          </div>
        )}
        <div>
          <dt>{isNum(event.magnitude) ? "Magnitude" : "Reported size"}</dt>
          <dd>
            <span className="mono">{detailText(event)}</span>
            {mclass && <Tag tone={mclass.tone}>{mclass.label}</Tag>}
          </dd>
        </div>
        {event.alertLevel && (
          <div>
            <dt>PAGER alert</dt>
            <dd>
              <Tag tone={event.alertLevel === "red" || event.alertLevel === "orange" ? "critical" : event.alertLevel === "yellow" ? "warning" : "ok"}>
                {event.alertLevel}
              </Tag>
            </dd>
          </div>
        )}
        {event.tsunami && (
          <div>
            <dt>Tsunami flag</dt>
            <dd>
              <Tag tone="critical">Flag set by USGS</Tag>
            </dd>
          </div>
        )}
        {event.reviewStatus && (
          <div>
            <dt>Review</dt>
            <dd className="mono">{event.reviewStatus}</dd>
          </div>
        )}
        {event.geometryCount > 1 && (
          <div>
            <dt>Track points</dt>
            <dd className="mono">{event.geometryCount}</dd>
          </div>
        )}
      </dl>

      {event.description && <p className="event-detail-desc">{event.description}</p>}

      <div className="event-detail-actions">
        <button type="button" className="btn" onClick={onFocus} disabled={!hasCoords}>
          <Crosshair size={13} aria-hidden="true" /> Focus on globe
        </button>
        <a className="btn btn-ghost" href={event.url} target="_blank" rel="noreferrer">
          Source <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
      {event.sourceLinks?.length > 1 && (
        <p className="row-note">
          Also:{" "}
          {event.sourceLinks.slice(1).map((link, index) => (
            <span key={link.url}>
              {index > 0 && " · "}
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.id}
              </a>
            </span>
          ))}
        </p>
      )}
    </aside>
  );
}

function SortHeader({ label, sortKey, sort, onSort, className }) {
  const active = sort.key === sortKey;
  return (
    <th scope="col" className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="th-sort" onClick={() => onSort(sortKey)}>
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)}
      </button>
    </th>
  );
}

export default function EventExplorer({ data, loading, selectedEventId, onSelectEvent }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [source, setSource] = useState("all");
  const [mag, setMag] = useState("any");
  const [windowId, setWindowId] = useState("any");
  const [sort, setSort] = useState({ key: "time", dir: "desc" });
  const [page, setPage] = useState(0);

  // Time windows are measured from the last feed check (deterministic,
  // and matches what the feed actually represents).
  const referenceTime = data.fetchedAt ? new Date(data.fetchedAt).getTime() : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const windowMs = WINDOWS.find((w) => w.id === windowId)?.ms;
    const minMag = MAGS.find((m) => m.id === mag)?.min;

    const rows = data.events.filter((event) => {
      if (group !== "all" && classifyEvent(event) !== group) return false;
      if (source !== "all" && event.source !== source) return false;
      if (minMag != null && !(isNum(event.magnitude) && event.magnitude >= minMag)) return false;
      if (windowMs && referenceTime && referenceTime - timeValue(event) > windowMs) return false;
      if (q && !`${event.title} ${event.place || ""} ${event.category}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sort.key === "mag") {
        const av = isNum(a.magnitude) ? a.magnitude : a.reportedMagnitude?.value ?? -Infinity;
        const bv = isNum(b.magnitude) ? b.magnitude : b.reportedMagnitude?.value ?? -Infinity;
        return (av - bv) * dir;
      }
      if (sort.key === "type") return classifyEvent(a).localeCompare(classifyEvent(b)) * dir;
      return (timeValue(a) - timeValue(b)) * dir;
    });
    return rows;
  }, [data.events, query, group, source, mag, windowId, sort, referenceTime]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const selected = selectedEventId ? data.events.find((event) => event.id === selectedEventId) : null;
  const hiddenByFilter = Boolean(selected && !filtered.includes(selected));

  function updateFilter(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(0);
    };
  }

  function onSort(key) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  }

  const statuses = data.sourceStatus;

  return (
    <Panel
      id="event-explorer"
      className="explorer-panel"
      title="Event explorer"
      meta={
        <>
          <span className="num">{filtered.length}</span> of <span className="num">{data.events.length}</span> events · checked{" "}
          <span className="mono">{fmtDateTime(data.fetchedAt)}</span>
        </>
      }
      actions={
        <>
          <StatusBadge status={statuses.eonet} label="EONET" title={`NASA EONET: ${statuses.eonet}`} />
          <StatusBadge status={statuses.usgs} label="USGS" title={`USGS: ${statuses.usgs}`} />
        </>
      }
    >
      <div className="filter-bar" role="group" aria-label="Event filters">
        <label className="field field-search">
          <span className="sr-only">Filter events by text</span>
          <Search size={13} aria-hidden="true" />
          <input type="search" placeholder="Filter by name or place" value={query} onChange={updateFilter(setQuery)} />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select value={group} onChange={updateFilter(setGroup)}>
            <option value="all">All types</option>
            {EVENT_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Source</span>
          <select value={source} onChange={updateFilter(setSource)}>
            <option value="all">All sources</option>
            <option value="NASA EONET">NASA EONET</option>
            <option value="USGS">USGS</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Magnitude</span>
          <select value={mag} onChange={updateFilter(setMag)}>
            {MAGS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Reported</span>
          <select value={windowId} onChange={updateFilter(setWindowId)}>
            {WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="explorer-body">
        <div className="table-wrap">
          {loading && data.events.length === 0 ? (
            <p className="row-note pad">Loading NASA EONET and USGS feeds…</p>
          ) : filtered.length === 0 ? (
            <p className="row-note pad">
              {data.events.length === 0
                ? "The connected feeds returned no events. This does not establish that any area is hazard-free."
                : "No events match the current filters."}
            </p>
          ) : (
            <table className="event-table">
              <caption className="sr-only">Natural events and earthquakes, page {safePage + 1} of {pageCount}</caption>
              <thead>
                <tr>
                  <SortHeader label="Type" sortKey="type" sort={sort} onSort={onSort} className="col-type" />
                  <th scope="col" className="col-event">Event</th>
                  <th scope="col" className="col-loc">Position</th>
                  <SortHeader label="Mag / size" sortKey="mag" sort={sort} onSort={onSort} className="col-mag" />
                  <SortHeader label="Reported (UTC)" sortKey="time" sort={sort} onSort={onSort} className="col-time" />
                  <th scope="col" className="col-src">Source</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((event) => {
                  const g = classifyEvent(event);
                  const mclass = magnitudeClass(event.magnitude);
                  const isSelected = event.id === selectedEventId;
                  return (
                    <tr
                      key={event.id}
                      className={isSelected ? "is-selected" : undefined}
                      aria-selected={isSelected}
                      onClick={() => onSelectEvent(event.id, { focus: true })}
                    >
                      <td className="col-type">
                        <span className="type-cell">
                          <EventGlyph group={g} size={11} />
                          {EVENT_GROUP_BY_ID[g].short}
                        </span>
                      </td>
                      <td className="col-event">
                        <button
                          type="button"
                          className="row-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(event.id, { focus: true });
                          }}
                        >
                          {event.title}
                        </button>
                        {event.place && <span className="row-sub">{event.place}</span>}
                      </td>
                      <td className="col-loc mono">{fmtCoord(event.latitude, event.longitude, 2)}</td>
                      <td className="col-mag">
                        <span className={`mono ${mclass ? `mag-${mclass.tone}` : ""}`}>{detailText(event)}</span>
                      </td>
                      <td className="col-time mono">{fmtUtc(event.observedAt)}</td>
                      <td className="col-src">
                        <a href={event.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          {event.source === "USGS" ? "USGS" : "EONET"}
                          <span className="sr-only"> source for {event.title}</span> ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {filtered.length > PAGE_SIZE && (
            <nav className="pager" aria-label="Event table pages">
              <button type="button" className="icon-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              <span className="mono">
                {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} / {filtered.length}
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </nav>
          )}

          {data.sourceErrors.length > 0 && (
            <p className="row-note tone-bad pad" role="alert">
              {data.sourceErrors.join(" · ")}
            </p>
          )}
        </div>

        <EventDetail
          event={selected}
          hiddenByFilter={hiddenByFilter}
          referenceTime={referenceTime ?? undefined}
          onFocus={() => onSelectEvent(selected.id, { focus: true })}
        />
      </div>
    </Panel>
  );
}
