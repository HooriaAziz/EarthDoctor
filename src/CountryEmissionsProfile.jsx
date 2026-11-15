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

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not available";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}%`;
}

function buildTrendPoints(values) {
  const valid = values
    .map((value, index) => ({ value, index }))
    .filter((item) => Number.isFinite(item.value));

  if (valid.length < 2) return "";

  const min = Math.min(...valid.map((item) => item.value));
  const max = Math.max(...valid.map((item) => item.value));
  const range = max - min || 1;

  return valid
    .map(({ value, index }) => {
      const x = (index / Math.max(values.length - 1, 1)) * 600;
      const y = 126 - ((value - min) / range) * 106;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
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
            <p className="edgar-profile-eyebrow">COUNTRY ENVIRONMENTAL PROFILE</p>
            <h2>{countryLabel}</h2>
            <p>
              This map selection does not have a matching country record in
              the EDGAR 2026 workbook. Some map territories and EDGAR reporting
              areas use different boundaries or names.
            </p>
          </div>
          <span className="edgar-source-pill">EDGAR 2026</span>
        </div>
      </section>
    );
  }

  const trendPoints = buildTrendPoints(profile.annualEmissionsMtCO2e);
  const topSectorValue = Math.max(
    1,
    ...profile.sectors2025.map((sector) => sector.emissionsMtCO2e || 0)
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
          <p className="edgar-profile-eyebrow">COUNTRY ENVIRONMENTAL PROFILE</p>
          <h2>{profile.name}</h2>
          <p className="edgar-profile-subtitle">
            Greenhouse-gas emissions · EDGAR country code {profile.code}
          </p>
        </div>
        <span className="edgar-source-pill">EDGAR 2026 · {profile.latestYear}</span>
      </div>

      <div className="edgar-stat-grid">
        <article className="edgar-stat-card edgar-stat-primary">
          <span className="edgar-stat-label">Total GHG emissions</span>
          <strong>{formatNumber(profile.latestEmissionsMtCO2e, 2)}</strong>
          <span className="edgar-stat-unit">Mt CO₂e / year · 2025</span>
        </article>

        <article className="edgar-stat-card">
          <span className="edgar-stat-label">Per-capita emissions</span>
          <strong>{formatNumber(profile.perCapitaTCO2e, 2)}</strong>
          <span className="edgar-stat-unit">t CO₂e / person / year · 2025</span>
        </article>

        <article className="edgar-stat-card">
          <span className="edgar-stat-label">Emissions intensity</span>
          <strong>{formatNumber(profile.perGDPtCO2ePerKUSD, 3)}</strong>
          <span className="edgar-stat-unit">t CO₂e / kUSD GDP / year · 2025</span>
        </article>

        <article className="edgar-stat-card">
          <span className="edgar-stat-label">Change since 2020</span>
          <strong className={trendClass}>
            {formatPercent(profile.changeSince2020Percent)}
          </strong>
          <span className="edgar-stat-unit">Change in total annual emissions</span>
        </article>
      </div>

      <div className="edgar-detail-grid">
        <article className="edgar-detail-card">
          <div className="edgar-card-heading">
            <div>
              <h3>Emissions over time</h3>
              <p>Annual total · 1970–2025</p>
            </div>
            <span className="edgar-unit-tag">Mt CO₂e</span>
          </div>
          <div className="edgar-trend-chart">
            <svg
              viewBox="0 0 600 145"
              role="img"
              aria-label={`${profile.name} annual greenhouse-gas emissions from 1970 to 2025`}
              preserveAspectRatio="none"
            >
              <line x1="0" y1="126" x2="600" y2="126" />
              <polyline points={trendPoints} />
            </svg>
          </div>
          <div className="edgar-chart-axis">
            <span>1970</span>
            <span>2025</span>
          </div>
        </article>

        <article className="edgar-detail-card">
          <div className="edgar-card-heading">
            <div>
              <h3>Emissions by sector</h3>
              <p>2025 breakdown</p>
            </div>
            <span className="edgar-unit-tag">Mt CO₂e</span>
          </div>
          <div className="edgar-sector-list">
            {profile.sectors2025.map((sector) => {
              const width = Math.max(
                1,
                (sector.emissionsMtCO2e / topSectorValue) * 100
              );

              return (
                <div className="edgar-sector-row" key={sector.name}>
                  <div className="edgar-sector-label">
                    <span>{sector.name}</span>
                    <strong>{formatNumber(sector.emissionsMtCO2e, 2)}</strong>
                  </div>
                  <div className="edgar-sector-track">
                    <span style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="edgar-profile-footnote">
        <p>
          <strong>Scope:</strong> EDGAR totals include fossil CO₂, CH₄, N₂O and
          F-gases expressed as CO₂-equivalent using IPCC AR5 GWP-100. Land use,
          land-use change and forestry (LULUCF) are reported separately in the
          workbook and are not included in this total.
        </p>
        <p>
          <strong>Source:</strong>{" "}
          EDGAR Community GHG Database, version EDGAR_2026_GHG (2026),
          European Commission Joint Research Centre. Report:{" "}
          <a
            href="https://edgar.jrc.ec.europa.eu/report_2026"
            target="_blank"
            rel="noreferrer"
          >
            Crippa et al., GHG emissions of all world countries, 2026 Report
          </a>
          {" "} (DOI: 10.2760/7717504; JRC147815). Values shown are from the
          workbook's 2025 column.
        </p>
      </div>
    </section>
  );
}
