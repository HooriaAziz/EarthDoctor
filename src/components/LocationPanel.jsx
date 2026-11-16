import { AlertTriangle, MousePointerClick, RefreshCw, X } from "lucide-react";
import { Panel, StatusBadge } from "./ui";
import { cardinal, fmtCoord, fmtDateTime, fmtInt, fmtLocalWallClock, fmtNum, isNum } from "../lib/format";
import { AQI_SCALE_MAX, aqiCategory, describeWeatherCode } from "../lib/weather";

function Metric({ label, value, unit, digits = 1, extra, title }) {
  const display = typeof value === "string" ? value : fmtNum(value, digits);
  const missing = display === "—";
  return (
    <div className="metric" title={title}>
      <dt>{label}</dt>
      <dd>
        <span className="num metric-value">{display}</span>
        {!missing && unit && <span className="metric-unit">{unit}</span>}
        {!missing && extra && <span className="metric-extra">{extra}</span>}
      </dd>
    </div>
  );
}

function AqiScale({ value }) {
  const position = isNum(value) ? Math.min(value / AQI_SCALE_MAX, 1) * 100 : null;
  return (
    <div className="aqi-scale" aria-hidden="true">
      <div className="aqi-scale-track">
        <span style={{ flexGrow: 50 }} className="aqi-good" />
        <span style={{ flexGrow: 50 }} className="aqi-moderate" />
        <span style={{ flexGrow: 50 }} className="aqi-usg" />
        <span style={{ flexGrow: 150 }} className="aqi-bad" />
      </div>
      {position !== null && <span className="aqi-marker" style={{ left: `${position}%` }} />}
      <div className="aqi-scale-ticks mono">
        <span>0</span>
        <span>50</span>
        <span>100</span>
        <span>150</span>
        <span>300+</span>
      </div>
    </div>
  );
}

export default function LocationPanel({ location, state, onClear }) {
  const hasPoint = isNum(location?.latitude) && isNum(location?.longitude);
  const weather = state.data?.weather;
  const air = state.data?.airQuality;
  const wx = weather?.current;
  const wxUnits = weather?.current_units || {};
  const aq = air?.current;
  const aqUnits = air?.current_units || {};
  const tzAbbr = weather?.timezone_abbreviation || air?.timezone_abbreviation || "";

  const category = aqiCategory(aq?.us_aqi);
  const condition = describeWeatherCode(wx?.weather_code);

  const status = !location ? "idle" : !hasPoint ? "idle" : state.status;

  return (
    <Panel
      id="location-intel"
      className="location-panel"
      title="Location intelligence"
      actions={
        <>
          <StatusBadge
            status={status}
            label={
              status === "loaded"
                ? "Model current"
                : status === "idle"
                  ? hasPoint || !location ? "No point" : "Country only"
                  : undefined
            }
          />
          {hasPoint && (
            <button
              type="button"
              className="icon-btn"
              onClick={state.reload}
              disabled={state.status === "loading"}
              aria-label="Retry weather and air quality"
              title="Retry weather and air quality"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {location && (
            <button type="button" className="icon-btn" onClick={onClear} aria-label="Clear selection" title="Clear selection">
              <X size={14} />
            </button>
          )}
        </>
      }
    >
      {!location ? (
        <div className="intel-empty">
          <MousePointerClick size={18} aria-hidden="true" />
          <div>
            <strong>No location selected</strong>
            <ol>
              <li>Click any point on the globe, or search a country.</li>
              <li>Model weather and air quality load for that point.</li>
              <li>US points also check active NWS alerts.</li>
            </ol>
          </div>
        </div>
      ) : (
        <>
          <div className="intel-identity">
            <div>
              <h3 className="intel-name">{location.name || "Unnamed area"}</h3>
              <p className="intel-sub mono">
                {hasPoint ? fmtCoord(location.latitude, location.longitude, 3) : "No coordinate selected"}
                {isNum(weather?.elevation) && ` · elev ${fmtInt(weather.elevation)} m`}
                {tzAbbr && ` · ${tzAbbr}`}
              </p>
            </div>
            {condition && <span className="intel-condition">{condition}</span>}
          </div>

          {!hasPoint ? (
            <p className="intel-note">
              Country selected from search. Click a point inside {location.name} on the globe to load
              local model conditions — no coordinate is assumed for a whole country.
            </p>
          ) : state.status === "error" ? (
            <div className="intel-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Conditions could not be loaded. {state.error}</span>
            </div>
          ) : (
            <>
              <div className="kpi-pair">
                <div className="kpi kpi-temp">
                  <span className="kpi-label">Air temperature · 2 m</span>
                  <span className="kpi-value num">
                    {fmtNum(wx?.temperature_2m)}
                    <span className="kpi-unit">{wxUnits.temperature_2m || "°C"}</span>
                  </span>
                  <span className="kpi-sub">
                    Feels like <span className="num">{fmtNum(wx?.apparent_temperature)}</span>
                    {isNum(wx?.apparent_temperature) && ` ${wxUnits.apparent_temperature || "°C"}`}
                  </span>
                </div>
                <div className={`kpi kpi-aqi tone-${category?.tone || "none"}`}>
                  <span className="kpi-label">US AQI</span>
                  <span className="kpi-value num">{fmtInt(aq?.us_aqi)}</span>
                  <span className="kpi-sub aqi-cat">{category ? category.label : "—"}</span>
                  <AqiScale value={aq?.us_aqi} />
                </div>
              </div>

              <dl className="metric-grid">
                <Metric label="Humidity" value={wx?.relative_humidity_2m} digits={0} unit={wxUnits.relative_humidity_2m || "%"} />
                <Metric
                  label="Wind · 10 m"
                  value={wx?.wind_speed_10m}
                  unit={wxUnits.wind_speed_10m || "km/h"}
                  extra={cardinal(wx?.wind_direction_10m)}
                  title={isNum(wx?.wind_direction_10m) ? `From ${wx.wind_direction_10m}°` : undefined}
                />
                <Metric label="Precipitation" value={wx?.precipitation} unit={wxUnits.precipitation || "mm"} />
                <Metric label="Surface pressure" value={wx?.surface_pressure} digits={0} unit={wxUnits.surface_pressure || "hPa"} />
                <Metric label="Cloud cover" value={wx?.cloud_cover} digits={0} unit={wxUnits.cloud_cover || "%"} />
                <Metric label="PM2.5" value={aq?.pm2_5} unit={aqUnits.pm2_5 || "μg/m³"} />
                <Metric label="PM10" value={aq?.pm10} unit={aqUnits.pm10 || "μg/m³"} />
                <Metric label="Ozone · O₃" value={aq?.ozone} digits={0} unit={aqUnits.ozone || "μg/m³"} />
                <Metric label="NO₂" value={aq?.nitrogen_dioxide} unit={aqUnits.nitrogen_dioxide || "μg/m³"} />
              </dl>

              <dl className="provenance">
                <div>
                  <dt>Weather</dt>
                  <dd>
                    <span className="data-kind">Modeled</span> Open-Meteo ·{" "}
                    <span className="mono">{wx?.time ? `${fmtLocalWallClock(wx.time)} ${tzAbbr}` : "—"}</span>
                  </dd>
                </div>
                <div>
                  <dt>Air quality</dt>
                  <dd>
                    <span className="data-kind">Modeled</span> CAMS via Open-Meteo ·{" "}
                    <span className="mono">{aq?.time ? `${fmtLocalWallClock(aq.time)} ${tzAbbr}` : "—"}</span>
                  </dd>
                </div>
                <div>
                  <dt>Retrieved</dt>
                  <dd className="mono">{fmtDateTime(state.data?.fetchedAt)}</dd>
                </div>
              </dl>

              {state.data?.errors?.length > 0 && (
                <p className="intel-warn">
                  <AlertTriangle size={12} aria-hidden="true" /> {state.data.errors.join(" · ")}
                </p>
              )}
            </>
          )}
        </>
      )}
    </Panel>
  );
}
