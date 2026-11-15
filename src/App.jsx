
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Droplets,
  Globe2,
  Leaf,
  Wind,
  TrendingUp,
  Sun,
  Thermometer,
  Waves,
} from "lucide-react";

import CesiumGlobe from "./CesiumGlobe";
import LiveEventsPanel from "./LiveEventsPanel";
import CountryEmissionsProfile from "./CountryEmissionsProfile";
import OrbitalDebrisMonitor from "./OrbitalDebrisMonitor";
import OrbitalDebrisSimulation from "./OrbitalDebrisSimulation";
import {
  fetchLiveEarthData,
  fetchSelectedLocationData,
} from "./liveEarthData";

import "./App.css";
import "./LiveLocationAlerts.css";

const GLOBAL_EVENT_REFRESH_MS = 5 * 60 * 1000;
const LOCATION_DATA_REFRESH_MS = 15 * 60 * 1000;

const EMPTY_LIVE_EVENTS = {
  events: [],
  sourceStatus: {
    eonet: "loading",
    usgs: "loading",
  },
  sourceErrors: [],
  fetchedAt: null,
};

function formatTimestamp(value) {
  if (!value) return "Timestamp not supplied";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Timestamp unavailable";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatReading(value, decimals = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(decimals)
    : "—";
}

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [liveEventsData, setLiveEventsData] =
    useState(EMPTY_LIVE_EVENTS);

  const [liveEventsLoading, setLiveEventsLoading] = useState(true);

  const [activeMapMode, setActiveMapMode] = useState("country");

  const [locationData, setLocationData] = useState({
    status: "idle",
    data: null,
    error: null,
  });

  // Load global natural events and earthquakes.
  useEffect(() => {
    let active = true;
    let currentController = null;

    async function loadGlobalEvents() {
      currentController?.abort();
      currentController = new AbortController();

      setLiveEventsLoading(true);

      try {
        const result = await fetchLiveEarthData(
          currentController.signal
        );

        if (active) {
          setLiveEventsData(result);
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setLiveEventsData((previous) => ({
            ...previous,
            sourceErrors: [
              error.message ||
                "Unable to load global event feeds.",
            ],
            fetchedAt: new Date().toISOString(),
          }));
        }
      } finally {
        if (active) {
          setLiveEventsLoading(false);
        }
      }
    }

    loadGlobalEvents();

    const intervalId = window.setInterval(
      loadGlobalEvents,
      GLOBAL_EVENT_REFRESH_MS
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);
      currentController?.abort();
    };
  }, []);

  // Load weather and air-quality data for selected coordinates.
  useEffect(() => {
    if (
      !selectedLocation ||
      typeof selectedLocation.latitude !== "number" ||
      typeof selectedLocation.longitude !== "number"
    ) {
      setLocationData({
        status: "idle",
        data: null,
        error: null,
      });

      return undefined;
    }

    let active = true;
    let currentController = null;

    async function loadLocationData() {
      currentController?.abort();
      currentController = new AbortController();

      setLocationData((previous) => ({
        status: "loading",
        data: previous.data,
        error: null,
      }));

      try {
        const result = await fetchSelectedLocationData({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          signal: currentController.signal,
        });

        if (active) {
          const weatherAvailable = Boolean(result.weather);
          const airAvailable = Boolean(result.airQuality);

          const status =
            weatherAvailable && airAvailable
              ? "loaded"
              : weatherAvailable || airAvailable
                ? "partial"
                : "error";

          setLocationData({
            status,
            data: result,
            error: null,
          });
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setLocationData({
            status: "error",
            data: null,
            error:
              error.message ||
              "Unable to load selected-location data.",
          });
        }
      }
    }

    loadLocationData();

    const intervalId = window.setInterval(
      loadLocationData,
      LOCATION_DATA_REFRESH_MS
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);
      currentController?.abort();
    };
  }, [selectedLocation]);

  function handleCountrySelect(location) {
    console.log("Selected map location:", location);
    setSelectedLocation(location);
  }

  // Selected location data.
  const currentWeather = locationData.data?.weather?.current;

  const weatherUnits =
    locationData.data?.weather?.current_units || {};

  const currentAir = locationData.data?.airQuality?.current;

  const airUnits =
    locationData.data?.airQuality?.current_units || {};

  const selectedAlerts = locationData.data?.alerts || [];

  const sourceStatus =
    locationData.data?.sourceStatus || {};

  // Environmental indicator cards.
  const conditionCards = [
    {
      title: "Temperature",
      description: "Air temperature at 2 metres",
      value: formatReading(currentWeather?.temperature_2m),
      unit: weatherUnits.temperature_2m || "°C",
      icon: Thermometer,
      color: "blue",
      source: currentWeather?.time
        ? `Open-Meteo model · ${formatTimestamp(currentWeather.time)}`
        : "Awaiting weather model",
    },
    {
      title: "Relative humidity",
      description: "Near-surface humidity",
      value: formatReading(
        currentWeather?.relative_humidity_2m,
        0
      ),
      unit: weatherUnits.relative_humidity_2m || "%",
      icon: Droplets,
      color: "cyan",
      source: currentWeather?.time
        ? `Open-Meteo model · ${formatTimestamp(currentWeather.time)}`
        : "Awaiting weather model",
    },
    {
      title: "Precipitation",
      description: "Current model precipitation value",
      value: formatReading(currentWeather?.precipitation),
      unit: weatherUnits.precipitation || "mm",
      icon: Waves,
      color: "blue",
      source: currentWeather?.time
        ? `Open-Meteo model · ${formatTimestamp(currentWeather.time)}`
        : "Awaiting weather model",
    },
    {
      title: "Wind speed",
      description: "Wind speed at 10 metres",
      value: formatReading(currentWeather?.wind_speed_10m),
      unit: weatherUnits.wind_speed_10m || "km/h",
      icon: Wind,
      color: "green",
      source: currentWeather?.time
        ? `Open-Meteo model · ${formatTimestamp(currentWeather.time)}`
        : "Awaiting weather model",
    },
    {
      title: "US Air Quality Index",
      description: "Modelled air-quality index",
      value: formatReading(currentAir?.us_aqi, 0),
      unit: "AQI",
      icon: Wind,
      color: "orange",
      source: currentAir?.time
        ? `CAMS via Open-Meteo · ${formatTimestamp(currentAir.time)}`
        : "Awaiting air-quality model",
    },
    {
      title: "PM2.5",
      description: "Fine particulate matter concentration",
      value: formatReading(currentAir?.pm2_5),
      unit: airUnits.pm2_5 || "μg/m³",
      icon: Sun,
      color: "cyan",
      source: currentAir?.time
        ? `CAMS via Open-Meteo · ${formatTimestamp(currentAir.time)}`
        : "Awaiting air-quality model",
    },
  ];

  const conditionStatusLabel =
    locationData.status === "loaded"
      ? "CURRENT MODEL DATA"
      : locationData.status === "partial"
        ? "PARTIAL DATA"
        : locationData.status === "loading"
          ? "UPDATING DATA"
          : locationData.status === "error"
            ? "DATA UNAVAILABLE"
            : "SELECT A LOCATION";

  // Filter event markers according to the map dropdown.
  const visibleMapEvents = liveEventsData.events.filter((event) => {
    const category = String(event.category || "").toLowerCase();

    switch (activeMapMode) {
      case "country":
        return false;

      case "all-events":
        return true;

      case "wildfires":
        return category.includes("fire");

      case "earthquakes":
        return category.includes("earthquake");

      case "storms-floods":
        return (
          category.includes("storm") ||
          category.includes("flood") ||
          category.includes("hurricane") ||
          category.includes("typhoon") ||
          category.includes("cyclone") ||
          category.includes("tornado")
        );

      case "volcanoes":
        return category.includes("volcano");

      default:
        return false;
    }
  });

  const visibleMappedEventCount = visibleMapEvents.filter(
    (event) =>
      Number.isFinite(event.latitude) &&
      Number.isFinite(event.longitude)
  ).length;

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
          <a href="#events">Live events</a>
          <a href="#summary">Earth Summary</a>
        </nav>

        <div className="topbar-status">
          <span className="status-dot" />
          Live data feeds
        </div>
      </header>

      <main className="main-content" id="overview">
        <section className="intro">
          <p className="eyebrow">OUR PLANET. ONE VIEW.</p>

          <h1>
            Explore the health of <span>Earth.</span>
          </h1>

          <p className="intro-description">
            Explore current environmental conditions and reported
            Earth events through scientific data feeds and satellite
            imagery.
          </p>
        </section>

        {/* Interactive Earth map */}
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

          <div className="map-frame map-frame-controls">
            <CesiumGlobe
              onCountrySelect={handleCountrySelect}
              liveEvents={visibleMapEvents}
            />

            {/* Map view dropdown */}
            <div className="map-mode-dropdown">
              <label htmlFor="map-mode-select">MAP VIEW</label>

              <div className="map-select-wrapper">
                <select
                  id="map-mode-select"
                  value={activeMapMode}
                  onChange={(event) =>
                    setActiveMapMode(event.target.value)
                  }
                >
                  <option value="country">Country Explorer</option>
                  <option value="all-events">All Global Events</option>
                  <option value="wildfires">Wildfires</option>
                  <option value="earthquakes">Earthquakes</option>
                  <option value="storms-floods">Storms & Floods</option>
                  <option value="volcanoes">Volcanoes</option>
                </select>

                <span className="map-select-chevron">⌄</span>
              </div>
            </div>

            {/* Legend appears in All Global Events mode */}
            {activeMapMode === "all-events" && (
              <div className="event-map-legend">
                <h4>EVENT LEGEND</h4>

                <div className="event-legend-item">
                  <span className="event-legend-dot fire-dot" />
                  Fires & Volcanoes
                </div>

                <div className="event-legend-item">
                  <span className="event-legend-dot earthquake-dot" />
                  Earthquakes
                </div>

                <div className="event-legend-item">
                  <span className="event-legend-dot storm-dot" />
                  Storms & Floods
                </div>

                <div className="event-legend-item">
                  <span className="event-legend-dot other-dot" />
                  Other Events
                </div>
              </div>
            )}

            <div className="map-caption">
              <span>
                {activeMapMode === "country"
                  ? "Country Explorer · Select a country"
                  : `${visibleMappedEventCount} visible event locations`}
              </span>

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

        {/* NEW: EDGAR country emissions profile */}
        {selectedLocation && (
  <CountryEmissionsProfile country={selectedLocation} />
)}

<OrbitalDebrisMonitor />
<OrbitalDebrisSimulation />

        {/* Environmental indicators */}
        <section className="indicators-section" id="indicators">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                CURRENT CONDITIONS · OPEN-METEO
              </p>
              <h2>Environmental readings</h2>
            </div>

            <span className="data-status">
              {conditionStatusLabel}
            </span>
          </div>

          {!selectedLocation && (
            <p className="intro-description">
              Select a point on the globe to load current model-based
              weather and air-quality estimates for that location.
            </p>
          )}

          {locationData.status === "error" && (
            <p className="indicator-note">
              Current conditions could not be loaded:{" "}
              {locationData.error ||
                "The data sources did not return a reading."}
            </p>
          )}

          <div className="indicator-grid">
            {conditionCards.map((item) => {
              const Icon = item.icon;
              const hasValue = item.value !== "—";

              return (
                <article
                  className="indicator-card"
                  key={item.title}
                >
                  <div className={`indicator-icon ${item.color}`}>
                    <Icon size={23} />
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="indicator-value">
                    {hasValue
                      ? `${item.value} ${item.unit}`
                      : "—"}
                  </div>

                  <span className="indicator-note">
                    {locationData.status === "loading" && !hasValue
                      ? "Requesting current data..."
                      : item.source}
                  </span>
                </article>
              );
            })}
          </div>

          {locationData.data && (
            <p className="indicator-note live-data-disclaimer">
              Weather values are current model estimates from
              Open-Meteo, not guaranteed direct station observations.
              Air-quality values are model-based estimates from the
              CAMS system distributed through Open-Meteo. The app
              checks again every 15 minutes; the underlying models
              update on their own schedules.
            </p>
          )}

          {/* National Weather Service alerts */}
          <div className="location-alerts">
            <div className="location-alerts-heading">
              <div>
                <p className="eyebrow">UNITED STATES ONLY</p>
                <h3>National Weather Service alerts</h3>
              </div>

              <span className="data-status">
                {sourceStatus.nws === "connected"
                  ? `${selectedAlerts.length} ACTIVE`
                  : sourceStatus.nws === "not-covered"
                    ? "NOT IN COVERAGE"
                    : sourceStatus.nws === "unavailable"
                      ? "UNAVAILABLE"
                      : selectedLocation
                        ? "CHECKING"
                        : "SELECT A LOCATION"}
              </span>
            </div>

            {!selectedLocation ? (
              <p className="indicator-note">
                Select a map location to check for active U.S.
                weather alerts.
              </p>
            ) : sourceStatus.nws === "not-covered" ? (
              <p className="indicator-note">
                The National Weather Service point-alert feed is
                currently queried for the contiguous United States
                only.
              </p>
            ) : sourceStatus.nws === "connected" &&
              selectedAlerts.length === 0 ? (
              <p className="indicator-note">
                No active NWS alerts were returned for this point.
                This is not a guarantee that no local hazards exist.
              </p>
            ) : sourceStatus.nws === "connected" ? (
              <div className="location-alert-list">
                {selectedAlerts.slice(0, 4).map((alert) => (
                  <article
                    className="location-alert-item"
                    key={alert.id}
                  >
                    <div>
                      <strong>{alert.headline}</strong>
                      <p>
                        {alert.event} · Severity: {alert.severity}
                      </p>
                      <span>
                        Effective: {formatTimestamp(alert.effective)}
                        {" · "}
                        Expires: {formatTimestamp(alert.expires)}
                      </span>
                    </div>

                    <a
                      href={alert.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      NWS source ↗
                    </a>
                  </article>
                ))}
              </div>
            ) : sourceStatus.nws === "unavailable" ? (
              <p className="indicator-note">
                The NWS alert service could not be reached for
                this point.
              </p>
            ) : (
              <p className="indicator-note">
                Checking the active-alert feed…
              </p>
            )}
          </div>

          {locationData.data?.errors?.length > 0 && (
            <p className="indicator-note">
              Some sources were unavailable:{" "}
              {locationData.data.errors.join(" · ")}
            </p>
          )}

          <div className="live-attribution">
            <span>
              Weather:{" "}
              <a
                href="https://open-meteo.com/en/docs"
                target="_blank"
                rel="noreferrer"
              >
                Open-Meteo ↗
              </a>
            </span>

            <span>
              Air quality:{" "}
              <a
                href="https://open-meteo.com/en/docs/air-quality-api"
                target="_blank"
                rel="noreferrer"
              >
                CAMS via Open-Meteo ↗
              </a>
            </span>

            <span>
              Alerts:{" "}
              <a
                href="https://www.weather.gov/documentation/services-web-api"
                target="_blank"
                rel="noreferrer"
              >
                NOAA / NWS ↗
              </a>
            </span>
          </div>
        </section>

        {/* All events remain visible in the events panel */}
        <div id="events">
          <LiveEventsPanel
            data={liveEventsData}
            loading={liveEventsLoading}
          />
        </div>

        {/* Earth health summary */}
        <section className="summary-section" id="summary">
          <div className="summary-icon">
            <Activity size={25} />
          </div>

          <div className="summary-content">
            <p className="eyebrow">PLANETARY OVERVIEW</p>
            <h2>Earth Health Summary</h2>

            <p>
              Live event locations are currently supplied by NASA
              EONET and USGS. Selecting a point loads model-based
              weather and air-quality estimates, plus U.S. National
              Weather Service alerts where available. Evidence-based
              environmental scoring and AI interpretation will be
              added only after their underlying data and methodology
              are connected.
            </p>

            <div className="summary-footer">
              <span>
                <Leaf size={15} /> Source-linked information
              </span>

              <span>
                <TrendingUp size={15} /> Historical comparisons next
              </span>

              <span>
                <Bot size={15} /> AI-assisted explanations next
              </span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>EARTH DOCTOR AI</span>
          <span>
            Weather and air-quality estimates are model-based.
            Event times are source-reported.
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
