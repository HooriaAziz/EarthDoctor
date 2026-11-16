import { useMemo, useState } from "react";
import { Panel, StatusBadge } from "./ui";
import XYChart from "./XYChart";
import { RangeTabs, SourceLine } from "./trends/common";
import { useRemote } from "../hooks/useRemote";
import { USGS_MONTH_URL, loadUsgsMonth } from "../data/loaders";
import { fmtNum, fmtUtc, isNum } from "../lib/format";
import { SERIES_COLORS } from "../lib/colors";

const TEN_MIN = 10 * 60 * 1000;

const MAG_CLASSES = [
  { id: "m45", label: "M4.5–4.9", min: 4.5, max: 5, color: SERIES_COLORS.slate },
  { id: "m5", label: "M5.0–5.9", min: 5, max: 6, color: SERIES_COLORS.amber },
  { id: "m6", label: "M6.0+", min: 6, max: Infinity, color: SERIES_COLORS.red },
];

// Standard focal-depth classes.
const DEPTH_CLASSES = [
  { label: "Shallow 0–70 km", min: -Infinity, max: 70 },
  { label: "Intermediate 70–300 km", min: 70, max: 300 },
  { label: "Deep 300–700 km", min: 300, max: Infinity },
];

function regionOf(place) {
  if (!place) return "Unspecified";
  const parts = place.split(",");
  const tail = parts[parts.length - 1].trim();
  return tail.replace(/^.* of /, "") || "Unspecified";
}

export default function SeismicityPanel({ onSelectEvent }) {
  const remote = useRemote("usgs-4.5-month", loadUsgsMonth, { maxAgeMs: TEN_MIN });
  const [view, setView] = useState("daily");
  const events = useMemo(() => remote.data?.events ?? [], [remote.data]);

  const model = useMemo(() => {
    if (!events.length) return null;
    const generated = remote.data.generated ?? Math.max(...events.map((e) => Date.parse(e.observedAt)));
    const end = new Date(generated);
    const days = [];
    for (let i = 29; i >= 0; i -= 1) {
      days.push(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i)).toISOString().slice(0, 10));
    }
    const counts = Object.fromEntries(MAG_CLASSES.map((c) => [c.id, new Array(days.length).fill(0)]));
    const magBins = [];
    for (let m = 4.5; m < 8.6; m += 0.25) magBins.push(Number(m.toFixed(2)));
    const magCounts = new Array(magBins.length).fill(0);
    const depthCounts = DEPTH_CLASSES.map(() => 0);
    const regions = new Map();

    for (const e of events) {
      const day = e.observedAt?.slice(0, 10);
      const di = days.indexOf(day);
      const cls = MAG_CLASSES.find((c) => e.magnitude >= c.min && e.magnitude < c.max);
      if (di >= 0 && cls) counts[cls.id][di] += 1;
      if (isNum(e.magnitude)) {
        const bi = Math.min(magBins.length - 1, Math.max(0, Math.floor((e.magnitude - 4.5) / 0.25)));
        magCounts[bi] += 1;
      }
      if (isNum(e.depthKm)) {
        const k = DEPTH_CLASSES.findIndex((c) => e.depthKm >= c.min && e.depthKm < c.max);
        if (k >= 0) depthCounts[k] += 1;
      }
      const region = regionOf(e.place);
      const entry = regions.get(region) || { region, count: 0, maxMag: 0, maxId: null };
      entry.count += 1;
      if (e.magnitude > entry.maxMag) {
        entry.maxMag = e.magnitude;
        entry.maxId = e.id;
      }
      regions.set(region, entry);
    }

    const lastMag = magCounts.findLastIndex((c) => c > 0);
    const largest = [...events].sort((a, b) => b.magnitude - a.magnitude)[0];
    const depths = events.map((e) => e.depthKm).filter(isNum).sort((a, b) => a - b);
    return {
      days,
      counts,
      magBins: magBins.slice(0, lastMag + 1),
      magCounts: magCounts.slice(0, lastMag + 1),
      depthCounts,
      regions: [...regions.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      largest,
      m6: events.filter((e) => e.magnitude >= 6).length,
      medianDepth: depths.length ? depths[Math.floor(depths.length / 2)] : null,
      tsunami: events.filter((e) => e.tsunami).length,
    };
  }, [events, remote.data]);

  const status =
    remote.status === "loaded" ? "connected" : remote.status === "error" ? "unavailable" : "loading";

  return (
    <Panel
      id="seismicity"
      title="Seismicity · past 30 days"
      meta="USGS · M4.5+ worldwide · UTC days"
      actions={
        <>
          <RangeTabs
            value={view}
            onChange={setView}
            options={[
              { id: "daily", label: "Daily count" },
              { id: "mag", label: "Magnitude" },
              { id: "regions", label: "Regions" },
            ]}
            label="Seismicity view"
          />
          <StatusBadge status={status} label={remote.status === "loaded" ? "USGS live" : undefined} />
        </>
      }
    >
      {!model ? (
        remote.status === "error" ? (
          <p className="row-note tone-bad">The USGS 30-day feed could not be reached: {remote.error}</p>
        ) : (
          <p className="chart-empty">Loading USGS 30-day feed…</p>
        )
      ) : (
        <>
          <div className="stat-row">
            <div>
              <span className="kpi-label">Events M4.5+</span>
              <strong className="num stat-big">{events.length}</strong>
              <span className="kpi-sub">≈ {fmtNum(events.length / 30, 1)} per day</span>
            </div>
            <div>
              <span className="kpi-label">M6.0+</span>
              <strong className="num stat-big tone-warm">{model.m6}</strong>
              <span className="kpi-sub">{model.tsunami} with USGS tsunami flag</span>
            </div>
            <div>
              <span className="kpi-label">Largest</span>
              <strong className="num stat-big">M{fmtNum(model.largest.magnitude, 1)}</strong>
              <button type="button" className="link-btn kpi-sub" onClick={() => onSelectEvent?.(model.largest)}>
                {model.largest.place} · {fmtUtc(model.largest.observedAt)}
              </button>
            </div>
            <div>
              <span className="kpi-label">Median depth</span>
              <strong className="num stat-big">
                {fmtNum(model.medianDepth, 0)}
                <span className="kpi-unit">km</span>
              </strong>
            </div>
          </div>

          {view === "daily" && (
            <XYChart
              x={model.days}
              xType="category"
              stacked
              height={190}
              series={MAG_CLASSES.map((c) => ({ id: c.id, label: c.label, type: "bar", color: c.color, values: model.counts[c.id] }))}
              formatX={(v) => `${v} UTC`}
              formatTick={(v) => v.slice(5)}
              formatY={(v) => fmtNum(v, 0)}
              unit="events"
              ariaLabel="Daily count of M4.5+ earthquakes over 30 days, stacked by magnitude class"
            />
          )}

          {view === "mag" && (
            <div className="chart-grid chart-grid-2">
              <figure className="chart-cell">
                <figcaption className="chart-cell-head">
                  <span className="chart-title">Magnitude distribution · 0.25 bins</span>
                </figcaption>
                <XYChart
                  x={model.magBins}
                  xType="category"
                  height={160}
                  legend={false}
                  series={[
                    {
                      id: "m",
                      label: "Events",
                      type: "bar",
                      color: SERIES_COLORS.blue,
                      colorAt: (v, i) => (model.magBins[i] >= 6 ? SERIES_COLORS.red : model.magBins[i] >= 5 ? SERIES_COLORS.amber : SERIES_COLORS.slate),
                      values: model.magCounts,
                    },
                  ]}
                  formatX={(v) => `M${v.toFixed(2)}–${(v + 0.25).toFixed(2)}`}
                  formatTick={(v) => v.toFixed(1)}
                  formatY={(v) => fmtNum(v, 0)}
                  unit="events"
                  ariaLabel="Histogram of earthquake magnitudes"
                />
              </figure>
              <figure className="chart-cell">
                <figcaption className="chart-cell-head">
                  <span className="chart-title">Focal depth class</span>
                </figcaption>
                <ul className="bar-list bar-list-wide depth-list">
                  {DEPTH_CLASSES.map((c, k) => (
                    <li key={c.label}>
                      <span className="bar-label">{c.label}</span>
                      <span className="bar-track" aria-hidden="true">
                        <span style={{ width: `${(model.depthCounts[k] / Math.max(...model.depthCounts)) * 100}%` }} />
                      </span>
                      <span className="num bar-value">{model.depthCounts[k]}</span>
                    </li>
                  ))}
                </ul>
                <p className="row-note">
                  Most large earthquakes are shallow; deep events occur in subducting slabs.
                </p>
              </figure>
            </div>
          )}

          {view === "regions" && (
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th scope="col">Region (as reported by USGS)</th>
                  <th scope="col" className="col-bar">Events</th>
                  <th scope="col" className="num-col">Largest</th>
                </tr>
              </thead>
              <tbody>
                {model.regions.map((r) => (
                  <tr key={r.region}>
                    <th scope="row">{r.region}</th>
                    <td className="col-bar">
                      <span className="inline-bar">
                        <span className="bar-track" aria-hidden="true">
                          <span style={{ width: `${(r.count / model.regions[0].count) * 100}%` }} />
                        </span>
                        <span className="num">{r.count}</span>
                      </span>
                    </td>
                    <td className="num num-col">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onSelectEvent?.(events.find((e) => e.id === r.maxId))}
                      >
                        M{fmtNum(r.maxMag, 1)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SourceLine href={USGS_MONTH_URL} label="USGS GeoJSON feed">
            Feed generated {fmtUtc(remote.data.generated)}. Counts, histograms and region groupings are computed
            here; regions are taken from the end of each USGS place description.
          </SourceLine>
        </>
      )}
    </Panel>
  );
}
