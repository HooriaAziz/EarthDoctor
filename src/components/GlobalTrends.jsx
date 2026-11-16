import { useClimateData } from "../hooks/useClimateData";
import { EDGAR_GLOBAL } from "../assets/edgarGlobalData";
import { fmtNum, isNum } from "../lib/format";
import { SERIES_COLORS } from "../lib/colors";
import { Panel } from "./ui";
import { KpiCell, SignedNumber } from "./trends/common";
import { GasPanel, TemperaturePanel } from "./trends/ClimateIndicators";
import {
  EmissionsComposition,
  EmissionsKeyFigures,
  EmittersOverTime,
  IntensityPanel,
  LandUsePanel,
  SectorChanges,
  TopEmitters,
} from "./trends/GlobalEmissions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function gasKpi(remote, label, digits) {
  const latest = remote.data?.latest;
  if (!latest) {
    return (
      <KpiCell
        label={label}
        value={remote.status === "error" ? "Unavailable" : "…"}
        sub={remote.status === "error" ? "NOAA GML unreachable" : "Loading NOAA GML"}
        tone={remote.status === "error" ? "bad" : undefined}
      />
    );
  }
  const prior = remote.data.rows.find((r) => r.year === latest.year - 1 && r.month === latest.month);
  const yoy = prior && isNum(prior.avg) ? latest.avg - prior.avg : null;
  return (
    <KpiCell
      label={`${label} · ${MONTHS[latest.month - 1]} ${latest.year}`}
      value={fmtNum(latest.avg, digits)}
      unit={remote.data.unit}
      sub={
        <>
          <SignedNumber value={yoy} digits={digits} /> {remote.data.unit} vs a year earlier
        </>
      }
    />
  );
}

export default function GlobalTrends({ onSelectCountry }) {
  const { temp, co2, ch4, n2o } = useClimateData();
  const G = EDGAR_GLOBAL;
  const lastTemp = temp.data?.points?.at(-1);
  const lastYear = G.years.at(-1);
  const i1990 = G.years.indexOf(1990);

  return (
    <div className="section-body">
      <div className="page-head">
        <div>
          <h1>Global climate &amp; emissions trends</h1>
          <p className="page-context">
            Live NOAA climate indicators and the EDGAR 2026 greenhouse-gas inventory. Every series is shown as
            published; computed statistics are labelled.
          </p>
        </div>
      </div>

      <Panel id="planet-kpis" className="kpi-panel" title="Planetary indicators" meta="Latest published value of each record">
        <div className="kpi-strip">
          {lastTemp ? (
            <KpiCell
              label={`Global temperature · ${lastTemp.year}`}
              value={<SignedNumber value={lastTemp.value} digits={2} />}
              unit="°C"
              sub={`vs ${temp.data.basePeriod.replace("-", "–")} mean · NOAA NCEI`}
              tone="warm"
            />
          ) : (
            <KpiCell label="Global temperature" value={temp.status === "error" ? "Unavailable" : "…"} sub="NOAA NCEI" />
          )}
          {gasKpi(co2, "CO₂ Mauna Loa", 2)}
          {gasKpi(ch4, "CH₄ global", 1)}
          {gasKpi(n2o, "N₂O global", 2)}
          <KpiCell
            label={`GHG emissions · ${lastYear}`}
            value={fmtNum(G.totalMt.at(-1) / 1000, 1)}
            unit="Gt CO₂e"
            sub={
              <>
                <SignedNumber value={((G.totalMt.at(-1) - G.totalMt[i1990]) / G.totalMt[i1990]) * 100} digits={0} unit="%" /> since 1990 · EDGAR
              </>
            }
          />
          <KpiCell
            label={`Per person · ${lastYear}`}
            value={fmtNum(G.perCapitaT.at(-1), 2)}
            unit="t CO₂e"
            sub={`${fmtNum(G.perCapitaT[i1990], 2)} t in 1990 · EDGAR`}
          />
        </div>
      </Panel>

      <h2 className="section-label">Climate indicators · NOAA (live)</h2>
      <TemperaturePanel remote={temp} />
      <div className="grid-3">
        <GasPanel id="co2_mlo" remote={co2} color={SERIES_COLORS.blue} />
        <GasPanel id="ch4_gl" remote={ch4} color={SERIES_COLORS.green} />
        <GasPanel id="n2o_gl" remote={n2o} color={SERIES_COLORS.amber} />
      </div>

      <h2 className="section-label">Greenhouse-gas emissions · EDGAR 2026 (bundled)</h2>
      <div className="grid-main">
        <EmissionsComposition />
        <div className="side-col">
          <EmissionsKeyFigures />
        </div>
      </div>
      <div className="grid-2">
        <SectorChanges />
        <IntensityPanel />
      </div>
      <div className="grid-2">
        <TopEmitters onSelectCountry={onSelectCountry} />
        <EmittersOverTime />
      </div>
      <LandUsePanel />
    </div>
  );
}
