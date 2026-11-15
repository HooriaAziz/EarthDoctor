import { useEffect, useState } from "react";

import {
  Activity,
  Bot,
  CloudSun,
  Droplets,
  Flame,
  Globe2,
  Leaf,
  Trees,
  Wind,
  TrendingUp,
  Factory,
  Sun,
} from "lucide-react";

import CesiumGlobe from "./CesiumGlobe";
import "./App.css";

const NASA_START_DATE = "20261101";
const NASA_END_DATE = "20261103";

const indicators = [
  {
    title: "Temperature",
    description: "Daily air temperature",
    parameter: "T2M",
    unit: "°C",
    icon: CloudSun,
    color: "blue",
  },
  {
    title: "Relative humidity",
    description: "Near-surface relative humidity",
    parameter: "RH2M",
    unit: "%",
    icon: Droplets,
    color: "cyan",
  },
  {
    title: "Precipitation",
    description: "Daily corrected precipitation",
    parameter: "PRECTOTCORR",
    unit: "mm/day",
    icon: Droplets,
    color: "blue",
  },
  {
    title: "Wind speed",
    description: "Wind speed at 10 metres",
    parameter: "WS10M",
    unit: "m/s",
    icon: Wind,
    color: "green",
  },
  {
    title: "Solar radiation",
    description: "Daily solar energy at the surface",
    parameter: "ALLSKY_SFC_SW_DWN",
    unit: "kWh/m²/day",
    icon: Sun,
    color: "orange",
  },
];

const additionalIndicators = [
  {
    title: "Forest health",
    description: "Forest cover and vegetation",
    icon: Trees,
    color: "green",
  },
  {
    title: "Fire activity",
    description: "Satellite-detected fire activity",
    icon: Flame,
    color: "orange",
  },
  {
    title: "Air quality",
    description: "Atmospheric pollution indicators",
    icon: Wind,
    color: "blue",
  },
  {
    title: "Pollution",
    description: "Environmental pollution indicators",
    icon: Factory,
    color: "orange",
  },
];

function formatDate(date) {
  if (!date || date.length !== 8) return "";

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [nasaData, setNasaData] = useState({
    status: "idle",
    date: null,
    readings: {},
    error: null,
  });

  // Load NASA POWER readings whenever a new map location is selected.
  useEffect(() => {
    if (
      !selectedLocation ||
      typeof selectedLocation.latitude !== "number" ||
      typeof selectedLocation.longitude !== "number"
    ) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadNasaData() {
      setNasaData({
        status: "loading",
        date: null,
        readings: {},
        error: null,
      });

      try {
        const params = new URLSearchParams({
          parameters: "T2M,RH2M,PRECTOTCORR,WS10M,ALLSKY_SFC_SW_DWN",
          community: "RE",
          longitude: selectedLocation.longitude.toFixed(4),
          latitude: selectedLocation.latitude.toFixed(4),
          start: NASA_START_DATE,
          end: NASA_END_DATE,
          format: "JSON",
          "time-standard": "UTC",
        });

        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`NASA POWER returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const parameters = data.properties?.parameter || {};
        const dates = Object.keys(parameters.T2M || {})
          .filter((date) => /^\d{8}$/.test(date))
          .sort();

        if (!dates.length) {
          throw new Error(
            data.messages?.join(" ") || "NASA POWER did not return temperature data."
          );
        }

        const latestDate = dates[dates.length - 1];
        const readings = {};

        for (const indicator of indicators) {
          const value = parameters[indicator.parameter]?.[latestDate];

          readings[indicator.parameter] =
            typeof value === "number" && Number.isFinite(value) && value > -900
              ? value
              : null;
        }

        setNasaData({
          status: "loaded",
          date: latestDate,
          readings,
          error: null,
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("NASA POWER error:", error);
          setNasaData({
            status: "error",
            date: null,
            readings: {},
            error: error.message || "An unknown error occurred.",
          });
        }
      }
    }

    loadNasaData();

    return () => controller.abort();
  }, [selectedLocation]);

  function handleCountrySelect(location) {
    console.log("Selected map location:", location);
    setSelectedLocation(location);
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#overview">
          <span className="brand-icon">
            <Globe2 size={23} />
          </span>
          <span>
            <strong>EARTH DOCTOR</strong>
            <small>PLANETARY INTELLIGENCE</small>
          </span>
        </a>

        <nav className="navigation">
          <a className="active" href="#overview">Overview</a>
          <a href="#indicators">Indicators</a>
          <a href="#summary">Earth Summary</a>
        </nav>

        <div className="topbar-status">
          <span className="status-dot" />
          Earth monitoring
        </div>
      </header>

      <main className="main-content" id="overview">
        <section className="intro">
          <p className="eyebrow">OUR PLANET. ONE VIEW.</p>
          <h1>Explore the health of <span>Earth.</span></h1>
          <p className="intro-description">
            Explore our changing planet through satellite imagery,
            environmental indicators, and scientific insights.
          </p>
        </section>

        <section className="map-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GLOBAL MONITORING</p>
              <h2>Explore Earth</h2>
            </div>
            <span className="map-tag">
              <Globe2 size={15} />
              INTERACTIVE 3D MAP
            </span>
          </div>

          <div className="map-frame">
            <CesiumGlobe onCountrySelect={handleCountrySelect} />
            <div className="map-caption">
              <span>Satellite imagery basemap</span>
              <span>Drag to rotate · Scroll to zoom</span>
            </div>
          </div>

          {selectedLocation && (
            <p className="indicator-note">
              Selected: {selectedLocation.name || "Map location"}
              {typeof selectedLocation.latitude === "number" &&
                typeof selectedLocation.longitude === "number" &&
                ` · ${selectedLocation.latitude.toFixed(3)}°, ${selectedLocation.longitude.toFixed(3)}°`}
            </p>
          )}
        </section>

        <section className="indicators-section" id="indicators">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NASA POWER DATA</p>
              <h2>Environmental readings</h2>
            </div>

            <span className="data-status">
              {nasaData.status === "loaded"
                ? "NASA DATA CONNECTED"
                : nasaData.status === "loading"
                  ? "LOADING NASA DATA"
                  : nasaData.status === "error"
                    ? "DATA UNAVAILABLE"
                    : "SELECT A LOCATION"}
            </span>
          </div>

          {nasaData.status === "idle" && (
            <p className="intro-description">
              Select a location on the Earth map to load NASA POWER
              environmental readings.
            </p>
          )}

          {nasaData.status === "error" && (
            <p className="indicator-note">
              NASA data could not be loaded: {nasaData.error}
            </p>
          )}

          <div className="indicator-grid">
            {indicators.map((item) => {
              const Icon = item.icon;
              const value = nasaData.readings[item.parameter];

              return (
                <article className="indicator-card" key={item.parameter}>
                  <div className={`indicator-icon ${item.color}`}>
                    <Icon size={23} />
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="indicator-value">
                    {nasaData.status === "loaded" && typeof value === "number"
                      ? `${value.toFixed(1)} ${item.unit}`
                      : "—"}
                  </div>

                  <span className="indicator-note">
                    {nasaData.status === "loading"
                      ? "Requesting NASA data..."
                      : nasaData.status === "loaded"
                        ? value === null
                          ? "No valid reading for this date"
                          : `NASA POWER · ${formatDate(nasaData.date)}`
                        : "Awaiting location"}
                  </span>
                </article>
              );
            })}
          </div>

          {nasaData.status === "loaded" && (
            <p className="indicator-note">
              Source: NASA POWER Daily Point API. These are historical
              meteorological and solar readings for the selected coordinates,
              not country-wide averages or live conditions.
            </p>
          )}
        </section>

        <section className="indicators-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MORE ENVIRONMENTAL DATA</p>
              <h2>Other planet indicators</h2>
            </div>
          </div>

          <div className="indicator-grid">
            {additionalIndicators.map((item) => {
              const Icon = item.icon;

              return (
                <article className="indicator-card" key={item.title}>
                  <div className={`indicator-icon ${item.color}`}>
                    <Icon size={23} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="indicator-value">—</div>
                  <span className="indicator-note">Awaiting verified dataset</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="summary-section" id="summary">
          <div className="summary-icon">
            <Activity size={25} />
          </div>

          <div className="summary-content">
            <p className="eyebrow">PLANETARY OVERVIEW</p>
            <h2>Earth Health Summary</h2>

            <p>
              Your planetary overview will appear here once verified
              environmental datasets are connected. Earth Doctor will
              summarize important changes, highlight areas of concern,
              and explain possible environmental pressures using
              evidence-based information.
            </p>

            <div className="summary-footer">
              <span><Leaf size={15} /> Evidence-based insights</span>
              <span><TrendingUp size={15} /> Historical comparisons</span>
              <span><Bot size={15} /> AI-assisted explanations</span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>EARTH DOCTOR AI</span>
          <span>Built to better understand our planet.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
