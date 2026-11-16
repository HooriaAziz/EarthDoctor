import { BookOpen } from "lucide-react";
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
import "./GlobalTrends.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHAIN = [
  { title: "People release gases", text: "Fuel, farming, factories and land clearing" },
  { title: "Gases collect in the air", text: "They mix into the atmosphere and stay" },
  { title: "Extra heat is trapped", text: "Less of the Sun's warmth escapes to space" },
  { title: "Earth warms", text: "Seen in the global temperature record" },
];

const JUMPS = [
  { href: "#trends-emissions", label: "What we release" },
  { href: "#trends-countries", label: "Who emits" },
  { href: "#trends-gases", label: "Gases in the air" },
  { href: "#trends-temperature", label: "Temperature" },
];

const GLOSSARY = [
  { term: "Greenhouse gas", text: "A gas that traps heat in the atmosphere, like a blanket around the planet." },
  { term: "CO₂e (carbon-dioxide equivalent)", text: "A common unit that converts every greenhouse gas into the amount of CO₂ that would cause the same warming." },
  { term: "Mt and Gt", text: "Mt is a million tonnes. Gt is a billion tonnes." },
  { term: "ppm and ppb", text: "Parts per million and parts per billion: how many molecules of a gas there are among a million (or a billion) molecules of air." },
  { term: "Temperature anomaly", text: "How much warmer or cooler a year was compared with the average of a reference period. It is not the actual temperature." },
  { term: "Per person (per capita)", text: "A country's total divided by its population, so large and small countries can be compared fairly." },
  { term: "Inventory vs. measurement", text: "Emissions are estimated from fuel and activity data. Gas levels and temperatures are measured by instruments." },
];

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

function TrendSection({ id, title, lead, points, children }) {
  return (
    <section className="trends-section" id={id} aria-labelledby={`${id}-title`}>
      <header className="trends-section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="trends-lead">{lead}</p>
      </header>
      {points?.length > 0 && (
        <dl className="trends-explainer">
          {points.map((point) => (
            <div key={point.term}>
              <dt>{point.term}</dt>
              <dd>{point.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </section>
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
          <h1>Is our planet changing?</h1>
          <p className="page-context">
            Live climate measurements from NOAA and the EDGAR 2026 greenhouse-gas inventory, grouped so related
            charts sit together. Each section explains what its charts show.
          </p>
        </div>
      </div>

      <div className="trends-intro">
        <div>
          <h2>How the pieces fit together</h2>
          <p>
            Climate change follows a chain of cause and effect. The sections below follow that chain from
            start to finish. Natural effects such as El Niño also move temperatures from year to year, so
            look at the long-term direction rather than a single year.
          </p>
        </div>
        <ol className="trends-flow" aria-label="Chain from emissions to warming">
          {CHAIN.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
        <nav className="trends-jump" aria-label="Jump to a section">
          {JUMPS.map((jump) => (
            <a key={jump.href} href={jump.href}>
              {jump.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="grid-2 trends-kpis" style={{ marginTop: 16 }}>
        <Panel id="planet-kpis" className="kpi-panel" title="Measured in the real world" meta="Live from NOAA · latest value">
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
          </div>
          <p className="row-note">
            Gas levels are compared with the same month a year earlier, because they rise and fall with the
            seasons. Temperature is shown as a difference from an average, not a thermometer reading.
          </p>
        </Panel>

        <Panel id="emissions-kpis" className="kpi-panel" title="Estimated from reports" meta={`EDGAR 2026 · ${lastYear}`}>
          <div className="kpi-strip">
            <KpiCell
              label={`GHG emissions · ${lastYear}`}
              value={fmtNum(G.totalMt.at(-1) / 1000, 1)}
              unit="Gt CO₂e"
              sub={
                <>
                  <SignedNumber value={((G.totalMt.at(-1) - G.totalMt[i1990]) / G.totalMt[i1990]) * 100} digits={0} unit="%" /> since 1990
                </>
              }
            />
            <KpiCell
              label={`Per person · ${lastYear}`}
              value={fmtNum(G.perCapitaT.at(-1), 2)}
              unit="t CO₂e"
              sub={`${fmtNum(G.perCapitaT[i1990], 2)} t in 1990`}
            />
          </div>
          <p className="row-note">
            These are careful estimates built from fuel, industry and farming data for every country, not
            readings from a meter. One Gt is a billion tonnes.
          </p>
        </Panel>
      </div>

      <TrendSection
        id="trends-emissions"
        title="What we release: greenhouse-gas emissions"
        lead="Burning coal, oil and gas, farming, making cement and clearing forests all release greenhouse gases. This section adds up what is released worldwide each year and shows which activities release the most."
        points={[
          { term: "Where the numbers come from", text: "EDGAR, a database from the European Commission's Joint Research Centre, estimates emissions for every country using fuel use, factory output and farm statistics." },
          { term: "Reading the units", text: "Emissions are in CO₂e, which converts methane, nitrous oxide and other gases into the amount of CO₂ that would warm the planet as much. Mt means million tonnes and Gt means billion tonnes." },
          { term: "What a sector is", text: "A sector is a type of activity, such as electricity, transport, industry, buildings or agriculture. Comparing sectors shows where cutting emissions would help most." },
          { term: "Land use", text: "Forests and farmland can release carbon when they are cleared or soak it up when they grow, so land use is shown alongside the sectors." },
        ]}
      >
        <div className="grid-main">
          <EmissionsComposition />
          <div className="side-col">
            <EmissionsKeyFigures />
          </div>
        </div>
        <SectorChanges />
        <LandUsePanel />
      </TrendSection>

      <TrendSection
        id="trends-countries"
        title="Who emits, and how efficiently"
        lead="Totals tell only part of the story. Big countries emit more in total, while some small countries emit more per person. These panels compare countries over time and relative to their size."
        points={[
          { term: "Total vs. per person", text: "A country can rank high in total just because it has many people. Looking at emissions per person as well gives a fairer comparison." },
          { term: "Intensity", text: "Intensity compares emissions with the size of a population or economy, which shows how much is emitted relative to what a country produces or uses." },
          { term: "Explore a country", text: "Select a country in the top-emitters list to open its full emissions profile and action ideas on the Inside Earth page." },
        ]}
      >
        <div className="grid-2">
          <TopEmitters onSelectCountry={onSelectCountry} />
          <EmittersOverTime />
        </div>
        <IntensityPanel />
      </TrendSection>

      <TrendSection
        id="trends-gases"
        title="What builds up: greenhouse gases in the air"
        lead="Gases we release do not disappear. They mix into the atmosphere, and NOAA measures how much of each is there. These three live records show the heat-trapping gases that matter most."
        points={[
          { term: "CO₂ (carbon dioxide)", text: "Mostly from burning coal, oil and gas. It is the biggest driver of warming because so much is released and it lingers for centuries. Measured at Mauna Loa, Hawaii, in parts per million (ppm)." },
          { term: "CH₄ (methane)", text: "From farm animals, rice fields, landfills, wetlands and gas leaks. Each molecule traps far more heat than CO₂, but methane breaks down in about 12 years. Measured in parts per billion (ppb)." },
          { term: "N₂O (nitrous oxide)", text: "Mostly from fertilizers and animal manure. It traps heat, lasts over a century and also harms the ozone layer. Measured in parts per billion (ppb)." },
          { term: "Why the lines wiggle", text: "CO₂ rises and falls a little each year as plants in the Northern Hemisphere grow and rest. The long-term climb matters more than the yearly wiggle." },
        ]}
      >
        <div className="grid-3">
          <GasPanel id="co2_mlo" remote={co2} color={SERIES_COLORS.blue} />
          <GasPanel id="ch4_gl" remote={ch4} color={SERIES_COLORS.green} />
          <GasPanel id="n2o_gl" remote={n2o} color={SERIES_COLORS.amber} />
        </div>
      </TrendSection>

      <TrendSection
        id="trends-temperature"
        title="The result: a warming planet"
        lead="More heat-trapping gas means more of the Sun's warmth stays near Earth's surface. Global temperature is the clearest sign of that effect, and it is measured separately from the gas records above."
        points={[
          { term: "What an anomaly is", text: "The chart shows how much warmer or cooler each year was than the average of a reference period. Above zero means warmer than that average. It is not the actual temperature." },
          { term: "Why single years vary", text: "Natural patterns such as El Niño make some years warmer or cooler. Scientists look at the direction over decades, not one year." },
          { term: "Where it comes from", text: "NOAA's National Centers for Environmental Information combines land and ocean measurements from around the world." },
        ]}
      >
        <TemperaturePanel remote={temp} />
      </TrendSection>

      <details className="panel background-details" style={{ marginTop: 36 }}>
        <summary>
          <BookOpen size={14} aria-hidden="true" /> Words to know
        </summary>
        <dl className="trends-glossary">
          {GLOSSARY.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}