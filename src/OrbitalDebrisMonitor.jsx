import {
  Activity,
  AlertTriangle,
  ExternalLink,
  Orbit,
  Satellite,
} from "lucide-react";

import {
  ORBITAL_DEBRIS_SOURCE,
  ORBITAL_DEBRIS_OVERVIEW,
  ORBITAL_REGIME_DATA,
  ORBITAL_OBJECT_TYPES,
  ORBITAL_DEBRIS_HISTORICAL_SERIES,
  ORBITAL_DEBRIS_HISTORICAL_SOURCE,
} from "./assets/OrbitalDebrisData.js";

import TrendAnalysisPanel from "./TrendAnalysisPanel.jsx";
import "./OrbitalDebrisMonitor.css";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <article className="debris-stat-card">
      <div className="debris-stat-top">
        <span>{label}</span>
        {Icon && <Icon size={18} aria-hidden="true" />}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default function OrbitalDebrisMonitor() {
  const overview = ORBITAL_DEBRIS_OVERVIEW;
  const maxRegimeCount = Math.max(
    ...ORBITAL_REGIME_DATA.map((item) => item.objects)
  );

  const debrisTypes = ORBITAL_OBJECT_TYPES.filter((item) =>
    ["PF", "PD", "RF", "RD", "PM", "RM"].includes(item.code)
  );

  const debris1990 = ORBITAL_DEBRIS_HISTORICAL_SERIES.find(
    (item) => item.year === 1990
  );
  const latestHistorical = ORBITAL_DEBRIS_HISTORICAL_SERIES.at(-1);
  const since1990Percent =
    debris1990 && debris1990.value !== 0
      ? ((latestHistorical.value - debris1990.value) / debris1990.value) * 100
      : null;

  return (
    <section className="orbital-debris-section">
      <div className="debris-section-heading">
        <div>
          <div className="debris-eyebrow">
            <Orbit size={15} />
            EARTH ORBIT ENVIRONMENT
          </div>
          <h2>Orbital Debris Monitor</h2>
          <p>
            Monitoring human-made objects and debris surrounding Earth.
          </p>
        </div>
        <div className="debris-heading-icon">
          <Satellite size={25} />
        </div>
      </div>

      <div className="debris-stat-grid">
        <StatCard
          label="Tracked objects"
          value={formatNumber(overview.cataloguedObjects)}
          detail="Objects maintained in space surveillance catalogues"
          icon={Satellite}
        />
        <StatCard
          label="Debris, 1–10 cm"
          value={formatNumber(overview.estimatedDebris1To10cm)}
          detail="Model-based estimate"
          icon={AlertTriangle}
        />
        <StatCard
          label="Debris, 1 mm–1 cm"
          value={formatNumber(overview.estimatedDebris1mmTo1cm)}
          detail="Model-based estimate"
          icon={Activity}
        />
        <StatCard
          label="Mass in orbit"
          value={`>${formatNumber(overview.totalMassLowerBoundTonnes)} t`}
          detail="Estimated total mass of all space objects"
          icon={Orbit}
        />
      </div>

      <div className="debris-info-banner">
        <AlertTriangle size={19} />
        <p>
          Not all tracked objects are debris. The catalogue includes active
          satellites, rocket bodies, fragments, and unidentified objects.
          Smaller debris populations are estimated using statistical models,
          not individually tracked.
        </p>
      </div>

      <TrendAnalysisPanel
        title="Historical growth of catalogued debris"
        description="Year-end count of objects classified as debris, reconstructed from CelesTrak SATCAT launch and decay dates (1957–2025). Payloads and rocket bodies are not included in this series."
        points={ORBITAL_DEBRIS_HISTORICAL_SERIES}
        units="objects"
        valueDigits={0}
        slopeDigits={1}
        comparisonStartYear={1990}
        comparisonLabel="Change since 1990"
        interpretation={`The reconstructed debris-class count rose by ${formatNumber(latestHistorical.value - ORBITAL_DEBRIS_HISTORICAL_SERIES[0].value)} objects from 1957 to 2025. From the non-zero 1990 baseline (${formatNumber(debris1990?.value ?? 0)}), it changed by ${since1990Percent == null ? "an unavailable amount" : `${since1990Percent >= 0 ? "+" : ""}${since1990Percent.toFixed(1)}%`}. The annual record is a catalogue-based reconstruction, not a complete count of small untracked fragments.`}
        sourceName={ORBITAL_DEBRIS_HISTORICAL_SOURCE.name}
        sourceUrl={ORBITAL_DEBRIS_HISTORICAL_SOURCE.url}
        sourceNote={`Data snapshot retrieved ${ORBITAL_DEBRIS_HISTORICAL_SOURCE.retrieved}. The 2026 year-end value is excluded because it is not a completed year in that snapshot. This historical reconstruction and the current ESA catalogue snapshot above use different sources and definitions.`}
      />

      <div className="debris-content-grid">
        <article className="debris-panel">
          <div className="debris-panel-heading">
            <div>
              <h3>Objects by orbital region</h3>
              <p>Number of catalogued objects in each region</p>
            </div>
            <span className="debris-panel-tag">ESA catalogue</span>
          </div>

          <div className="debris-bars">
            {ORBITAL_REGIME_DATA.map((item) => (
              <div className="debris-bar-row" key={item.orbit}>
                <div className="debris-bar-label">
                  <strong>{item.orbit}</strong>
                  <span>{item.label}</span>
                </div>
                <div className="debris-bar-track">
                  <div
                    className="debris-bar-fill"
                    style={{
                      width: `${(item.objects / maxRegimeCount) * 100}%`,
                    }}
                  />
                </div>
                <strong className="debris-bar-value">
                  {formatNumber(item.objects)}
                </strong>
              </div>
            ))}
          </div>

          <p className="debris-chart-note">
            These counts include all catalogued object types, not debris alone.
          </p>
        </article>

        <article className="debris-panel">
          <div className="debris-panel-heading">
            <div>
              <h3>Object classification</h3>
              <p>Selected catalogue categories</p>
            </div>
            <span className="debris-panel-tag">ESA catalogue</span>
          </div>

          <div className="debris-type-list">
            {debrisTypes.map((item) => (
              <div className="debris-type-row" key={item.code}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.code}</span>
                </div>
                <strong>{formatNumber(item.objects)}</strong>
              </div>
            ))}
          </div>

          <p className="debris-chart-note">
            These are catalogue classifications. Some categories describe
            mission-related objects, while others describe fragments.
          </p>
        </article>
      </div>

      <div className="debris-source-footer">
        <div>
          <span className="debris-source-label">DATA SOURCE</span>
          <strong>{ORBITAL_DEBRIS_SOURCE.name}</strong>
          <p>
            {ORBITAL_DEBRIS_SOURCE.title} · Updated{" "}
            {ORBITAL_DEBRIS_SOURCE.lastUpdated}
          </p>
        </div>
        <a
          href={ORBITAL_DEBRIS_SOURCE.url}
          target="_blank"
          rel="noreferrer"
        >
          View official data <ExternalLink size={14} />
        </a>
      </div>
    </section>
  );
}
