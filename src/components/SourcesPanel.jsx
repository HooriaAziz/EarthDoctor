import { Panel, StatusBadge } from "./ui";

// Data provenance for the Inside Earth workspace.
export default function SourcesPanel({ eventStatus, locationStatus, hasPoint }) {
  const pointStatus = (status) => (hasPoint ? status || "loading" : "idle");

  const rows = [
    {
      name: "NASA EONET v3",
      provides: "Open natural events (fires, storms, volcanoes, ice)",
      kind: "Curated event feed",
      cadence: "Checked every 5 min · source updates irregularly",
      status: eventStatus.eonet,
      url: "https://eonet.gsfc.nasa.gov/",
    },
    {
      name: "USGS Earthquake Hazards",
      provides: "M2.5+ earthquakes, past day (GeoJSON summary)",
      kind: "Observed · automatic + reviewed",
      cadence: "Checked every 5 min · feed updates ~1 min",
      status: eventStatus.usgs,
      url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
    },
    {
      name: "Open-Meteo Forecast API",
      provides: "Current conditions, hourly −24 h / +48 h",
      kind: "Modeled (NWP best match)",
      cadence: "Checked every 15 min for the selected point",
      status: pointStatus(locationStatus.weather),
      url: "https://open-meteo.com/en/docs",
    },
    {
      name: "CAMS via Open-Meteo",
      provides: "US AQI, PM2.5, PM10, O₃, NO₂",
      kind: "Modeled (Copernicus CAMS)",
      cadence: "Checked every 15 min for the selected point",
      status: pointStatus(locationStatus.airQuality),
      url: "https://open-meteo.com/en/docs/air-quality-api",
    },
    {
      name: "NOAA / NWS Alerts API",
      provides: "Active alerts for the selected point",
      kind: "Official warnings · contiguous US",
      cadence: "Checked with the selected point",
      status: pointStatus(locationStatus.nws),
      url: "https://www.weather.gov/documentation/services-web-api",
    },
    {
      name: "EDGAR 2026 (JRC)",
      provides: "Country GHG emissions 1970–2025",
      kind: "Inventory · bundled snapshot",
      cadence: "Static dataset",
      status: "connected",
      statusLabel: "Bundled",
      url: "https://edgar.jrc.ec.europa.eu/report_2026",
    },
    {
      name: "Esri World Imagery",
      provides: "Globe base imagery, boundaries & labels",
      kind: "Basemap",
      cadence: "Tiled on demand",
      status: "connected",
      statusLabel: "Tiles",
      url: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    },
  ];

  return (
    <Panel id="sources" className="sources-panel" title="Data sources" meta="What each value is, and where it comes from">
      <div className="table-wrap">
        <table className="source-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Provides</th>
              <th scope="col">Data type</th>
              <th scope="col">Refresh</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.name} ↗
                  </a>
                </th>
                <td>{row.provides}</td>
                <td>{row.kind}</td>
                <td className="muted">{row.cadence}</td>
                <td>
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
