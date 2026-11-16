import { useMemo, useState } from "react";
import { Panel, StatusBadge } from "./ui";
import XYChart from "./XYChart";
import { RangeTabs, SourceLine } from "./trends/common";
import { useRemote } from "../hooks/useRemote";
import { loadKp, loadSolarCycle } from "../data/loaders";
import { fmtNum, fmtUtc } from "../lib/format";
import { SERIES_COLORS } from "../lib/colors";

const FIFTEEN_MIN = 15 * 60 * 1000;
const SIX_HOURS = 6 * 3600 * 1000;

// NOAA geomagnetic storm scale: G1 = Kp 5 … G5 = Kp 9.
function gLevel(kp) {
  if (kp >= 9) return "G5 extreme";
  if (kp >= 8) return "G4 severe";
  if (kp >= 7) return "G3 strong";
  if (kp >= 6) return "G2 moderate";
  if (kp >= 5) return "G1 minor";
  if (kp >= 4) return "Active";
  return "Quiet–unsettled";
}

function kpColor(kp) {
  if (kp >= 7) return SERIES_COLORS.red;
  if (kp >= 5) return SERIES_COLORS.amber;
  if (kp >= 4) return SERIES_COLORS.blue;
  return SERIES_COLORS.green;
}

function statusOf(remote) {
  return remote.status === "loaded" ? "connected" : remote.status === "error" ? "unavailable" : "loading";
}

const CYCLE_RANGES = [
  { id: 1749, label: "1749–" },
  { id: 1950, label: "1950–" },
  { id: 2008, label: "Cycle 25" },
];

export default function SpaceWeatherPanel() {
  const kp = useRemote("swpc-kp", loadKp, { maxAgeMs: FIFTEEN_MIN });
  const cycle = useRemote("swpc-cycle", loadSolarCycle, { maxAgeMs: SIX_HOURS });
  const [from, setFrom] = useState(1950);

  const kpRows = useMemo(() => kp.data ?? [], [kp.data]);
  const latestKp = kpRows.at(-1);
  const maxKp = kpRows.reduce((m, r) => (r.kp > (m?.kp ?? -1) ? r : m), null);

  const cycleModel = useMemo(() => {
    const obs = (cycle.data?.observed ?? []).filter((r) => r.t >= from);
    const pred = cycle.data?.predicted ?? [];
    const lastObsT = obs.at(-1)?.t ?? 0;
    const futurePred = pred.filter((r) => r.t > lastObsT);
    const rows = [...obs.map((r) => ({ ...r, kind: "obs" })), ...futurePred.map((r) => ({ ...r, kind: "pred" }))];
    const latest = obs.at(-1);
    const firstF107 = (cycle.data?.observed ?? []).find((r) => r.f107 != null)?.tag ?? null;
    return {
      firstF107,
      x: rows.map((r) => r.t),
      rows,
      latest,
      lastObsT,
      series: [
        { id: "ssn", label: "Monthly sunspot number", type: "line", color: SERIES_COLORS.amber, values: rows.map((r) => (r.kind === "obs" ? r.ssn : null)), width: 1 },
        { id: "sm", label: "13-month smoothed", type: "line", color: SERIES_COLORS.red, values: rows.map((r) => (r.kind === "obs" ? r.smoothed : null)), width: 1.8 },
        { id: "pred", label: "NOAA prediction", type: "line", color: SERIES_COLORS.slate, dash: true, values: rows.map((r) => (r.kind === "pred" ? r.ssn : null)) },
      ],
      f107: [
        { id: "f", label: "F10.7 solar radio flux", type: "line", color: SERIES_COLORS.violet, values: rows.map((r) => (r.kind === "obs" ? r.f107 : null)), width: 1 },
        { id: "fp", label: "NOAA prediction", type: "line", color: SERIES_COLORS.slate, dash: true, values: rows.map((r) => (r.kind === "pred" ? r.f107 : null)) },
      ],
    };
  }, [cycle.data, from]);

  return (
    <div className="grid-2">
      <Panel
        id="kp"
        title="Geomagnetic activity · planetary Kp"
        meta="NOAA SWPC · 3-hour index · past 7 days · UTC"
        actions={<StatusBadge status={statusOf(kp)} label={kp.status === "loaded" ? "SWPC live" : undefined} />}
      >
        {!kpRows.length ? (
          kp.status === "error" ? (
            <p className="row-note tone-bad">NOAA SWPC could not be reached: {kp.error}</p>
          ) : (
            <p className="chart-empty">Loading Kp index…</p>
          )
        ) : (
          <>
            <div className="stat-row">
              <div>
                <span className="kpi-label">Latest · {fmtUtc(latestKp.ms)}</span>
                <strong className="num stat-big">Kp {fmtNum(latestKp.kp, 2)}</strong>
                <span className="kpi-sub">{gLevel(latestKp.kp)}</span>
              </div>
              <div>
                <span className="kpi-label">7-day maximum</span>
                <strong className={`num stat-big ${maxKp.kp >= 5 ? "tone-warm" : ""}`}>Kp {fmtNum(maxKp.kp, 2)}</strong>
                <span className="kpi-sub">
                  {gLevel(maxKp.kp)} · {fmtUtc(maxKp.ms)}
                </span>
              </div>
              <div>
                <span className="kpi-label">Storm intervals (Kp ≥ 5)</span>
                <strong className="num stat-big">{kpRows.filter((r) => r.kp >= 5).length}</strong>
                <span className="kpi-sub">of {kpRows.length} three-hour periods</span>
              </div>
            </div>
            <XYChart
              x={kpRows.map((r) => r.time)}
              xType="category"
              height={170}
              legend={false}
              series={[{ id: "kp", label: "Kp", type: "bar", color: SERIES_COLORS.green, colorAt: (v) => kpColor(v), values: kpRows.map((r) => r.kp) }]}
              thresholds={[{ value: 5, label: "G1 storm · Kp 5", color: SERIES_COLORS.amber }]}
              zeroBased
              formatX={(v) => `${v.slice(5, 10)} ${v.slice(11, 16)} UTC`}
              formatTick={(v) => v.slice(5, 10)}
              formatY={(v, tip) => fmtNum(v, tip ? 2 : 0)}
              ariaLabel="Planetary Kp index, 3-hourly, past 7 days"
            />
            <SourceLine href="https://www.swpc.noaa.gov/products/planetary-k-index" label="NOAA SWPC Kp">
              Bars: green quiet (Kp &lt; 4), blue active, amber G1–G2 storm, red G3+. Geomagnetic storms heat the
              upper atmosphere and raise drag on low-orbit satellites and debris.
            </SourceLine>
          </>
        )}
      </Panel>

      <Panel
        id="solar-cycle"
        title="Solar cycle"
        meta="NOAA SWPC · monthly sunspot number (SILSO) & F10.7 flux"
        actions={
          <>
            <RangeTabs value={from} onChange={setFrom} options={CYCLE_RANGES} label="Start year" />
            <StatusBadge status={statusOf(cycle)} label={cycle.status === "loaded" ? "SWPC live" : undefined} />
          </>
        }
      >
        {!cycleModel.rows.length ? (
          cycle.status === "error" ? (
            <p className="row-note tone-bad">NOAA SWPC could not be reached: {cycle.error}</p>
          ) : (
            <p className="chart-empty">Loading solar-cycle indices…</p>
          )
        ) : (
          <>
            <div className="stat-row">
              <div>
                <span className="kpi-label">Sunspot number · {cycleModel.latest.tag}</span>
                <strong className="num stat-big">{fmtNum(cycleModel.latest.ssn, 1)}</strong>
              </div>
              <div>
                <span className="kpi-label">F10.7 flux · {cycleModel.latest.tag}</span>
                <strong className="num stat-big">
                  {fmtNum(cycleModel.latest.f107, 1)}
                  <span className="kpi-unit">sfu</span>
                </strong>
              </div>
            </div>
            <XYChart
              x={cycleModel.x}
              series={cycleModel.series}
              height={170}
              shadeFrom={cycleModel.lastObsT}
              shadeLabel="prediction"
              formatX={(v, i) => cycleModel.rows[i].tag}
              formatY={(v, tip) => fmtNum(v, tip ? 1 : 0)}
              ariaLabel="Monthly sunspot number with smoothed values and NOAA prediction"
            />
            <XYChart
              x={cycleModel.x}
              series={cycleModel.f107}
              height={110}
              shadeFrom={cycleModel.lastObsT}
              unit="sfu"
              formatX={(v, i) => cycleModel.rows[i].tag}
              formatY={(v, tip) => fmtNum(v, tip ? 1 : 0)}
              ariaLabel="Monthly F10.7 solar radio flux"
            />
            <SourceLine href="https://www.swpc.noaa.gov/products/solar-cycle-progression" label="Solar cycle progression">
              Observed values and NOAA's predicted range as published. Higher solar activity expands the
              thermosphere, which shortens the orbital lifetime of low-orbit debris. This SWPC file carries F10.7 from {cycleModel.firstF107 || "—"}.
            </SourceLine>
          </>
        )}
      </Panel>
    </div>
  );
}
