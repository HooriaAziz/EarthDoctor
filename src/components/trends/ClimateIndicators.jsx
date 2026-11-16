import { useMemo, useState } from "react";
import { Panel, StatusBadge } from "../ui";
import XYChart from "../XYChart";
import { GML_SERIES, NCEI_PAGE } from "../../data/loaders";
import { analyzeTimeSeries } from "../../assets/earthTrendAnalysis";
import { fmtNum, isNum } from "../../lib/format";
import { SERIES_COLORS } from "../../lib/colors";
import { RangeTabs, SignedNumber, SourceLine } from "./common";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sameMonthLastYear(rows, latest) {
  if (!latest) return null;
  const prior = rows.find((r) => r.year === latest.year - 1 && r.month === latest.month);
  return prior && isNum(prior.avg) ? latest.avg - prior.avg : null;
}

function statusOf(remote) {
  return remote.status === "loaded" ? "connected" : remote.status === "error" ? "unavailable" : remote.status === "loading" ? "loading" : "idle";
}

const TEMP_RANGES = [
  { id: 1850, label: "1850–" },
  { id: 1950, label: "1950–" },
  { id: 1975, label: "1975–" },
];

export function TemperaturePanel({ remote }) {
  const [from, setFrom] = useState(1850);
  const points = useMemo(() => remote.data?.points ?? [], [remote.data]);
  const shown = useMemo(() => points.filter((p) => p.year >= from), [points, from]);

  const stats = useMemo(() => {
    const recent = points.filter((p) => p.year >= 1975);
    const trend = recent.length > 8 ? analyzeTimeSeries(recent, { alpha: 0.05, minimumObservations: 8 }) : null;
    const ranked = [...points].sort((a, b) => b.value - a.value);
    return { trend, warmest: ranked.slice(0, 3), latest: points.at(-1) };
  }, [points]);

  const x = useMemo(() => shown.map((p) => p.year), [shown]);
  const series = useMemo(
    () => [
      {
        id: "anom",
        label: "Anomaly",
        type: "bar",
        color: SERIES_COLORS.red,
        colorAt: (v) => (v >= 0 ? SERIES_COLORS.red : SERIES_COLORS.blue),
        values: shown.map((p) => p.value),
      },
    ],
    [shown]
  );

  return (
    <Panel
      id="global-temp"
      title="Global surface temperature anomaly"
      meta={`NOAA NCEI · land + ocean · annual · vs ${remote.data?.basePeriod?.replace("-", "–") || "1901–2000"} mean`}
      actions={
        <>
          <RangeTabs value={from} onChange={setFrom} options={TEMP_RANGES} label="Start year" />
          <StatusBadge status={statusOf(remote)} label={remote.status === "loaded" ? "NOAA live" : undefined} />
        </>
      }
    >
      {remote.status === "error" && !points.length ? (
        <p className="row-note tone-bad">NOAA NCEI could not be reached: {remote.error}</p>
      ) : !points.length ? (
        <p className="chart-empty">Loading NOAA global temperature record…</p>
      ) : (
        <>
          <div className="stat-row">
            <div>
              <span className="kpi-label">{stats.latest.year}</span>
              <strong className="num stat-big tone-warm">
                <SignedNumber value={stats.latest.value} digits={2} unit=" °C" />
              </strong>
            </div>
            <div>
              <span className="kpi-label">Trend 1975–{stats.latest.year} (Sen's slope)</span>
              <strong className="num stat-big">
                <SignedNumber value={stats.trend?.senSlopePerDecade} digits={2} unit=" °C" />
                <span className="kpi-unit">/decade</span>
              </strong>
              <span className="kpi-sub">
                {stats.trend?.isSignificant ? "Significant" : "Not significant"} · Mann–Kendall p{" "}
                {stats.trend?.pValue < 0.0001 ? "< 0.0001" : fmtNum(stats.trend?.pValue, 4)}
              </span>
            </div>
            <div>
              <span className="kpi-label">Warmest years on record</span>
              <span className="warm-list mono">
                {stats.warmest.map((p) => (
                  <span key={p.year}>
                    {p.year} <SignedNumber value={p.value} digits={2} />
                  </span>
                ))}
              </span>
            </div>
          </div>
          <XYChart
            x={x}
            series={series}
            height={210}
            unit="°C"
            formatX={(v) => String(v)}
            formatY={(v, tip) => (tip ? `${v > 0 ? "+" : ""}${v.toFixed(2)}` : v.toFixed(1))}
            ariaLabel={`Annual global temperature anomaly ${x[0]} to ${x.at(-1)}, degrees Celsius relative to the ${remote.data.basePeriod} average. Red bars are above the baseline, blue below.`}
          />
          <SourceLine href={NCEI_PAGE} label="NOAA Climate at a Glance">
            Bars above zero (red) are warmer than the baseline, below (blue) cooler. Values are
            NOAAGlobalTemp anomalies as published; the trend statistic is computed here.
          </SourceLine>
        </>
      )}
    </Panel>
  );
}

const GML_RANGES = [
  { id: "all", label: "Full record" },
  { id: "20", label: "20 y" },
  { id: "5", label: "5 y" },
];

export function GasPanel({ id, remote, color }) {
  const meta = GML_SERIES[id];
  const [range, setRange] = useState("all");
  const rows = useMemo(() => remote.data?.rows ?? [], [remote.data]);
  const latest = remote.data?.latest;
  const shown = useMemo(() => {
    if (range === "all" || !latest) return rows;
    const cutoff = latest.t - Number(range);
    return rows.filter((r) => r.t >= cutoff);
  }, [rows, range, latest]);

  const x = useMemo(() => shown.map((r) => r.t), [shown]);
  const series = useMemo(
    () => [
      { id: "avg", label: "Monthly mean", type: "line", color, values: shown.map((r) => r.avg), width: 1.3 },
      { id: "trend", label: "Seasonally adjusted trend", type: "line", color: SERIES_COLORS.slate, dash: true, values: shown.map((r) => r.trend), width: 1.2 },
    ],
    [shown, color]
  );

  const growth = useMemo(() => remote.data?.growth ?? [], [remote.data]);
  const gx = useMemo(() => growth.map((g) => g.year), [growth]);
  const gseries = useMemo(
    () => [{ id: "g", label: "Annual increase", type: "bar", color, values: growth.map((g) => g.value) }],
    [growth, color]
  );

  const yoy = remote.data ? sameMonthLastYear(remote.data.rows, latest) : null;
  const digits = meta.unit === "ppm" ? 2 : 1;

  return (
    <Panel
      id={`gas-${id}`}
      title={meta.label}
      meta={`NOAA GML · monthly · ${meta.unit}`}
      actions={
        <>
          <RangeTabs value={range} onChange={setRange} options={GML_RANGES} label="Range" />
          <StatusBadge status={statusOf(remote)} label={remote.status === "loaded" ? "NOAA live" : undefined} />
        </>
      }
    >
      {remote.status === "error" && !rows.length ? (
        <p className="row-note tone-bad">NOAA GML could not be reached: {remote.error}</p>
      ) : !rows.length ? (
        <p className="chart-empty">Loading NOAA GML record…</p>
      ) : (
        <>
          <div className="stat-row">
            <div>
              <span className="kpi-label">
                {MONTHS[latest.month - 1]} {latest.year}
              </span>
              <strong className="num stat-big">
                {fmtNum(latest.avg, digits)}
                <span className="kpi-unit">{meta.unit}</span>
              </strong>
            </div>
            <div>
              <span className="kpi-label">vs same month last year</span>
              <strong className="num stat-big">
                <SignedNumber value={yoy} digits={digits} unit={` ${meta.unit}`} />
              </strong>
            </div>
            <div>
              <span className="kpi-label">Record start</span>
              <strong className="num stat-big">
                {fmtNum(rows.find((r) => isNum(r.avg))?.avg, digits)}
                <span className="kpi-unit">
                  {meta.unit} · {rows[0].year}
                </span>
              </strong>
            </div>
          </div>
          <XYChart
            x={x}
            series={series}
            height={170}
            unit={meta.unit}
            formatX={(v, i) => `${MONTHS[shown[i].month - 1]} ${shown[i].year}`}
            formatY={(v, tip) => (tip ? fmtNum(v, digits) : fmtNum(v, 0))}
            ariaLabel={`${meta.label} monthly mean concentration, ${meta.unit}, ${shown[0]?.year} to ${latest.year}`}
          />
          <h3 className="subhead">Year-on-year increase of annual mean ({meta.unit}/yr, complete years)</h3>
          <XYChart
            x={gx}
            series={gseries}
            height={96}
            unit={`${meta.unit}/yr`}
            formatX={(v) => `${v} vs ${v - 1}`}
            formatY={(v, tip) => (tip ? fmtNum(v, 2) : fmtNum(v, 1))}
            legend={false}
            ariaLabel={`Annual increase in ${meta.label}`}
          />
          <SourceLine href={meta.page} label="NOAA GML trends">
            Monthly means as published (provisional for recent months). Growth bars are computed here
            from complete calendar-year means.
          </SourceLine>
        </>
      )}
    </Panel>
  );
}
