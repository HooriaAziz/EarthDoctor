import { useEffect, useState } from "react";
import { ExternalLink, Info, RefreshCw } from "lucide-react";

import { NASA_OZONE_ANNUAL_RECORDS, NASA_OZONE_ANNUAL_SOURCE } from "./assets/nasaOzoneAnnualData.js";
import TrendAnalysisPanel from "./TrendAnalysisPanel.jsx";
import { Panel, StatusBadge } from "./components/ui";
import "./OzoneLayerMonitor.css";

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
  // The parent keys this component by image URL, so failure state
  // resets naturally when the observation date changes.
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getMapImageUrl(observationDate, map.mapCode);
  const pageUrl = getMapPageUrl(observationDate, map.hemisphere);

  return (
    <figure className="ozone-map">
      <a
        className="ozone-map-image"
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open NASA's full ${map.title} map`}
      >
        {imageFailed ? (
          <span className="ozone-map-fallback">
            Map image could not be loaded.
            <span>Open the original on NASA Ozone Watch ↗</span>
          </span>
        ) : (
          <img
            src={imageUrl}
            alt={`NASA total-column ozone map, ${map.region}, ${formatDate(observationDate)}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </a>
      <figcaption>
        <strong>{map.title}</strong>
        <span>{map.region}</span>
        <a href={pageUrl} target="_blank" rel="noopener noreferrer">
          NASA <ExternalLink size={11} aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}

export default function OzoneLayerMonitor({ visual = null }) {
  const [observation, setObservation] = useState(FALLBACK_OBSERVATION);
  const [feed, setFeed] = useState("loading"); // loading | live | fallback
  const [refreshNumber, setRefreshNumber] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadNASAData() {
      setFeed("loading");

      try {
        const response = await fetch(NASA_DATA_URL, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("NASA data request failed");

        const latest = parseLatestObservation(await response.text());
        if (!latest) throw new Error("No valid observation found");

        if (active) {
          setObservation(latest);
          setFeed("live");
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        if (active) {
          setObservation(FALLBACK_OBSERVATION);
          setFeed("fallback");
        }
      }
    }

    loadNASAData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshNumber]);

  const records = NASA_OZONE_ANNUAL_RECORDS;
  const latestYear = records.at(-1);
  const recordMax = records.reduce((best, item) =>
    item.maxDailyAreaMillionKm2 > best.maxDailyAreaMillionKm2 ? item : best
  );
  const recordMin = records.reduce((best, item) =>
    item.minimumOzoneDU < best.minimumOzoneDU ? item : best
  );

  const ozoneAreaPoints = records.map((record) => ({
    year: record.year,
    value: record.maxDailyAreaMillionKm2,
  }));
  const minimumOzonePoints = records.map((record) => ({
    year: record.year,
    value: record.minimumOzoneDU,
  }));

  const badge =
    feed === "loading"
      ? { status: "loading", label: "Checking NASA" }
      : feed === "live"
        ? { status: "connected", label: "NASA live" }
        : { status: "partial", label: "Saved fallback" };

  return (
    <>
      <div className="grid-main">
        <div className="ae-visual">{visual}</div>

        <div className="side-col">
          <Panel
            id="ozone-hole"
            title="Antarctic ozone hole"
            meta="NASA Ozone Watch · daily area below 220 DU, south of 40°S"
            actions={
              <>
                <StatusBadge status={badge.status} label={badge.label} />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setRefreshNumber((value) => value + 1)}
                  disabled={feed === "loading"}
                  aria-label="Refresh NASA data"
                  title="Refresh NASA data"
                >
                  <RefreshCw size={13} className={feed === "loading" ? "spin" : undefined} />
                </button>
              </>
            }
          >
            <div className="kpi-pair">
              <div className="kpi">
                <span className="kpi-label">Ozone-hole area · latest day</span>
                <span className="kpi-value num">
                  {observation.area.toFixed(2)}
                  <span className="kpi-unit">million km²</span>
                </span>
                <span className="kpi-sub mono">{formatDate(observation.date)} (UTC)</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">{latestYear.year} annual maximum</span>
                <span className="kpi-value num">
                  {latestYear.maxDailyAreaMillionKm2.toFixed(1)}
                  <span className="kpi-unit">million km²</span>
                </span>
                <span className="kpi-sub">
                  Record {recordMax.maxDailyAreaMillionKm2.toFixed(1)} in {recordMax.year}
                </span>
              </div>
            </div>

            <dl className="metric-grid metric-grid-2">
              <div className="metric">
                <dt>{latestYear.year} minimum (S. Hem.)</dt>
                <dd>
                  <span className="num metric-value">{latestYear.minimumOzoneDU}</span>
                  <span className="metric-unit">DU</span>
                </dd>
              </div>
              <div className="metric">
                <dt>Record minimum</dt>
                <dd>
                  <span className="num metric-value">{recordMin.minimumOzoneDU}</span>
                  <span className="metric-unit">DU · {recordMin.year}</span>
                </dd>
              </div>
              <div className="metric">
                <dt>Hole threshold</dt>
                <dd>
                  <span className="num metric-value">220</span>
                  <span className="metric-unit">DU</span>
                </dd>
              </div>
              <div className="metric">
                <dt>Annual record</dt>
                <dd>
                  <span className="num metric-value">
                    {records[0].year}–{latestYear.year}
                  </span>
                </dd>
              </div>
            </dl>

            {feed === "fallback" && (
              <p className="row-note tone-warn" role="status">
                <Info size={12} aria-hidden="true" /> NASA's daily file could not be reached. The daily
                value shown is a saved observation, not a live reading.
              </p>
            )}
          </Panel>

          <Panel
            id="ozone-maps"
            title="Polar total-column ozone"
            meta={`NASA OMPS · ${formatDate(observation.date)}`}
          >
            <div className="ozone-map-grid">
              {OZONE_MAPS.map((map) => {
                const key = getMapImageUrl(observation.date, map.mapCode);
                return <OzoneMapCard key={key} map={map} observationDate={observation.date} />;
              })}
            </div>
            <div className="ozone-legend">
              <div className="ozone-color-scale" role="img" aria-label="Qualitative guide: lower ozone in purple and blue, higher ozone in yellow and red" />
              <div className="ozone-legend-labels">
                <span>Lower total ozone</span>
                <span>Higher</span>
              </div>
              <p className="row-note">
                Qualitative guide only — see NASA's map legend for Dobson Unit values.{" "}
                <a href="https://ozoneaq.gsfc.nasa.gov/map/" target="_blank" rel="noopener noreferrer">
                  NASA global viewer ↗
                </a>
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid-2">
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
      </div>

      <Panel id="ozone-notes" title="Measurement notes" meta="Read before interpreting the values above">
        <p className="prose">
          The maps show <strong>total-column ozone</strong>: ozone integrated through a vertical column of
          atmosphere. The Antarctic ozone-hole area is a separate measurement — the area enclosed by the
          220 DU contour. Neither is a measurement of global or ground-level ozone. The 3D ozone shell is
          illustrative, not a measurement of ozone thickness or concentration.
        </p>
        <p className="row-note">
          Data and imagery:{" "}
          <a href="https://ozonewatch.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">
            NASA Ozone Watch ↗
          </a>{" "}
          ·{" "}
          <a href={NASA_DATA_URL} target="_blank" rel="noopener noreferrer">
            Daily area data file ↗
          </a>
        </p>
      </Panel>
    </>
  );
}
