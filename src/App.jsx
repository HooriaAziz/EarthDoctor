import { useEffect, useState } from "react";
import {
  Activity,
  Droplets,
  Globe2,
  Leaf,
  Wind,
  Sun,
  Thermometer,
  Waves,
  Search,
  X,
  Satellite,
} from "lucide-react";
import OrbitalDebrisEducation from "./OrbitalDebrisEducation.jsx";
import OzoneEducation from "./OzoneEducation.jsx";
import CesiumGlobe from "./CesiumGlobe";
import LiveEventsPanel from "./LiveEventsPanel";
import CountryEmissionsProfile from "./CountryEmissionsProfile";
import OrbitalDebrisMonitor from "./OrbitalDebrisMonitor";
import OrbitalDebrisSimulation from "./OrbitalDebrisSimulation";
import OzoneLayerMonitor from "./OzoneLayerMonitor";

import {
  fetchLiveEarthData,
  fetchSelectedLocationData,
} from "./liveEarthData";

import "./App.css";
import "./LiveLocationAlerts.css";

import {
  EDGAR_COUNTRIES,
  getEdgarCountryProfile,
} from "./assets/edgarData";

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

function normalizeCountrySearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function App() {
  const [activeSection, setActiveSection] = useState("inside");

  const [activeOutsideView, setActiveOutsideView] =
    useState("atmosphere");

  const [selectedLocation, setSelectedLocation] = useState(null);

  const [countrySearch, setCountrySearch] = useState("");
  const [showCountrySearchResults, setShowCountrySearchResults] =
    useState(false);
  const [mapSearchTarget, setMapSearchTarget] = useState(null);

  const [liveEventsData, setLiveEventsData] =
    useState(EMPTY_LIVE_EVENTS);

  const [liveEventsLoading, setLiveEventsLoading] = useState(true);

  const [activeMapMode, setActiveMapMode] = useState("country");

  const [locationData, setLocationData] = useState({
    status: "idle",
    data: null,
    error: null,
  });

  // Search suggestions are taken from the existing EDGAR country data.
  const normalizedQuery = normalizeCountrySearch(countrySearch);

  const countrySearchResults = normalizedQuery
    ? EDGAR_COUNTRIES.filter((country) => {
        const name = normalizeCountrySearch(country.name);
        const code = String(country.code || "").toLowerCase();

        return (
          name.includes(normalizedQuery) ||
          code.includes(normalizedQuery.replace(/\s/g, ""))
        );
      }).slice(0, 8)
    : [];

  // Include a direct alias match, such as USA, if it is not already
  // present in the suggestions.
  const directProfile = normalizedQuery
    ? getEdgarCountryProfile(countrySearch.trim())
    : null;

  const hasDirectProfile = directProfile
    ? countrySearchResults.some(
        (country) =>
          String(country.code).toUpperCase() ===
          String(directProfile.code).toUpperCase()
      )
    : false;

  const displayedCountryResults =
    directProfile && !hasDirectProfile
      ? [directProfile, ...countrySearchResults].slice(0, 8)
      : countrySearchResults;

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

  function handleCountrySearchSelect(country) {
    const code = String(country.code || "").toUpperCase();

    const profile =
      getEdgarCountryProfile(code) ||
      getEdgarCountryProfile(country.name);

    const selectedName = profile?.name || country.name;

    // Country selection displays the EDGAR profile.
    // It intentionally does not invent a weather coordinate.
    setSelectedLocation({
      name: selectedName,
      code,
    });

    // Request that Cesium finds and zooms to this country.
    setMapSearchTarget({
      name: selectedName,
      code,
      requestId: Date.now(),
    });

    setCountrySearch(selectedName);
    setShowCountrySearchResults(false);
    setActiveMapMode("country");
  }

  function clearCountrySearch() {
    setCountrySearch("");
    setShowCountrySearchResults(false);
  }

  function handleCountrySearchKeyDown(event) {
    if (event.key === "Escape") {
      setShowCountrySearchResults(false);
    }

    if (
      event.key === "Enter" &&
      displayedCountryResults.length > 0
    ) {
      event.preventDefault();
      handleCountrySearchSelect(displayedCountryResults[0]);
    }
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

        <div className="topbar-status">
          <span className="status-dot" />
          Live data feeds
        </div>
      </header>

      <main className="main-content" id="overview">
        <section className="main-section-navigation">
          <button
            type="button"
            className={`main-section-tab ${
              activeSection === "inside" ? "active" : ""
            }`}
            onClick={() => setActiveSection("inside")}
            aria-pressed={activeSection === "inside"}
          >
            <Globe2 size={21} />
            <span>
              <strong>Inside Earth</strong>
              <small>Planetary health and environment</small>
            </span>
          </button>

          <button
            type="button"
            className={`main-section-tab ${
              activeSection === "outside" ? "active" : ""
            }`}
            onClick={() => setActiveSection("outside")}
            aria-pressed={activeSection === "outside"}
          >
            <Activity size={21} />
            <span>
              <strong>Around Earth</strong>
              <small>Atmosphere and orbital environment</small>
            </span>
          </button>
        </section>

        {activeSection === "inside" && (
          <>
            <section className="intro">
              <p className="eyebrow">OUR PLANET. ONE VIEW.</p>

              <h1>
                Explore the health of <span>Earth.</span>
              </h1>

              <p className="intro-description">
                Monitor environmental conditions, country emissions
                and reported natural events using scientific data
                feeds and satellite imagery.
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

              {/* Country search */}
              <div className="country-search">
                <div className="country-search-input-wrap">
                  <Search size={18} aria-hidden="true" />

                  <input
                    type="search"
                    value={countrySearch}
                    placeholder="Search a country (e.g. Japan, USA, Russia)"
                    aria-label="Search countries"
                    aria-expanded={
                      showCountrySearchResults &&
                      countrySearch.trim().length > 0
                    }
                    aria-controls="country-search-results"
                    onChange={(event) => {
                      setCountrySearch(event.target.value);
                      setShowCountrySearchResults(true);
                    }}
                    onFocus={() => setShowCountrySearchResults(true)}
                    onKeyDown={handleCountrySearchKeyDown}
                  />

                  {countrySearch && (
                    <button
                      type="button"
                      className="country-search-clear"
                      onClick={clearCountrySearch}
                      aria-label="Clear country search"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>

                {showCountrySearchResults &&
                  countrySearch.trim() && (
                    <div
                      className="country-search-results"
                      id="country-search-results"
                    >
                      {displayedCountryResults.length > 0 ? (
                        displayedCountryResults.map((country) => (
                          <button
                            type="button"
                            key={country.code}
                            onClick={() =>
                              handleCountrySearchSelect(country)
                            }
                          >
                            <span>{country.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="country-search-empty">
                          No matching country found.
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div className="map-frame map-frame-controls">
                <CesiumGlobe
                  onCountrySelect={handleCountrySelect}
                  liveEvents={visibleMapEvents}
                  searchTarget={mapSearchTarget}
                />

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

            {selectedLocation && (
              <CountryEmissionsProfile country={selectedLocation} />
            )}

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
                  Select a point on the globe to load current
                  model-based weather and air-quality estimates
                  for that location.
                </p>
              )}

              {selectedLocation &&
                typeof selectedLocation.latitude !== "number" && (
                  <p className="intro-description">
                    A country is selected. Click a specific point
                    on the globe to load local weather and
                    air-quality estimates.
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
                  Open-Meteo, not guaranteed direct station
                  observations. Air-quality values are model-based
                  estimates from the CAMS system distributed through
                  Open-Meteo. The app checks again every 15 minutes;
                  the underlying models update on their own schedules.
                </p>
              )}

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

            <div id="events">
              <LiveEventsPanel
                data={liveEventsData}
                loading={liveEventsLoading}
              />
            </div>

            
          </>
        )}

        {activeSection === "outside" && (
          <>
            <section className="intro">
              <p className="eyebrow">ATMOSPHERE & ORBIT</p>

              <h1>
                What surrounds <span>Earth?</span>
              </h1>

              <p className="intro-description">
                Explore Earth's ozone layer, monitor atmospheric
                conditions, and investigate human-made objects
                orbiting our planet.
              </p>
            </section>

            <section className="orbital-section-heading">
              <div>
                <p className="eyebrow">EARTH SYSTEM MONITORING</p>
                <h2>Atmosphere &amp; Orbit</h2>
                <p>
                  Monitor Earth's atmospheric ozone and explore
                  human-made objects in the orbital environment.
                </p>
              </div>
            </section>

            <div
              className="outside-view-tabs"
              role="tablist"
              aria-label="Around Earth monitoring views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeOutsideView === "atmosphere"}
                className={`outside-view-tab ${
                  activeOutsideView === "atmosphere" ? "active" : ""
                }`}
                onClick={() => setActiveOutsideView("atmosphere")}
              >
                <Satellite size={16} />
                Atmosphere
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeOutsideView === "orbit"}
                className={`outside-view-tab ${
                  activeOutsideView === "orbit" ? "active" : ""
                }`}
                onClick={() => setActiveOutsideView("orbit")}
              >
                <Globe2 size={16} />
                Orbital environment
              </button>
            </div>

            {activeOutsideView === "atmosphere" ? (
  <>
    <OrbitalDebrisSimulation mode="ozone" />
    <OzoneLayerMonitor />

    {/* Educational information about the ozone layer */}
    <OzoneEducation />
  </>
) : (
              <>
                <section className="orbital-section-heading">
                  <div>
                    <p className="eyebrow">
                      SPACE ENVIRONMENT MONITORING
                    </p>
                    <h2>Orbital debris</h2>
                    <p>
                      Understand the population of human-made objects
                      orbiting our planet.
                    </p>
                  </div>
                </section>

                <OrbitalDebrisSimulation />
                <OrbitalDebrisMonitor />
                <OrbitalDebrisEducation />
              </>
            )}
          </>
        )}

        <footer className="footer">
          <span>EARTH DOCTOR AI</span>
          <span>
            {activeSection === "inside"
              ? "Weather and air-quality estimates are model-based. Event times are source-reported."
              : "Ozone maps are NASA satellite imagery. Orbital visualization is illustrative; statistics are based on the cited source snapshot."}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;