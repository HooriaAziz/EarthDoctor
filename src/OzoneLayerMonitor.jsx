import { useEffect, useState } from "react";

import {
  Activity,
  CalendarDays,
  ExternalLink,
  Info,
  RefreshCw,
  Satellite,
} from "lucide-react";

import { NASA_OZONE_ANNUAL_RECORDS, NASA_OZONE_ANNUAL_SOURCE } from "./assets/nasaOzoneAnnualData.js";
import TrendAnalysisPanel from "./TrendAnalysisPanel.jsx";
import "./OzoneLayerMonitor.css";
import "./OzoneTrendAnalysis.css";

const FALLBACK_OBSERVATION = {
  date: "2026-11-12",
  area: 18.6,
};

const NASA_DATA_URL =
  `https://ozonewatch.gsfc.nasa.gov/meteorology/figures/ozone/to3areas_${new Date().getUTCFullYear()}_toms%2Bomi%2Bomps.txt`;

const OZONE_MAPS = [
  {
    id: "arctic",
    title: "Arctic ozone",
    region: "Northern Hemisphere",
    hemisphere: "N",
    mapCode: "LNH",
    description:
      "Total-column ozone observed over the Arctic polar region.",
  },
  {
    id: "antarctic",
    title: "Antarctic ozone",
    region: "Southern Hemisphere",
    hemisphere: "S",
    mapCode: "LSH",
    description:
      "Total-column ozone observed over the Antarctic polar region.",
  },
];

function parseLatestObservation(fileText) {
  const today = new Date().toISOString().slice(0, 10);

  const validRecords = fileText
    .split(/\r?\n/)
    .map((line) => {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 2) return null;

      const date = columns[0];
      const area = Number(columns[1]);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(area) ||
        area < 0 ||
        date > today
      ) {
        return null;
      }

      return { date, area };
    })
    .filter(Boolean);

  validRecords.sort((a, b) => a.date.localeCompare(b.date));
  return validRecords.at(-1) || null;
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }
  );
}

function getMapImageUrl(date, mapCode) {
  const [year, month, day] = date.split("-");
  const compactDate = `${year}-${month}-${day}`;

  return (
    `https://ozonewatch.gsfc.nasa.gov/ozone_maps/images/` +
    `Y${year}/M${month}/` +
    `OZONE_D${compactDate}_G%5E716X716.` +
    `IOMPS_PN20_V20_MGEOS5FP_${mapCode}.PNG`
  );
}

function getMapPageUrl(date, hemisphere) {
  return (
    `https://ozonewatch.gsfc.nasa.gov/Scripts/big_image.php` +
    `?date=${date}&hem=${hemisphere}`
  );
}

function OzoneMapCard({ map, observationDate }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getMapImageUrl(observationDate, map.mapCode);
  const pageUrl = getMapPageUrl(observationDate, map.hemisphere);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <article className="ozone-map-card">
      <div className="ozone-map-card-heading">
        <div>
          <span className="ozone-region">{map.region}</span>
          <h3>{map.title}</h3>
        </div>
        <Satellite size={21} aria-hidden="true" />
      </div>

      <a
        className="ozone-map-image-link"
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open NASA's full ${map.title} map`}
      >
        {imageFailed ? (
          <div className="ozone-map-image-fallback">
            NASA's map image could not be loaded here.
            <span>Open the original NASA map instead.</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={
              `NASA total-column ozone map for ${map.region}, ` +
              `${formatDate(observationDate)}`
            }
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </a>

      <p className="ozone-map-description">{map.description}</p>

      <a
        className="ozone-source-link"
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open NASA map <ExternalLink size={14} />
      </a>
    </article>
  );
}

export default function OzoneLayerMonitor() {
  const [observation, setObservation] = useState(FALLBACK_OBSERVATION);
  const [dataStatus, setDataStatus] = useState(
    "Showing the saved fallback observation"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [refreshNumber, setRefreshNumber] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadNASAData() {
      setIsLoading(true);
      setDataStatus("Checking NASA's ozone data feed...");

      try {
        const response = await fetch(NASA_DATA_URL, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("NASA data request failed");
        }

        const fileText = await response.text();
        const latest = parseLatestObservation(fileText);
        if (!latest) throw new Error("No valid observation found");

        if (active) {
          setObservation(latest);
          setDataStatus("NASA data feed successfully updated");
        }
      } catch (error) {
        if (error.name === "AbortError") return;

        if (active) {
          setObservation(FALLBACK_OBSERVATION);
          setDataStatus(
            "Live refresh unavailable — showing the saved fallback observation"
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadNASAData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshNumber]);

  const formattedDate = formatDate(observation.date);
  const ozoneAreaPoints = NASA_OZONE_ANNUAL_RECORDS.map((record) => ({
    year: record.year,
    value: record.maxDailyAreaMillionKm2,
  }));
  const minimumOzonePoints = NASA_OZONE_ANNUAL_RECORDS.map((record) => ({
    year: record.year,
    value: record.minimumOzoneDU,
  }));

  return (
    <section className="ozone-monitor">
      <div className="ozone-monitor-header">
        <div>
          <p className="eyebrow">NASA ATMOSPHERIC MONITORING</p>
          <h2>Ozone Layer Monitor</h2>
          <p className="ozone-intro">
            Explore satellite-derived ozone observations around Earth's
            atmosphere, including the Arctic and Antarctic polar regions.
          </p>
        </div>
        <div className="ozone-nasa-label">
          <Satellite size={16} />
          NASA DATA
        </div>
      </div>

      <div className="ozone-metrics">
        <article className="ozone-metric">
          <CalendarDays size={20} />
          <div>
            <span>Latest valid observation</span>
            <strong>{formattedDate}</strong>
          </div>
        </article>

        <article className="ozone-metric">
          <Activity size={20} />
          <div>
            <span>Antarctic ozone-hole area</span>
            <strong>{observation.area.toFixed(2)} million km²</strong>
          </div>
        </article>

        <article className="ozone-metric">
          <Info size={20} />
          <div>
            <span>Ozone-hole area threshold</span>
            <strong>220 Dobson Units (DU)</strong>
          </div>
        </article>
      </div>

      <div className="ozone-data-status" aria-live="polite">
        <div className="ozone-data-status-text">
          <span className={`ozone-status-dot ${isLoading ? "checking" : ""}`} />
          <span>{dataStatus}</span>
        </div>

        <button
          type="button"
          className="ozone-refresh-button"
          onClick={() => setRefreshNumber((value) => value + 1)}
          disabled={isLoading}
        >
          <RefreshCw
            size={14}
            className={isLoading ? "ozone-spinning" : ""}
          />
          {isLoading ? "Updating..." : "Refresh NASA data"}
        </button>
      </div>

      <div className="ozone-map-section-heading">
        <div>
          <p className="eyebrow">POLAR OZONE OBSERVATIONS</p>
          <h3>Explore both hemispheres</h3>
        </div>
        <span className="ozone-observation-tag">NASA SATELLITE MAPS</span>
      </div>

      <div className="ozone-map-grid">
        {OZONE_MAPS.map((map) => (
          <OzoneMapCard
            key={map.id}
            map={map}
            observationDate={observation.date}
          />
        ))}
      </div>

      <div className="ozone-legend">
        <div className="ozone-legend-heading">
          <strong>Understanding the map colors</strong>
          <span>NASA Ozone Watch</span>
        </div>
        <div
          className="ozone-color-scale"
          role="img"
          aria-label="Qualitative color guide from lower ozone in purple and blue to higher ozone in yellow and red"
        />
        <div className="ozone-legend-labels">
          <span>Lower total ozone</span>
          <span>Higher total ozone</span>
        </div>
        <p className="ozone-legend-note">
          This is a visual guide, not a numeric scale. Refer to NASA's original
          map legend for exact Dobson Unit values.
        </p>
      </div>

      <div className="ozone-global-viewer">
        <div>
          <span className="ozone-region">MORE NASA OBSERVATIONS</span>
          <strong>Explore global ozone measurements</strong>
          <p>
            Open NASA's interactive viewer to explore global ozone observations
            from multiple satellite instruments.
          </p>
        </div>
        <a
          className="ozone-global-viewer-link"
          href="https://ozoneaq.gsfc.nasa.gov/map/"
          target="_blank"
          rel="noopener noreferrer"
        >
          NASA global viewer <ExternalLink size={14} />
        </a>
      </div>

      <div className="ozone-trend-heading">
        <p className="eyebrow">HISTORICAL SCIENTIFIC ANALYSIS</p>
        <h3>How has Antarctic ozone changed?</h3>
        <p>
          The annual records below are separate from the latest daily reading
          above. They let us compare the same annual measures across years.
        </p>
      </div>

      <TrendAnalysisPanel
        title="Maximum daily Antarctic ozone-hole area"
        description="Largest daily area each year in which total-column ozone fell below 220 Dobson Units, south of 40°S."
        points={ozoneAreaPoints}
        units="million km²"
        valueDigits={1}
        slopeDigits={3}
        interpretation="The 1979–2025 record shows the long-term expansion of the Antarctic ozone-hole area from the start of the satellite record. The 1979 starting value was small (1.1 million km²), so the percentage change is especially sensitive to that baseline. This overall trend does not mean the hole grew every year or that its area is currently increasing every year."
        sourceName={NASA_OZONE_ANNUAL_SOURCE.name}
        sourceUrl={NASA_OZONE_ANNUAL_SOURCE.url}
        sourceNote={`NASA's annual maximum-daily records run from 1979 through 2025. NASA reports no data for 1995; that year is left out rather than interpolated. Source last updated ${NASA_OZONE_ANNUAL_SOURCE.lastUpdated}.`}
      />

      <TrendAnalysisPanel
        title="Minimum daily Southern Hemisphere ozone"
        description="Lowest daily Southern Hemisphere total-column ozone value each year, measured in Dobson Units (DU)."
        points={minimumOzonePoints}
        units="DU"
        valueDigits={1}
        slopeDigits={3}
        interpretation="A downward trend in the annual minimum indicates lower minimum ozone values across this historical record. It is a regional extreme, not a statement that ozone has decreased uniformly over the entire planet."
        sourceName={NASA_OZONE_ANNUAL_SOURCE.name}
        sourceUrl={NASA_OZONE_ANNUAL_SOURCE.url}
        sourceNote="The 1995 observation is missing in NASA's published annual record and is not estimated here."
      />

      <div className="ozone-science-note">
        <Info size={19} />
        <p>
          These maps show <strong>total-column ozone</strong>: the amount of
          ozone integrated through a vertical column of atmosphere. The
          Antarctic ozone-hole area is a separate measurement, calculated
          using the area enclosed by the 220 DU contour. It is not a
          measurement of global ozone concentration or ground-level ozone.
          The 3D ozone shell in this project is illustrative, not a live
          measurement of ozone thickness or concentration.
        </p>
      </div>

      <div className="ozone-attribution">
        Data and imagery:{" "}
        <a
          href="https://ozonewatch.gsfc.nasa.gov/"
          target="_blank"
          rel="noopener noreferrer"
        >
          NASA Ozone Watch <ExternalLink size={13} />
        </a>
        {" · "}
        <a
          href={NASA_DATA_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          NASA daily area data <ExternalLink size={13} />
        </a>
      </div>
    </section>
  );
}
