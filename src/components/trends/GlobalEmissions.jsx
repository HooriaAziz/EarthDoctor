import { useMemo, useState } from "react";
import { Panel, StatusBadge } from "../ui";
import XYChart from "../XYChart";
import { EDGAR_GLOBAL } from "../../assets/edgarGlobalData";
import { EDGAR_COUNTRIES, EDGAR_SOURCE, EDGAR_YEARS } from "../../assets/edgarData";
import { analyzeTimeSeries } from "../../assets/earthTrendAnalysis";
import { compactNumber, fmtNum, isNum } from "../../lib/format";
import { CATEGORICAL, SERIES_COLORS } from "../../lib/colors";
import { RangeTabs, SignedNumber, SourceLine, Sparkline } from "./common";

const G = EDGAR_GLOBAL;
const YEARS = G.years;
const I = (year) => YEARS.indexOf(year);
const LAST = YEARS.at(-1);

const GAS_COLORS = { "CO₂": SERIES_COLORS.blue, "CH₄": SERIES_COLORS.green, "N₂O": SERIES_COLORS.amber, "F-gases": SERIES_COLORS.violet };

const pct = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? ((a - b) / b) * 100 : null);
const gt = (mt) => (isNum(mt) ? mt / 1000 : null);

const EDGAR_NOTE =
  "EDGAR 2026 (JRC). GHG = fossil CO₂, CH₄, N₂O, F-gases, GWP-100 AR5. Excludes land use (LULUCF), shown separately.";

function SourceEdgar() {
  return (
    <SourceLine href={EDGAR_SOURCE.reportUrl} label="EDGAR 2026 report">
      {EDGAR_NOTE}
    </SourceLine>
  );
}

function bundled() {
  return <StatusBadge status="connected" label="Bundled dataset" />;
}

// ------------------------------------------------------------ composition

const VIEWS = [
  { id: "gas", label: "By gas" },
  { id: "sector", label: "By sector" },
  { id: "total", label: "Total + bunkers" },
];

export function EmissionsComposition() {
  const [view, setView] = useState("gas");

  const series = useMemo(() => {
    if (view === "gas") {
      return ["CO₂", "CH₄", "N₂O", "F-gases"].map((gas) => ({
        id: gas,
        label: gas,
        type: "area",
        color: GAS_COLORS[gas],
        values: G.byGasMt[gas].map(gt),
      }));
    }
    if (view === "sector") {
      const order = Object.keys(G.bySectorMt).sort((a, b) => G.bySectorMt[b].at(-1) - G.bySectorMt[a].at(-1));
      return order.map((sector, k) => ({
        id: sector,
        label: sector,
        type: "area",
        color: CATEGORICAL[k % CATEGORICAL.length],
        values: G.bySectorMt[sector].map(gt),
      }));
    }
    return [
      { id: "total", label: "Global total (incl. bunkers)", type: "line", color: SERIES_COLORS.blue, values: G.totalMt.map(gt), width: 2 },
      { id: "air", label: "International aviation", type: "line", color: SERIES_COLORS.amber, values: G.aviationMt.map(gt) },
      { id: "sea", label: "International shipping", type: "line", color: SERIES_COLORS.ice, values: G.shippingMt.map(gt) },
      { id: "eu", label: "EU27", type: "line", color: SERIES_COLORS.green, values: G.eu27Mt.map(gt), dash: true },
    ];
  }, [view]);

  const trend = useMemo(
    () => analyzeTimeSeries(YEARS.map((year, i) => ({ year, value: G.totalMt[i] })).filter((p) => p.year >= 1990), { alpha: 0.05, minimumObservations: 8 }),
    []
  );

  return (
    <Panel
      id="edgar-composition"
      title="Global greenhouse-gas emissions"
      meta={`EDGAR 2026 · 1970–${LAST} · Gt CO₂e/yr`}
      actions={
        <>
          <RangeTabs value={view} onChange={setView} options={VIEWS} label="Breakdown" />
          {bundled()}
        </>
      }
    >
      <div className="stat-row">
        <div>
          <span className="kpi-label">{LAST} total</span>
          <strong className="num stat-big">
            {fmtNum(gt(G.totalMt.at(-1)), 1)}
            <span className="kpi-unit">Gt CO₂e</span>
          </strong>
        </div>
        <div>
          <span className="kpi-label">Since 1990</span>
          <strong className="num stat-big">
            <SignedNumber value={pct(G.totalMt.at(-1), G.totalMt[I(1990)])} digits={1} unit="%" />
          </strong>
          <span className="kpi-sub">
            {fmtNum(gt(G.totalMt[I(1990)]), 1)} → {fmtNum(gt(G.totalMt.at(-1)), 1)} Gt
          </span>
        </div>
        <div>
          <span className="kpi-label">Since 2015 (Paris Agreement)</span>
          <strong className="num stat-big">
            <SignedNumber value={pct(G.totalMt.at(-1), G.totalMt[I(2015)])} digits={1} unit="%" />
          </strong>
        </div>
        <div>
          <span className="kpi-label">Sen's slope 1990–{LAST}</span>
          <strong className="num stat-big">
            <SignedNumber value={trend.senSlopePerYear} digits={0} unit=" Mt" />
            <span className="kpi-unit">/yr</span>
          </strong>
        </div>
      </div>
      <XYChart
        x={YEARS}
        series={series}
        stacked={view !== "total"}
        height={240}
        unit="Gt CO₂e"
        formatY={(v, tip) => (tip ? fmtNum(v, 2) : fmtNum(v, 0))}
        ariaLabel={`Global greenhouse-gas emissions ${view === "total" ? "total with aviation, shipping and EU27" : `stacked by ${view}`}, 1970 to ${LAST}, gigatonnes CO2 equivalent`}
      />
      <SourceLine href={EDGAR_SOURCE.reportUrl} label="EDGAR 2026 report">
        {view === "sector"
          ? "Sector series are the workbook's GLOBAL TOTAL rows summed across gases. "
          : view === "gas"
            ? "Gas series are the workbook's GLOBAL TOTAL rows summed across sectors. "
            : "The global total includes international aviation and shipping. "}
        {EDGAR_NOTE}
      </SourceLine>
    </Panel>
  );
}

// ------------------------------------------------------------ key figures

export function EmissionsKeyFigures() {
  const rows = [
    { label: "Global total", unit: "Gt CO₂e", a: gt(G.totalMt[I(1990)]), b: gt(G.totalMt.at(-1)), d: 1 },
    { label: "Per person", unit: "t CO₂e", a: G.perCapitaT[I(1990)], b: G.perCapitaT.at(-1), d: 2 },
    {
      label: "Per GDP",
      unit: "t / k$",
      a: G.perGdp.values[G.perGdp.years.indexOf(1990)],
      b: G.perGdp.values.at(-1),
      d: 3,
    },
    { label: "CO₂", unit: "Gt", a: gt(G.byGasMt["CO₂"][I(1990)]), b: gt(G.byGasMt["CO₂"].at(-1)), d: 1 },
    { label: "CH₄", unit: "Gt CO₂e", a: gt(G.byGasMt["CH₄"][I(1990)]), b: gt(G.byGasMt["CH₄"].at(-1)), d: 2 },
    { label: "N₂O", unit: "Gt CO₂e", a: gt(G.byGasMt["N₂O"][I(1990)]), b: gt(G.byGasMt["N₂O"].at(-1)), d: 2 },
    { label: "F-gases", unit: "Gt CO₂e", a: gt(G.byGasMt["F-gases"][I(1990)]), b: gt(G.byGasMt["F-gases"].at(-1)), d: 2 },
    { label: "Int. aviation", unit: "Mt CO₂e", a: G.aviationMt[I(1990)], b: G.aviationMt.at(-1), d: 0 },
    { label: "Int. shipping", unit: "Mt CO₂e", a: G.shippingMt[I(1990)], b: G.shippingMt.at(-1), d: 0 },
    { label: "EU27", unit: "Gt CO₂e", a: gt(G.eu27Mt[I(1990)]), b: gt(G.eu27Mt.at(-1)), d: 2 },
  ];

  return (
    <Panel id="edgar-keys" title="Key figures" meta={`1990 vs ${LAST} · EDGAR 2026`} actions={bundled()}>
      <table className="data-table compact-table">
        <thead>
          <tr>
            <th scope="col">Indicator</th>
            <th scope="col" className="num-col">1990</th>
            <th scope="col" className="num-col">{LAST}</th>
            <th scope="col" className="num-col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const change = pct(row.b, row.a);
            return (
              <tr key={row.label}>
                <th scope="row">
                  {row.label} <span className="muted">· {row.unit}</span>
                </th>
                <td className="num num-col">{fmtNum(row.a, row.d)}</td>
                <td className="num num-col">{fmtNum(row.b, row.d)}</td>
                <td className={`num num-col ${change > 0 ? "delta-up" : change < 0 ? "delta-down" : ""}`}>
                  <SignedNumber value={change} digits={0} unit="%" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="row-note">
        Per-GDP intensity (t CO₂e per thousand USD, as published in the workbook) starts in 1990. Increases
        are shown in red and decreases in green, always with a sign.
      </p>
    </Panel>
  );
}

// ------------------------------------------------------------ sectors table

export function SectorChanges() {
  const sectors = Object.entries(G.bySectorMt)
    .map(([name, values]) => ({
      name,
      latest: values.at(-1),
      y1990: values[I(1990)],
      values,
    }))
    .sort((a, b) => b.latest - a.latest);
  const total = sectors.reduce((s, x) => s + x.latest, 0);
  const maxV = sectors[0].latest;

  return (
    <Panel id="edgar-sectors" title="Sectors" meta={`Share of ${LAST} total · change since 1990`} actions={bundled()}>
      <table className="data-table compact-table">
        <thead>
          <tr>
            <th scope="col">Sector</th>
            <th scope="col" className="col-bar">{LAST} · Gt CO₂e</th>
            <th scope="col" className="num-col">Share</th>
            <th scope="col" className="num-col">vs 1990</th>
            <th scope="col">1970–{LAST}</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s, k) => {
            const change = pct(s.latest, s.y1990);
            return (
              <tr key={s.name}>
                <th scope="row">{s.name}</th>
                <td className="col-bar">
                  <span className="inline-bar">
                    <span className="bar-track" aria-hidden="true">
                      <span style={{ width: `${(s.latest / maxV) * 100}%`, background: CATEGORICAL[k % CATEGORICAL.length] }} />
                    </span>
                    <span className="num">{fmtNum(gt(s.latest), 2)}</span>
                  </span>
                </td>
                <td className="num num-col">{fmtNum((s.latest / total) * 100, 1)}%</td>
                <td className={`num num-col ${change > 0 ? "delta-up" : "delta-down"}`}>
                  <SignedNumber value={change} digits={0} unit="%" />
                </td>
                <td>
                  <Sparkline values={s.values} color={CATEGORICAL[k % CATEGORICAL.length]} label={`${s.name} 1970 to ${LAST}`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SourceEdgar />
    </Panel>
  );
}

// ------------------------------------------------------------ emitters

const RANK_BY = [
  { id: "total", label: "Total" },
  { id: "pc", label: "Per person" },
  { id: "growth", label: "Growth since 1990" },
];

const countryRows = EDGAR_COUNTRIES.map((c) => {
  const series = c.annualEmissionsMtCO2e;
  const latest = series.at(-1);
  return {
    code: c.code,
    name: c.name,
    series,
    latest,
    y1990: series[EDGAR_YEARS.indexOf(1990)],
    perCapita: c.perCapitaTCO2e,
    population: isNum(latest) && isNum(c.perCapitaTCO2e) && c.perCapitaTCO2e > 0 ? latest / c.perCapitaTCO2e : null, // millions, derived
  };
}).filter((r) => isNum(r.latest));

const WORLD_EXCL_BUNKERS = G.totalMt.at(-1) - G.aviationMt.at(-1) - G.shippingMt.at(-1);

export function TopEmitters({ onSelectCountry }) {
  const [rankBy, setRankBy] = useState("total");
  const [count, setCount] = useState(15);

  const rows = useMemo(() => {
    let list = [...countryRows];
    if (rankBy === "pc") {
      // Avoid ranking micro-states: require ≥ 1 million people (derived from total / per-capita).
      list = list.filter((r) => isNum(r.population) && r.population >= 1);
      list.sort((a, b) => b.perCapita - a.perCapita);
    } else if (rankBy === "growth") {
      list = list.filter((r) => r.latest >= 50 && isNum(r.y1990) && r.y1990 > 0);
      list.sort((a, b) => pct(b.latest, b.y1990) - pct(a.latest, a.y1990));
    } else {
      list.sort((a, b) => b.latest - a.latest);
    }
    return list.slice(0, count);
  }, [rankBy, count]);

  const shareTop = rows.reduce((s, r) => s + r.latest, 0) / WORLD_EXCL_BUNKERS;

  return (
    <Panel
      id="edgar-emitters"
      title="Country ranking"
      meta={
        rankBy === "pc"
          ? `${LAST} · t CO₂e per person · countries ≥ 1 M people`
          : rankBy === "growth"
            ? `${LAST} vs 1990 · countries ≥ 50 Mt in ${LAST}`
            : `${LAST} · top ${count} = ${fmtNum(shareTop * 100, 1)}% of national totals`
      }
      actions={
        <>
          <RangeTabs value={rankBy} onChange={setRankBy} options={RANK_BY} label="Rank by" />
          <RangeTabs
            value={count}
            onChange={setCount}
            options={[
              { id: 15, label: "15" },
              { id: 30, label: "30" },
            ]}
            label="Rows"
          />
        </>
      }
    >
      <div className="table-wrap flush">
        <table className="data-table compact-table rank-table">
          <thead>
            <tr>
              <th scope="col" className="num-col">#</th>
              <th scope="col">Country</th>
              <th scope="col" className="num-col">Mt CO₂e</th>
              <th scope="col" className="num-col">Share</th>
              <th scope="col" className="num-col">t / person</th>
              <th scope="col" className="num-col">vs 1990</th>
              <th scope="col">1970–{LAST}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const change = pct(r.latest, r.y1990);
              return (
                <tr key={r.code}>
                  <td className="num num-col muted">{i + 1}</td>
                  <th scope="row">
                    {onSelectCountry ? (
                      <button type="button" className="row-btn" onClick={() => onSelectCountry(r)}>
                        {r.name}
                      </button>
                    ) : (
                      r.name
                    )}{" "}
                    <span className="mono muted">{r.code}</span>
                  </th>
                  <td className="num num-col">{compactNumber(r.latest, 1)}</td>
                  <td className="num num-col">{fmtNum((r.latest / WORLD_EXCL_BUNKERS) * 100, 1)}%</td>
                  <td className="num num-col">{fmtNum(r.perCapita, 1)}</td>
                  <td className={`num num-col ${change > 0 ? "delta-up" : "delta-down"}`}>
                    <SignedNumber value={change} digits={0} unit="%" />
                  </td>
                  <td>
                    <Sparkline values={r.series} label={`${r.name} emissions 1970 to ${LAST}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SourceLine href={EDGAR_SOURCE.reportUrl} label="EDGAR 2026 report">
        Shares are of the sum of national totals (excluding international aviation and shipping). Population
        used for the per-person filter is derived as total ÷ per-capita value.
      </SourceLine>
    </Panel>
  );
}

export function EmittersOverTime() {
  const top = useMemo(() => [...countryRows].sort((a, b) => b.latest - a.latest).slice(0, 6), []);
  const series = useMemo(
    () => [
      ...top.map((r, k) => ({ id: r.code, label: r.name, type: "line", color: CATEGORICAL[k], values: r.series.map(gt) })),
      { id: "EU27", label: "EU27", type: "line", color: SERIES_COLORS.slate, dash: true, values: G.eu27Mt.map(gt) },
    ],
    [top]
  );
  return (
    <Panel id="edgar-top-lines" title="Largest emitters over time" meta={`Top 6 in ${LAST} + EU27 · Gt CO₂e/yr`} actions={bundled()}>
      <XYChart
        x={YEARS}
        series={series}
        height={250}
        unit="Gt CO₂e"
        formatY={(v, tip) => (tip ? fmtNum(v, 2) : fmtNum(v, 0))}
        ariaLabel={`Annual emissions of the six largest emitters and the EU27, 1970 to ${LAST}`}
      />
      <SourceEdgar />
    </Panel>
  );
}

// ------------------------------------------------------------ intensity

export function IntensityPanel() {
  const pcSeries = useMemo(
    () => [{ id: "pc", label: "Per person", type: "area", color: SERIES_COLORS.blue, values: G.perCapitaT }],
    []
  );
  const gdpSeries = useMemo(
    () => [{ id: "gdp", label: "Per GDP", type: "area", color: SERIES_COLORS.green, values: G.perGdp.values }],
    []
  );
  return (
    <Panel id="edgar-intensity" title="Emission intensity" meta="World · per person and per unit of GDP" actions={bundled()}>
      <div className="mini-grid">
        <figure className="chart-cell">
          <figcaption className="chart-cell-head">
            <span className="chart-title">t CO₂e per person</span>
            <span className="chart-stats mono">
              {LAST} <strong>{fmtNum(G.perCapitaT.at(-1), 2)}</strong> · 1970 {fmtNum(G.perCapitaT[0], 2)}
            </span>
          </figcaption>
          <XYChart x={YEARS} series={pcSeries} height={140} unit="t" zeroBased formatY={(v, tip) => fmtNum(v, tip ? 2 : 0)} ariaLabel="Global greenhouse-gas emissions per person, tonnes CO2 equivalent" />
        </figure>
        <figure className="chart-cell">
          <figcaption className="chart-cell-head">
            <span className="chart-title">t CO₂e per k USD of GDP</span>
            <span className="chart-stats mono">
              {LAST} <strong>{fmtNum(G.perGdp.values.at(-1), 3)}</strong> · 1990 {fmtNum(G.perGdp.values[0], 3)}
            </span>
          </figcaption>
          <XYChart x={G.perGdp.years} series={gdpSeries} height={140} unit="t/k$" zeroBased formatY={(v, tip) => fmtNum(v, tip ? 3 : 2)} ariaLabel="Global greenhouse-gas emissions per thousand dollars of GDP" />
        </figure>
      </div>
      <SourceEdgar />
    </Panel>
  );
}

// ------------------------------------------------------------ LULUCF

export function LandUsePanel() {
  const L = G.lulucf;
  const [view, setView] = useState("components");
  const series = useMemo(() => {
    if (view === "regions") {
      return Object.entries(L.netByRegionMt)
        .filter(([region]) => region !== "EU27")
        .sort((a, b) => Math.abs(b[1].at(-1)) - Math.abs(a[1].at(-1)))
        .map(([region, values], k) => ({
          id: region,
          label: region,
          type: "line",
          color: [...CATEGORICAL, SERIES_COLORS.slate, "#5EEAD4"][k],
          values: values.map(gt),
        }));
    }
    return [
      ...Object.entries(L.componentsMt).map(([name, values], k) => ({
        id: name,
        label: name,
        type: "bar",
        color: [SERIES_COLORS.red, SERIES_COLORS.orange, SERIES_COLORS.green, SERIES_COLORS.amber, SERIES_COLORS.ice][k],
        values: values.map(gt),
      })),
    ];
  }, [view, L]);

  const netSeries = useMemo(
    () => [{ id: "net", label: "Net LULUCF", type: "line", color: SERIES_COLORS.slate, values: L.netMt.map(gt), width: 2 }],
    [L]
  );

  return (
    <Panel
      id="edgar-lulucf"
      title="Land use, land-use change & forestry"
      meta={`EDGAR 2026 · ${L.years[0]}–${L.years.at(-1)} · Gt CO₂e/yr · negative = net removal`}
      actions={
        <RangeTabs
          value={view}
          onChange={setView}
          options={[
            { id: "components", label: "Sources & sinks" },
            { id: "regions", label: "Net by region" },
          ]}
          label="Land-use view"
        />
      }
    >
      <div className="stat-row">
        <div>
          <span className="kpi-label">Global net {L.years.at(-1)}</span>
          <strong className="num stat-big">
            <SignedNumber value={gt(L.netMt.at(-1))} digits={2} unit=" Gt" />
          </strong>
        </div>
        <div>
          <span className="kpi-label">Global net {L.years[0]}</span>
          <strong className="num stat-big">
            <SignedNumber value={gt(L.netMt[0])} digits={2} unit=" Gt" />
          </strong>
        </div>
        <div>
          <span className="kpi-label">Deforestation {L.years.at(-1)}</span>
          <strong className="num stat-big">
            <SignedNumber value={gt(L.componentsMt.Deforestation?.at(-1))} digits={2} unit=" Gt" />
          </strong>
        </div>
      </div>
      {view === "components" ? (
        <>
          <XYChart
            x={L.years}
            series={series}
            stacked
            height={210}
            unit="Gt CO₂e"
            xType="year"
            formatY={(v, tip) => (tip ? fmtNum(v, 2) : fmtNum(v, 0))}
            ariaLabel="Land-use emissions and removals by component"
          />
          <h3 className="subhead">Net land-use flux</h3>
          <XYChart x={L.years} series={netSeries} height={90} unit="Gt CO₂e" legend={false} formatY={(v, tip) => fmtNum(v, tip ? 2 : 1)} ariaLabel="Global net land-use flux" />
        </>
      ) : (
        <XYChart
          x={L.years}
          series={series}
          height={250}
          unit="Gt CO₂e"
          formatY={(v, tip) => (tip ? fmtNum(v, 2) : fmtNum(v, 1))}
          ariaLabel="Net land-use flux by macro-region"
        />
      )}
      <SourceLine href={EDGAR_SOURCE.reportUrl} label="EDGAR 2026 report">
        LULUCF is reported separately from the national GHG totals above and is not included in them. Fires
        combine the CO₂, CH₄ and N₂O rows of the workbook.
      </SourceLine>
    </Panel>
  );
}
