
import "./CountryEmissionsProfile.css";
import { getEdgarCountryProfile } from "./assets/edgarData";

function getCountryLabel(country) {
  if (typeof country === "string") return country;
  if (!country || typeof country !== "object") return "Selected country";

  const properties =
    country.properties && typeof country.properties === "object"
      ? country.properties
      : {};

  return (
    country.name ||
    country.countryName ||
    country.country ||
    country.label ||
    properties.ADMIN ||
    properties.NAME_EN ||
    properties.NAME ||
    properties.name ||
    "Selected country"
  );
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "Not available";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatAxisNumber(value) {
  if (!Number.isFinite(value)) return "";

  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not available";

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}%`;
}

function buildTrendChart(values) {
  if (!Array.isArray(values)) return null;

  const validPoints = values
    .map((value, index) => ({
      value,
      year: 1970 + index,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.value) &&
        item.value >= 0
    );

  if (validPoints.length < 2) return null;

  const width = 720;
  const height = 280;

  const margin = {
    top: 24,
    right: 22,
    bottom: 46,
    left: 76,
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maxValue = Math.max(
    ...validPoints.map((item) => item.value)
  );

  const chartMaximum = maxValue > 0 ? maxValue * 1.12 : 1;
  const tickCount = 4;

  const xPosition = (year) =>
    margin.left +
    ((year - 1970) / Math.max(values.length - 1, 1)) *
      plotWidth;

  const yPosition = (value) =>
    margin.top +
    plotHeight -
    (value / chartMaximum) * plotHeight;

  const points = validPoints.map((item) => ({
    ...item,
    x: xPosition(item.year),
    y: yPosition(item.value),
  }));

  const linePoints = points
    .map((item) => `${item.x},${item.y}`)
    .join(" ");

  const yTicks = Array.from(
    { length: tickCount + 1 },
    (_, index) => {
      const value = (chartMaximum / tickCount) * index;

      return {
        value,
        y: yPosition(value),
      };
    }
  );

  const yearTicks = [1970, 1980, 1990, 2000, 2010, 2020, 2025];

  return {
    width,
    height,
    margin,
    plotWidth,
    plotHeight,
    points,
    linePoints,
    yTicks,
    yearTicks: yearTicks.filter(
      (year) => year <= 1970 + values.length - 1
    ),
    xPosition,
    yPosition,
    latestPoint: points[points.length - 1],
    firstPoint: points[0],
    maxValue,
  };
}

export default function CountryEmissionsProfile({ country }) {
  if (!country) return null;

  const profile = getEdgarCountryProfile(country);
  const countryLabel = getCountryLabel(country);

  if (!profile) {
    return (
      <section className="edgar-profile-section">
        <div className="edgar-profile-empty">
          <div>
            <p className="edgar-profile-eyebrow">
              COUNTRY ENVIRONMENTAL PROFILE
            </p>
            <h2>{countryLabel}</h2>
            <p>
              This map selection does not have a matching country record
              in the EDGAR 2026 workbook. Some map territories and EDGAR
              reporting areas use different boundaries or names.
            </p>
          </div>

          <span className="edgar-source-pill">EDGAR 2026</span>
        </div>
      </section>
    );
  }

  const trendChart = buildTrendChart(
    profile.annualEmissionsMtCO2e
  );

  const validSectors = Array.isArray(profile.sectors2025)
    ? profile.sectors2025.filter(
        (sector) =>
          Number.isFinite(sector.emissionsMtCO2e) &&
          sector.emissionsMtCO2e >= 0
      )
    : [];

  const sectorTotal = validSectors.reduce(
    (total, sector) => total + sector.emissionsMtCO2e,
    0
  );

  const topSectorValue = Math.max(
    0,
    ...validSectors.map((sector) => sector.emissionsMtCO2e)
  );

  const sectors = [...validSectors].sort(
    (a, b) => b.emissionsMtCO2e - a.emissionsMtCO2e
  );

  const trendClass =
    profile.changeSince2020Percent < 0
      ? "edgar-change-lower"
      : profile.changeSince2020Percent > 0
        ? "edgar-change-higher"
        : "";

  return (
    <section className="edgar-profile-section">
      <div className="edgar-profile-heading">
        <div>
          <p className="edgar-profile-eyebrow">
            COUNTRY ENVIRONMENTAL PROFILE
          </p>

          <h2>{profile.name}</h2>

          <p className="edgar-profile-subtitle">
            Greenhouse-gas emissions · EDGAR country code {profile.code}
          </p>
        </div>

        <span className="edgar-source-pill">
          EDGAR 2026 · {profile.latestYear}
        </span>
      </div>

      {/* Key statistics */}
      <div className="edgar-stat-grid">
        <article className="edgar-stat-card edgar-stat-primary">
          <span className="edgar-stat-label">
            Total GHG emissions
          </span>

          <strong>
            {formatNumber(profile.latestEmissionsMtCO2e, 2)}
          </strong>

          <span className="edgar-stat-unit">
            Mt CO₂e / year · {profile.latestYear}
          </span>
        </article>

        <article className="edgar-stat-card">
          <span className="edgar-stat-label">
            Per-capita emissions
          </span>

          <strong>
            {formatNumber(profile.perCapitaTCO2e, 2)}
          </strong>

          <span className="edgar-stat-unit">
            t CO₂e / person / year
          </span>
        </article>

        <article className="edgar-stat-card">
          <span className="edgar-stat-label">
            Emissions intensity
          </span>

          <strong>
            {formatNumber(profile.perGDPtCO2ePerKUSD, 3)}
          </strong>

          <span className="edgar-stat-unit">
            t CO₂e / kUSD GDP
          </span>
        </article>

        <article className="edgar-stat-card">
          <span className="edgar-stat-label">
            Change since 2020
          </span>

          <strong className={trendClass}>
            {formatPercent(profile.changeSince2020Percent)}
          </strong>

          <span className="edgar-stat-unit">
            Change in total annual emissions
          </span>
        </article>
      </div>

      <div className="edgar-detail-grid">
        {/* Historical emissions chart */}
        <article className="edgar-detail-card edgar-trend-card">
          <div className="edgar-card-heading">
            <div>
              <h3>Emissions over time</h3>
              <p>Annual greenhouse-gas emissions · 1970–2025</p>
            </div>

            <span className="edgar-unit-tag">
              Mt CO₂e
            </span>
          </div>

          {trendChart ? (
            <>
              <div className="edgar-trend-chart">
                <svg
                  viewBox={`0 0 ${trendChart.width} ${trendChart.height}`}
                  role="img"
                  aria-label={`${profile.name} annual greenhouse-gas emissions over time, measured in million tonnes of CO2 equivalent`}
                >
                  {/* Horizontal gridlines and Y-axis labels */}
                  {trendChart.yTicks.map((tick, index) => (
                    <g key={index}>
                      <line
                        className="edgar-chart-gridline"
                        x1={trendChart.margin.left}
                        y1={tick.y}
                        x2={
                          trendChart.width -
                          trendChart.margin.right
                        }
                        y2={tick.y}
                      />

                      <text
                        className="edgar-chart-y-label"
                        x={trendChart.margin.left - 12}
                        y={tick.y + 4}
                        textAnchor="end"
                      >
                        {formatAxisNumber(tick.value)}
                      </text>
                    </g>
                  ))}

                  {/* X-axis */}
                  <line
                    className="edgar-chart-axis-line"
                    x1={trendChart.margin.left}
                    y1={
                      trendChart.height -
                      trendChart.margin.bottom
                    }
                    x2={
                      trendChart.width -
                      trendChart.margin.right
                    }
                    y2={
                      trendChart.height -
                      trendChart.margin.bottom
                    }
                  />

                  {/* Historical trend line */}
                  <polyline
                    className="edgar-chart-trend-line"
                    points={trendChart.linePoints}
                  />

                  {/* Data points */}
                  {trendChart.points.map((item) => (
                    <circle
                      key={item.year}
                      className="edgar-chart-data-point"
                      cx={item.x}
                      cy={item.y}
                      r={trendChart.points.length > 35 ? 2 : 3.5}
                    >
                      <title>
                        {item.year}: {formatNumber(item.value, 2)} Mt CO₂e
                      </title>
                    </circle>
                  ))}

                  {/* Latest value highlight */}
                  <circle
                    className="edgar-chart-latest-point"
                    cx={trendChart.latestPoint.x}
                    cy={trendChart.latestPoint.y}
                    r="5"
                  />

                  <text
                    className="edgar-chart-latest-label"
                    x={Math.min(
                      trendChart.latestPoint.x - 8,
                      trendChart.width - trendChart.margin.right
                    )}
                    y={Math.max(
                      trendChart.latestPoint.y - 13,
                      14
                    )}
                    textAnchor="end"
                  >
                    {formatAxisNumber(
                      trendChart.latestPoint.value
                    )}
                  </text>

                  {/* Year labels */}
                  {trendChart.yearTicks.map((year) => (
                    <text
                      key={year}
                      className="edgar-chart-x-label"
                      x={trendChart.xPosition(year)}
                      y={
                        trendChart.height -
                        trendChart.margin.bottom +
                        25
                      }
                      textAnchor="middle"
                    >
                      {year}
                    </text>
                  ))}
                </svg>
              </div>

              <div className="edgar-chart-summary">
                <div>
                  <span>First available value</span>
                  <strong>
                    {trendChart.firstPoint.year} ·{" "}
                    {formatNumber(
                      trendChart.firstPoint.value,
                      2
                    )}{" "}
                    Mt CO₂e
                  </strong>
                </div>

                <div>
                  <span>Latest available value</span>
                  <strong>
                    {trendChart.latestPoint.year} ·{" "}
                    {formatNumber(
                      trendChart.latestPoint.value,
                      2
                    )}{" "}
                    Mt CO₂e
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <p className="edgar-chart-empty">
              Not enough valid annual data is available to display this trend.
            </p>
          )}
        </article>

        {/* Sector emissions chart */}
        <article className="edgar-detail-card edgar-sector-card">
          <div className="edgar-card-heading">
            <div>
              <h3>Emissions by sector</h3>
              <p>Sector contribution · 2025</p>
            </div>

            <span className="edgar-unit-tag">
              Mt CO₂e
            </span>
          </div>

          {sectors.length > 0 ? (
            <>
              <div className="edgar-sector-total">
                <span>Sum of displayed sectors</span>
                <strong>
                  {formatNumber(sectorTotal, 2)} Mt CO₂e
                </strong>
              </div>

              <div className="edgar-sector-list">
                {sectors.map((sector) => {
                  const width =
                    topSectorValue > 0
                      ? (sector.emissionsMtCO2e /
                          topSectorValue) *
                        100
                      : 0;

                  const share =
                    sectorTotal > 0
                      ? (sector.emissionsMtCO2e /
                          sectorTotal) *
                        100
                      : null;

                  return (
                    <div
                      className="edgar-sector-row"
                      key={sector.name}
                    >
                      <div className="edgar-sector-label">
                        <span>{sector.name}</span>

                        <strong>
                          {formatNumber(
                            sector.emissionsMtCO2e,
                            2
                          )}{" "}
                          Mt
                        </strong>
                      </div>

                      <div
                        className="edgar-sector-track"
                        role="img"
                        aria-label={`${sector.name}: ${formatNumber(sector.emissionsMtCO2e, 2)} million tonnes CO2 equivalent`}
                      >
                        <span
                          style={{ width: `${width}%` }}
                        />
                      </div>

                      <div className="edgar-sector-share">
                        <span>
                          {share === null
                            ? "Share unavailable"
                            : `${formatNumber(share, 1)}% of displayed sectors`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="edgar-chart-empty">
              No valid sector breakdown is available for this country.
            </p>
          )}
        </article>
      </div>

      {/* Scientific scope and attribution */}
      <div className="edgar-profile-footnote">
        <p>
          <strong>Scope:</strong> EDGAR totals include fossil CO₂,
          CH₄, N₂O and F-gases expressed as CO₂-equivalent using
          IPCC AR5 GWP-100. Land use, land-use change and forestry
          (LULUCF) are reported separately in the workbook and are
          not included in this total.
        </p>

        <p>
          <strong>Source:</strong> EDGAR Community GHG Database,
          version EDGAR_2026_GHG (2026), European Commission Joint
          Research Centre. Report:{" "}
          <a
            href="https://edgar.jrc.ec.europa.eu/report_2026"
            target="_blank"
            rel="noreferrer"
          >
            Crippa et al., GHG emissions of all world countries,
            2026 Report
          </a>{" "}
          (DOI: 10.2760/7717504; JRC147815). Values shown are from
          the workbook's 2025 column where applicable.
        </p>
      </div>
    </section>
  );
}
