import { AlertTriangle, ExternalLink } from "lucide-react";

import {
  ORBITAL_DEBRIS_SOURCE,
  ORBITAL_DEBRIS_OVERVIEW,
  ORBITAL_REGIME_DATA,
  ORBITAL_OBJECT_TYPES,
  ORBITAL_DEBRIS_HISTORICAL_SERIES,
  ORBITAL_DEBRIS_HISTORICAL_SOURCE,
} from "./assets/OrbitalDebrisData.js";

import TrendAnalysisPanel from "./TrendAnalysisPanel.jsx";
import { Panel, StatusBadge, Tag } from "./components/ui";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function compact(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function OrbitalDebrisMonitor({ visual = null }) {
  const overview = ORBITAL_DEBRIS_OVERVIEW;
  const regimes = [...ORBITAL_REGIME_DATA].sort((a, b) => b.objects - a.objects);
  const maxRegimeCount = regimes[0]?.objects || 1;
  const regimeTotal = regimes.reduce((sum, item) => sum + item.objects, 0);

  const debrisTypes = ORBITAL_OBJECT_TYPES.filter((item) =>
    ["PF", "PD", "RF", "RD", "PM", "RM"].includes(item.code)
  ).sort((a, b) => b.objects - a.objects);
  const maxType = debrisTypes[0]?.objects || 1;

  const series = ORBITAL_DEBRIS_HISTORICAL_SERIES;
  const debris1990 = series.find((item) => item.year === 1990);
  const latestHistorical = series.at(-1);
  const since1990Percent =
    debris1990 && debris1990.value !== 0
      ? ((latestHistorical.value - debris1990.value) / debris1990.value) * 100
      : null;

  return (
    <>
      <div className="grid-main">
        <div className="ae-visual">{visual}</div>

        <div className="side-col">
          <Panel
            id="debris-snapshot"
            title="Space environment snapshot"
            meta={`${ORBITAL_DEBRIS_SOURCE.name} · updated ${ORBITAL_DEBRIS_SOURCE.lastUpdated}`}
            actions={<StatusBadge status="connected" label="Published snapshot" />}
          >
            <div className="kpi-pair">
              <div className="kpi">
                <span className="kpi-label">Catalogued objects</span>
                <span className="kpi-value num">{formatNumber(overview.cataloguedObjects)}</span>
                <span className="kpi-sub">All tracked types · not debris only</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Mass in orbit</span>
                <span className="kpi-value num">
                  &gt;{formatNumber(overview.totalMassLowerBoundTonnes)}
                  <span className="kpi-unit">t</span>
                </span>
                <span className="kpi-sub">All space objects · lower bound</span>
              </div>
            </div>

            <dl className="metric-grid metric-grid-2">
              <div className="metric">
                <dt>Objects &gt;10 cm</dt>
                <dd>
                  <span className="num metric-value">{compact(overview.estimatedObjectsGreaterThan10cm)}</span>
                  <Tag tone="info">Model</Tag>
                </dd>
              </div>
              <div className="metric">
                <dt>Debris 1–10 cm</dt>
                <dd>
                  <span className="num metric-value">{compact(overview.estimatedDebris1To10cm)}</span>
                  <Tag tone="info">Model</Tag>
                </dd>
              </div>
              <div className="metric">
                <dt>Debris 1 mm–1 cm</dt>
                <dd>
                  <span className="num metric-value">{compact(overview.estimatedDebris1mmTo1cm)}</span>
                  <Tag tone="info">Model</Tag>
                </dd>
              </div>
              <div className="metric">
                <dt>Fragmentation events</dt>
                <dd>
                  <span className="num metric-value">&gt;{formatNumber(overview.fragmentationEventsLowerBound)}</span>
                </dd>
              </div>
            </dl>

            <p className="row-note">
              <AlertTriangle size={12} aria-hidden="true" /> The catalogue includes active satellites, rocket
              bodies and fragments. Populations below ~10 cm are statistical model estimates, not
              individually tracked objects.
            </p>
          </Panel>

          <Panel
            id="debris-regimes"
            title="Catalogued objects by orbital region"
            meta={`${formatNumber(regimeTotal)} objects · all types`}
          >
            <ul className="bar-list bar-list-wide">
              {regimes.map((item) => (
                <li key={item.orbit} title={item.label}>
                  <span className="bar-label">
                    <strong className="mono">{item.orbit}</strong>
                    <span className="muted">{item.label}</span>
                  </span>
                  <span className="bar-track" aria-hidden="true">
                    <span style={{ width: `${(item.objects / maxRegimeCount) * 100}%` }} />
                  </span>
                  <span className="num bar-value">{formatNumber(item.objects)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid-2">
        <TrendAnalysisPanel
          title="Historical growth of catalogued debris"
          description="Year-end count of objects classified as debris, reconstructed from CelesTrak SATCAT launch and decay dates (1957–2025). Payloads and rocket bodies are not included."
          points={series}
          units="objects"
          valueDigits={0}
          slopeDigits={1}
          comparisonStartYear={1990}
          comparisonLabel="Change since 1990"
          interpretation={`The reconstructed debris-class count rose by ${formatNumber(latestHistorical.value - series[0].value)} objects from 1957 to 2025. From the non-zero 1990 baseline (${formatNumber(debris1990?.value ?? 0)}), it changed by ${since1990Percent == null ? "an unavailable amount" : `${since1990Percent >= 0 ? "+" : ""}${since1990Percent.toFixed(1)}%`}. The annual record is a catalogue-based reconstruction, not a complete count of small untracked fragments.`}
          sourceName={ORBITAL_DEBRIS_HISTORICAL_SOURCE.name}
          sourceUrl={ORBITAL_DEBRIS_HISTORICAL_SOURCE.url}
          sourceNote={`Data snapshot retrieved ${ORBITAL_DEBRIS_HISTORICAL_SOURCE.retrieved}. The 2026 year-end value is excluded because it is not a completed year in that snapshot. This reconstruction and the ESA snapshot use different sources and definitions.`}
        />

        <Panel
          id="debris-types"
          title="Debris-related catalogue classes"
          meta="ESA DISCOS object classification"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col" className="mono">Code</th>
                <th scope="col" className="col-bar">Share of max</th>
                <th scope="col" className="num-col">Objects</th>
              </tr>
            </thead>
            <tbody>
              {debrisTypes.map((item) => (
                <tr key={item.code}>
                  <td>{item.label}</td>
                  <td className="mono muted">{item.code}</td>
                  <td className="col-bar">
                    <span className="bar-track" aria-hidden="true">
                      <span style={{ width: `${(item.objects / maxType) * 100}%` }} />
                    </span>
                  </td>
                  <td className="num num-col">{formatNumber(item.objects)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="row-note">
            Classes describe object origin: payload or rocket-body fragmentation debris, mission-related
            objects, and other debris.
          </p>
          <p className="row-note">
            Source:{" "}
            <a href={ORBITAL_DEBRIS_SOURCE.url} target="_blank" rel="noreferrer">
              {ORBITAL_DEBRIS_SOURCE.title} <ExternalLink size={11} aria-hidden="true" />
            </a>{" "}
            · {ORBITAL_DEBRIS_SOURCE.dataType}
          </p>
        </Panel>
      </div>
    </>
  );
}
