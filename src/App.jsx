import { useCallback, useRef, useState } from "react";

import AppHeader from "./components/AppHeader";
import CountrySearch from "./components/CountrySearch";
import GlobeWorkspace from "./components/GlobeWorkspace";
import LocationPanel from "./components/LocationPanel";
import AlertsPanel from "./components/AlertsPanel";
import EventSummary from "./components/EventSummary";
import ForecastCharts from "./components/ForecastCharts";
import EventExplorer from "./components/EventExplorer";
import SourcesPanel from "./components/SourcesPanel";
import AroundEarth from "./components/AroundEarth";
import CountryEmissionsProfile from "./CountryEmissionsProfile";

import { useGlobalEvents, useLocationData } from "./hooks/useEarthData";
import { getEdgarCountryProfile } from "./assets/edgarData";
import { EVENT_GROUPS } from "./lib/eventTypes";
import { fmtCoord, isNum } from "./lib/format";

import "./App.css";

const ALL_LAYERS_ON = Object.fromEntries(EVENT_GROUPS.map((group) => [group.id, true]));

function App() {
  const [section, setSection] = useState("inside");

  // Geographic state.
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchTarget, setSearchTarget] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  // Globe UI state.
  const [layers, setLayers] = useState(ALL_LAYERS_ON);
  const [command, setCommand] = useState(null);
  const commandSeq = useRef(0);

  // Data.
  const { data: eventsData, loading: eventsLoading } = useGlobalEvents();
  const locationState = useLocationData(selectedLocation?.latitude, selectedLocation?.longitude);

  const issueCommand = useCallback((next) => {
    commandSeq.current += 1;
    setCommand({ ...next, seq: commandSeq.current });
  }, []);

  const handleLocationSelect = useCallback((location) => {
    setSelectedLocation(location);
  }, []);

  const handleSearchSelect = useCallback((country) => {
    const code = String(country.code || "").toUpperCase();
    const profile = getEdgarCountryProfile(code) || getEdgarCountryProfile(country.name);
    const name = profile?.name || country.name;

    // Country search shows the EDGAR profile and flies to the polygon.
    // It intentionally does not invent a weather coordinate.
    setSelectedLocation({ name, code });
    commandSeq.current += 1;
    setSearchTarget({ name, code, requestId: commandSeq.current });
    setSection("inside");
  }, []);

  const handleSelectEvent = useCallback(
    (eventId, { focus = false } = {}) => {
      setSelectedEventId(eventId);
      if (!focus) return;
      const event = eventsData.events.find((item) => item.id === eventId);
      if (event && isNum(event.latitude) && isNum(event.longitude)) {
        issueCommand({ type: "focus", latitude: event.latitude, longitude: event.longitude, height: 2_400_000 });
      }
    },
    [eventsData.events, issueCommand]
  );

  const selectedEvent = selectedEventId
    ? eventsData.events.find((event) => event.id === selectedEventId) ?? null
    : null;

  const hasPoint = isNum(selectedLocation?.latitude) && isNum(selectedLocation?.longitude);
  const pointSources = locationState.data?.sourceStatus || {};
  const pointStatus = (key) =>
    !hasPoint ? "idle" : locationState.status === "loading" && !pointSources[key] ? "loading" : pointSources[key] || "idle";

  const headerSources =
    section === "inside"
      ? [
          { label: "EONET", status: eventsData.sourceStatus.eonet, detail: "NASA natural events" },
          { label: "USGS", status: eventsData.sourceStatus.usgs, detail: "Earthquakes M2.5+" },
          { label: "WX", status: pointStatus("weather"), detail: "Open-Meteo weather (selected point)" },
          { label: "AQ", status: pointStatus("airQuality"), detail: "CAMS air quality (selected point)" },
          { label: "NWS", status: pointStatus("nws"), detail: "NOAA/NWS alerts (US points)" },
        ]
      : [];

  return (
    <div className="app" id="top">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <AppHeader
        section={section}
        onSectionChange={setSection}
        search={section === "inside" ? <CountrySearch onSelect={handleSearchSelect} /> : null}
        sources={headerSources}
      />

      <main id="main" className="workspace">
        {/* Inside Earth stays mounted so the Cesium viewer is not rebuilt
            on every tab switch; it stops rendering while hidden. */}
        <div className="section-body" hidden={section !== "inside"}>
            <div className="page-head">
              <div>
                <h1>Surface environment monitor</h1>
                <p className="page-context">
                  {selectedLocation ? (
                    <>
                      Selected: <strong>{selectedLocation.name || "Unnamed area"}</strong>
                      {hasPoint && (
                        <span className="mono"> · {fmtCoord(selectedLocation.latitude, selectedLocation.longitude, 3)}</span>
                      )}
                    </>
                  ) : (
                    "Global natural events, earthquakes and point conditions from public scientific feeds."
                  )}
                </p>
              </div>
            </div>

            <div className="grid-main">
              <GlobeWorkspace
                events={eventsData.events}
                eventsLoading={eventsLoading}
                eventsFetchedAt={eventsData.fetchedAt}
                layers={layers}
                onLayersChange={setLayers}
                selectedLocation={selectedLocation}
                selectedEvent={selectedEvent}
                onLocationSelect={handleLocationSelect}
                onEventSelect={handleSelectEvent}
                searchTarget={searchTarget}
                command={command}
                onCommand={issueCommand}
              />

              <div className="side-col">
                <LocationPanel location={selectedLocation} state={locationState} onClear={() => setSelectedLocation(null)} />
                <AlertsPanel location={selectedLocation} state={locationState} />
                <EventSummary
                  data={eventsData}
                  loading={eventsLoading}
                  selectedEventId={selectedEventId}
                  onSelectEvent={handleSelectEvent}
                />
              </div>
            </div>

            <ForecastCharts location={selectedLocation} state={locationState} />

            {selectedLocation?.name && <CountryEmissionsProfile country={selectedLocation} />}

            <EventExplorer
              data={eventsData}
              loading={eventsLoading}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
            />

            <SourcesPanel eventStatus={eventsData.sourceStatus} locationStatus={pointSources} hasPoint={hasPoint} />
        </div>

        {section === "outside" && <AroundEarth />}

        <footer className="app-footer">
          <span>Earth Doctor</span>
          <span>
            {section === "inside"
              ? "Weather and air quality are model estimates, not station observations. Event times are as reported by each source."
              : "Ozone maps are NASA satellite products. 3D models are illustrative; statistics cite their source snapshots."}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
