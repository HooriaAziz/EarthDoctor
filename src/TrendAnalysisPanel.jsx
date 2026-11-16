import { useMemo } from "react";
import { analyzeTimeSeries } from "./assets/earthTrendAnalysis.js";
import "./TrendAnalysisPanel.css";

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSigned(value, digits = 2) {
  if (!Number.isFinite(value)) return "Not available";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

function formatPValue(value) {
  if (!Number.isFinite(value)) return "Not available";
  if (value < 0.0001) return "< 0.0001";
  return formatNumber(value, 4);
}

function formatAxis(value, digits = 1) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 10000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatNumber(value, digits);
}

function buildChart(points) {
  if (!points || points.length < 2) return null;

  const width = 820;
  const height = 300;
  const margin = { top: 18, right: 24, bottom: 48, left: 78 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const startYear = points[0].year;
  const endYear = points[points.length - 1].year;
  const yearRange = Math.max(1, endYear - startYear);

  const rawMin = Math.min(...points.map((point) => point.value));
  const rawMax = Math.max(...points.map((point) => point.value));
  const minValue = rawMin >= 0 ? 0 : rawMin - Math.abs(rawMin) * 0.08;
  const maxValue =
    rawMax === minValue ? rawMax + 1 : rawMax + (rawMax - minValue) * 0.1;

  const x = (year) =>
    margin.left + ((year - startYear) / yearRange) * plotWidth;
  const y = (value) =>
    margin.top +
    plotHeight -
    ((value - minValue) / (maxValue - minValue)) * plotHeight;

  const chartPoints = points.map((point) => ({
    ...point,
    x: x(point.year),
    y: y(point.value),
  }));

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = minValue + ((maxValue - minValue) / 4) * index;
    return { value, y: y(value) };
  });

  const xTicks = [...new Set(
    [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
      Math.round(startYear + yearRange * fraction)
    )
  )];

  return {
    width,
    height,
    margin,
    plotWidth,
    plotHeight,
    chartPoints,
    linePoints: chartPoints.map((point) => `${point.x},${point.y}`).join(" "),
    yTicks,
    xTicks,
    x,
  };
}

export default function TrendAnalysisPanel({
  title,
  description,
  points,
  units,
  valueDigits = 2,
  slopeDigits = 3,
  comparisonStartYear = null,
  comparisonLabel = null,
  interpretation = null,
  sourceName = null,
  sourceUrl = null,
  sourceNote = null,
}) {
  const cleanPoints = useMemo(
    () =>
      (Array.isArray(points) ? points : [])
        .filter(
          (point) =>
            point &&
            Number.isFinite(Number(point.year)) &&
            Number.isFinite(Number(point.value))
        )
        .map((point) => ({
          year: Number(point.year),
          value: Number(point.value),
        }))
        .sort((a, b) => a.year - b.year),
    [points]
  );

  const result = useMemo(
    () => analyzeTimeSeries(cleanPoints, { alpha: 0.05, minimumObservations: 8 }),
    [cleanPoints]
  );

  const chart = useMemo(() => buildChart(cleanPoints), [cleanPoints]);

  if (result.status !== "ok") {
    return (
      <section className="trend-analysis-panel">
        <div className="trend-panel-heading">
          <div>
            <p className="trend-panel-eyebrow">How it changed over time</p>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
        <p className="trend-insufficient">
          {result.message || "There are not enough valid observations for trend analysis."}
        </p>
      </section>
    );
  }

  const comparisonPoint =
    comparisonStartYear == null
      ? cleanPoints[0]
      : cleanPoints.find((point) => point.year === comparisonStartYear);

  const comparisonPercent =
    comparisonPoint && comparisonPoint.value !== 0
      ? ((result.lastValue - comparisonPoint.value) /
          Math.abs(comparisonPoint.value)) *
        100
      : null;

  const percentCardLabel =
    comparisonStartYear == null
      ? "Change from first observation"
      : comparisonLabel || `Change since ${comparisonStartYear}`;

  const kidSummary = !result.isSignificant
    ? "This one goes up and down, so scientists can't say it is clearly rising or falling."
    : result.direction === "increasing"
      ? "Over the years, this number has mostly been going up ▲"
      : result.direction === "decreasing"
        ? "Over the years, this number has mostly been going down ▼"
        : "Over the years, this number has stayed about the same.";

  const ci = result.senSlopeConfidenceInterval;
  const significanceText = result.isSignificant
    ? "Statistically significant at α = 0.05"
    : "Not statistically significant at α = 0.05";

  return (
    <section className="trend-analysis-panel">
      <div className="trend-panel-heading">
        <div>
          <p className="trend-panel-eyebrow">How it changed over time</p>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <span className={`trend-direction-pill ${result.isSignificant ? result.direction : ""}`}>
          {result.isSignificant ? result.direction : "no significant trend"}
        </span>
      </div>

      <p className="trend-kid-summary">{kidSummary}</p>

      <div className="trend-stat-grid">
        <article className="trend-stat-card">
          <span>Net change · {result.startYear}–{result.endYear}</span>
          <strong>
            {formatSigned(result.observedChange, valueDigits)} {units}
          </strong>
          <small>
            {formatNumber(result.firstValue, valueDigits)} →{" "}
            {formatNumber(result.lastValue, valueDigits)} {units}
          </small>
        </article>

        <article className="trend-stat-card">
          <span>{percentCardLabel}</span>
          <strong>
            {comparisonPercent == null
              ? "Not defined"
              : `${formatSigned(comparisonPercent, 1)}%`}
          </strong>
          <small>
            {comparisonPoint
              ? `${comparisonPoint.year}: ${formatNumber(comparisonPoint.value, valueDigits)} ${units}`
              : "The comparison baseline is unavailable"}
          </small>
        </article>

        <article className="trend-stat-card">
          <span>Sen's slope</span>
          <strong>
            {formatSigned(result.senSlopePerYear, slopeDigits)} {units}/year
          </strong>
          <small>
            {formatSigned(result.senSlopePerDecade, slopeDigits)} {units}/decade
          </small>
        </article>

        <article className="trend-stat-card">
          <span>Mann–Kendall p-value</span>
          <strong>{formatPValue(result.pValue)}</strong>
          <small>{significanceText}</small>
        </article>
      </div>

      <div className="trend-chart-wrap">
        {chart ? (
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={`${title} annual time series from ${result.startYear} to ${result.endYear}`}
          >
            {chart.yTicks.map((tick, index) => (
              <g key={`y-${index}`}>
                <line
                  className="trend-gridline"
                  x1={chart.margin.left}
                  y1={tick.y}
                  x2={chart.width - chart.margin.right}
                  y2={tick.y}
                />
                <text
                  className="trend-axis-label"
                  x={chart.margin.left - 11}
                  y={tick.y + 4}
                  textAnchor="end"
                >
                  {formatAxis(tick.value, valueDigits)}
                </text>
              </g>
            ))}

            <line
              className="trend-axis-line"
              x1={chart.margin.left}
              y1={chart.height - chart.margin.bottom}
              x2={chart.width - chart.margin.right}
              y2={chart.height - chart.margin.bottom}
            />

            <polyline
              className="trend-series-line"
              points={chart.linePoints}
            />

            {chart.chartPoints.map((point) => (
              <circle
                key={point.year}
                className="trend-series-point"
                cx={point.x}
                cy={point.y}
                r={chart.chartPoints.length > 40 ? 2 : 3.5}
              >
                <title>
                  {point.year}: {formatNumber(point.value, valueDigits)} {units}
                </title>
              </circle>
            ))}

            {chart.xTicks.map((year) => (
              <text
                key={`x-${year}`}
                className="trend-axis-label"
                x={chart.x(year)}
                y={chart.height - chart.margin.bottom + 25}
                textAnchor="middle"
              >
                {year}
              </text>
            ))}
          </svg>
        ) : (
          <p className="trend-insufficient">
            At least two valid annual observations are needed to draw this chart.
          </p>
        )}
      </div>

      {interpretation && (
        <p className="trend-interpretation">{interpretation}</p>
      )}

      <details className="trend-grownups">
        <summary>For grown-ups and scientists: the math behind this</summary>
      <div className="trend-analysis-details">
        <div>
          <span>95% Sen slope confidence interval</span>
          <strong>
            {ci
              ? `${formatSigned(ci.lowerPerYear, slopeDigits)} to ${formatSigned(ci.upperPerYear, slopeDigits)} ${units}/year`
              : "Not available"}
          </strong>
        </div>
        <div>
          <span>Observations</span>
          <strong>
            {result.sampleSize} annual values
            {result.dataQuality.missingCalendarYears > 0
              ? ` · ${result.dataQuality.missingCalendarYears} missing year`
              : ""}
          </strong>
        </div>
        <div>
          <span>Kendall's tau</span>
          <strong>{formatNumber(result.mannKendallTau, 3)}</strong>
        </div>
      </div>

      <p className="trend-method-note">
        Method: Mann–Kendall trend test with Sen's slope. The p-value is a
        two-sided asymptotic approximation. Serial autocorrelation is not
        adjusted for, so interpret significance as exploratory rather than
        definitive. The Sen slope interval is approximate.
      </p>
      </details>

      {sourceNote && <p className="trend-source-note">{sourceNote}</p>}
      {sourceName && (
        <p className="trend-source-link">
          Source:{" "}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              {sourceName}
            </a>
          ) : (
            sourceName
          )}
        </p>
      )}
    </section>
  );
}