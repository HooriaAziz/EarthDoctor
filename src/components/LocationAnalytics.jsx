import { useMemo, useState } from "react";
import { CloudSun, Database, LineChart, Wind } from "lucide-react";

import { Panel, EmptyState } from "./ui";
import HourlyCharts from "./HourlyCharts";
import XYChart from "./XYChart";
import { RangeTabs, SignedNumber, SourceLine, Sparkline } from "./trends/common";
import { useRemote } from "../hooks/useRemote";
import { AIR_POLLUTANTS, loadAirHistory, loadClimateRecord, loadDailyWeather } from "../data/loaders";
import { analyzeTimeSeries } from "../assets/earthTrendAnalysis";
import { aqiCategory } from "../lib/weather";
import { fmtNum, isNum } from "../lib/format";
import { SERIES_COLORS } from "../lib/colors";

const HOUR = 3600 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(day) {
  if (typeof day !== "string") return "";
  const [, m, d] = day.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

const AQI_COLORS = {
  good: SERIES_COLORS.green,
  moderate: SERIES_COLORS.amber,
  elevated: SERIES_COLORS.orange,
  critical: SERIES_COLORS.red,
};

const TABS = [
  { id: "hourly", label: "Hourly −24 h / +48 h", Icon: LineChart },
  { id: "air", label: "Air pollution · 92 days", Icon: Wind },
  { id: "weather", label: "Daily weather", Icon: CloudSun },
  { id: "climate", label: "Climate record 1950–", Icon: Database },
];

function pointKey(location) {
  return `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
}

// ------------------------------------------------------------------ air

const AQ_RANGES = [
  { id: 7, label: "7 d" },
  { id: 30, label: "30 d" },
  { id: 92, label: "92 d" },
];

const AQ_CHARTS = ["us_aqi", "pm2_5", "pm10", "nitrogen_dioxide", "ozone", "dust"];

function AirHistory({ location }) {
  const [days, setDays] = useState(30);
  const remote = useRemote(`aq-hist-${pointKey(location)}`, (s) => loadAirHistory(location.latitude, location.longitude, s), {
    maxAgeMs: HOUR,
  });

  const view = useMemo(() => {
    const data = remote.data;
    if (!data) return null;
    // Drop trailing days without a complete daily value (today / forecast).
    let end = data.days.length;
    while (end > 0 && !isNum(data.daily.us_aqi[end - 1]?.value) && !isNum(data.daily.pm2_5[end - 1]?.value)) end -= 1;
    const start = Math.max(0, end - days);
    const x = data.days.slice(start, end);
    const byKey = {};
    for (const p of AIR_POLLUTANTS) byKey[p.key] = (data.daily[p.key] || []).slice(start, end).map((d) => d.value);
    return { x, byKey };
  }, [remote.data, days]);

  if (!view) {
    return remote.status === "error" ? (
      <p className="row-note tone-bad">Air-quality history could not be loaded: {remote.error}</p>
    ) : (
      <p className="chart-empty">Loading 92 days of hourly CAMS data…</p>
    );
  }

  const stats = AIR_POLLUTANTS.map((p) => {
    const values = view.byKey[p.key].filter(isNum);
    const meanV = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const exceed = p.who24h ? values.filter((v) => v > p.who24h).length : null;
    const trend = values.length >= 14 ? analyzeTimeSeries(view.byKey[p.key].map((value, i) => ({ year: i, value })).filter((q) => isNum(q.value)), { alpha: 0.05, minimumObservations: 8 }) : null;
    return { ...p, values: view.byKey[p.key], meanV, maxV: values.length ? Math.max(...values) : null, exceed, n: values.length, trend };
  });

  return (
    <>
      <div className="tab-toolbar">
        <span className="panel-meta">
          CAMS via Open-Meteo · modeled · daily aggregates of hourly values · local dates ({remote.data.tz})
        </span>
        <RangeTabs value={days} onChange={setDays} options={AQ_RANGES} label="Days" />
      </div>

      <div className="table-wrap flush">
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th scope="col">Pollutant</th>
              <th scope="col">Daily value</th>
              <th scope="col" className="num-col">Mean</th>
              <th scope="col" className="num-col">Peak day</th>
              <th scope="col" className="num-col">WHO 24 h</th>
              <th scope="col" className="num-col">Days above</th>
              <th scope="col" className="num-col">Trend / week</th>
              <th scope="col">Last {days} d</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.key}>
                <th scope="row">
                  {s.label} {s.unit && <span className="muted">· {s.unit}</span>}
                </th>
                <td className="muted">{s.reducer === "max" ? "Max of hours" : "Mean of hours"}</td>
                <td className="num num-col">{fmtNum(s.meanV, s.digits)}</td>
                <td className="num num-col">{fmtNum(s.maxV, s.digits)}</td>
                <td className="num num-col muted">{s.who24h ?? "—"}</td>
                <td className={`num num-col ${s.exceed > 0 ? "delta-up" : ""}`}>
                  {s.exceed == null ? "—" : `${s.exceed} / ${s.n}`}
                </td>
                <td className="num num-col" title={s.trend ? `Sen's slope; Mann–Kendall p = ${fmtNum(s.trend.pValue, 3)}` : undefined}>
                  {s.trend ? (
                    <>
                      <SignedNumber value={s.trend.senSlopePerYear * 7} digits={s.digits === 0 ? 1 : 2} />
                      {!s.trend.isSignificant && <span className="muted"> ns</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Sparkline values={s.values} label={`${s.label} daily values`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chart-grid chart-grid-3">
        {AQ_CHARTS.map((key) => {
          const p = AIR_POLLUTANTS.find((q) => q.key === key);
          const values = view.byKey[key];
          const series = [
            {
              id: key,
              label: p.label,
              type: "bar",
              color: SERIES_COLORS.blue,
              colorAt: key === "us_aqi" ? (v) => AQI_COLORS[aqiCategory(v)?.tone] || SERIES_COLORS.slate : undefined,
              values,
            },
          ];
          const thresholds =
            key === "us_aqi"
              ? [
                  { value: 100, label: "100 · USG", color: SERIES_COLORS.amber },
                  { value: 150, label: "150", color: SERIES_COLORS.red },
                ]
              : p.who24h
                ? [{ value: p.who24h, label: `WHO 24 h ${p.who24h}`, color: SERIES_COLORS.red }]
                : [];
          return (
            <figure className="chart-cell" key={key}>
              <figcaption className="chart-cell-head">
                <span className="chart-title">
                  {p.label} {p.unit && <span className="muted">{p.unit}</span>}
                </span>
                <span className="chart-stats mono">{p.reducer === "max" ? "daily max" : "daily mean"}</span>
              </figcaption>
              <XYChart
                x={view.x}
                series={series}
                xType="category"
                height={130}
                unit={p.unit}
                thresholds={thresholds}
                legend={false}
                formatX={(v) => dayLabel(v)}
                formatY={(v, tip) => fmtNum(v, tip ? p.digits : 0)}
                ariaLabel={`${p.label} ${p.reducer === "max" ? "daily maximum" : "daily mean"}, last ${days} days`}
              />
            </figure>
          );
        })}
      </div>
      <SourceLine href="https://open-meteo.com/en/docs/air-quality-api" label="Open-Meteo air quality">
        Model estimates from Copernicus CAMS, not monitor readings. Days with fewer than 18 hourly values are
        omitted. WHO lines are the 2021 Air Quality Guideline 24-hour levels, shown for reference — a daily
        mean of model hours is comparable but not identical to a measured 24-hour average. US AQI bars are
        coloured by EPA category (green good, amber moderate, orange sensitive groups, red unhealthy). Trend =
        Sen's slope per week; "ns" = not significant at α = 0.05.
      </SourceLine>
    </>
  );
}

// ------------------------------------------------------------------ weather

function DailyWeather({ location }) {
  const remote = useRemote(`wx-daily-${pointKey(location)}`, (s) => loadDailyWeather(location.latitude, location.longitude, s), {
    maxAgeMs: HOUR,
  });
  const d = remote.data?.daily;

  const model = useMemo(() => {
    if (!d?.time) return null;
    const today = remote.data.today;
    const todayIndex = d.time.findIndex((t) => t >= today);
    const past = (arr, n) => arr.slice(Math.max(0, todayIndex - n), todayIndex).filter(isNum);
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    return {
      today: todayIndex >= 0 ? d.time[todayIndex] : null,
      precip30: sum(past(d.precipitation_sum, 30)),
      precip92: sum(past(d.precipitation_sum, 92)),
      wetDays30: past(d.precipitation_sum, 30).filter((v) => v >= 1).length,
      hottest: Math.max(...past(d.temperature_2m_max, 92)),
      coldest: Math.min(...past(d.temperature_2m_min, 92)),
      forecastPrecip: sum(d.precipitation_sum.slice(todayIndex).filter(isNum)),
    };
  }, [d, remote.data]);

  if (!d?.time || !model) {
    return remote.status === "error" ? (
      <p className="row-note tone-bad">Daily weather could not be loaded: {remote.error}</p>
    ) : (
      <p className="chart-empty">Loading daily series…</p>
    );
  }

  const tempSeries = [
    { id: "max", label: "Daily max", type: "line", color: SERIES_COLORS.amber, values: d.temperature_2m_max },
    { id: "mean", label: "Daily mean", type: "line", color: SERIES_COLORS.slate, dash: true, values: d.temperature_2m_mean },
    { id: "min", label: "Daily min", type: "line", color: SERIES_COLORS.blue, values: d.temperature_2m_min },
  ];
  const rainSeries = [{ id: "p", label: "Precipitation", type: "bar", color: SERIES_COLORS.blueDeep, values: d.precipitation_sum }];
  const windSeries = [{ id: "w", label: "Max wind", type: "line", color: SERIES_COLORS.green, values: d.wind_speed_10m_max }];
  const uvSeries = [{ id: "uv", label: "UV index max", type: "bar", color: SERIES_COLORS.violet, values: d.uv_index_max }];

  const common = {
    x: d.time,
    xType: "category",
    shadeFrom: model.today,
    shadeLabel: "forecast",
    formatX: (v) => dayLabel(v),
  };

  return (
    <>
      <div className="tab-toolbar">
        <span className="panel-meta">
          Open-Meteo · modeled · past 92 days + 16-day forecast · local dates ({remote.data.tz}) · shaded = forecast
        </span>
      </div>
      <div className="stat-row">
        <div>
          <span className="kpi-label">Precipitation · last 30 d</span>
          <strong className="num stat-big">
            {fmtNum(model.precip30, 1)}
            <span className="kpi-unit">mm · {model.wetDays30} {model.wetDays30 === 1 ? "day" : "days"} ≥ 1 mm</span>
          </strong>
        </div>
        <div>
          <span className="kpi-label">Precipitation · last 92 d</span>
          <strong className="num stat-big">
            {fmtNum(model.precip92, 0)}
            <span className="kpi-unit">mm</span>
          </strong>
        </div>
        <div>
          <span className="kpi-label">Range · last 92 d</span>
          <strong className="num stat-big">
            {fmtNum(model.coldest, 1)} → {fmtNum(model.hottest, 1)}
            <span className="kpi-unit">°C</span>
          </strong>
        </div>
        <div>
          <span className="kpi-label">Forecast precipitation · 16 d</span>
          <strong className="num stat-big">
            {fmtNum(model.forecastPrecip, 1)}
            <span className="kpi-unit">mm</span>
          </strong>
        </div>
      </div>
      <div className="chart-grid chart-grid-2">
        <figure className="chart-cell span-2">
          <figcaption className="chart-cell-head">
            <span className="chart-title">Air temperature · 2 m · °C</span>
          </figcaption>
          <XYChart {...common} series={tempSeries} height={170} unit="°C" formatY={(v, tip) => fmtNum(v, tip ? 1 : 0)} ariaLabel="Daily maximum, mean and minimum temperature" />
        </figure>
        <figure className="chart-cell">
          <figcaption className="chart-cell-head">
            <span className="chart-title">Precipitation · daily total · mm</span>
          </figcaption>
          <XYChart {...common} series={rainSeries} height={120} unit="mm" legend={false} formatY={(v, tip) => fmtNum(v, tip ? 1 : 0)} ariaLabel="Daily precipitation total" />
        </figure>
        <figure className="chart-cell">
          <figcaption className="chart-cell-head">
            <span className="chart-title">Max wind · 10 m · km/h</span>
          </figcaption>
          <XYChart {...common} series={windSeries} height={120} unit="km/h" legend={false} zeroBased formatY={(v, tip) => fmtNum(v, tip ? 1 : 0)} ariaLabel="Daily maximum wind speed" />
        </figure>
        <figure className="chart-cell span-2">
          <figcaption className="chart-cell-head">
            <span className="chart-title">UV index · daily max</span>
          </figcaption>
          <XYChart
            {...common}
            series={uvSeries}
            height={100}
            legend={false}
            thresholds={[{ value: 8, label: "8 · very high", color: SERIES_COLORS.red }]}
            formatY={(v, tip) => fmtNum(v, tip ? 1 : 0)}
            ariaLabel="Daily maximum UV index"
          />
        </figure>
      </div>
      <SourceLine href="https://open-meteo.com/en/docs" label="Open-Meteo forecast API">
        Past days are model analysis/short-range forecasts stitched by Open-Meteo, not station records.
      </SourceLine>
    </>
  );
}

// ------------------------------------------------------------------ climate

function ClimateRecord({ location }) {
  const [requested, setRequested] = useState(false);
  const remote = useRemote(`era5-${pointKey(location)}`, (s) => loadClimateRecord(location.latitude, location.longitude, s), {
    enabled: requested,
  });

  const model = useMemo(() => {
    const annual = remote.data?.annual;
    if (!annual) return null;
    const base = annual.filter((a) => a.year >= 1961 && a.year <= 1990 && isNum(a.temp));
    const baseMean = base.length ? base.reduce((s, a) => s + a.temp, 0) / base.length : null;
    const tempTrend = analyzeTimeSeries(annual.filter((a) => isNum(a.temp)).map((a) => ({ year: a.year, value: a.temp })), { alpha: 0.05, minimumObservations: 8 });
    const precipTrend = analyzeTimeSeries(annual.filter((a) => isNum(a.precip)).map((a) => ({ year: a.year, value: a.precip })), { alpha: 0.05, minimumObservations: 8 });
    const recent = annual.filter((a) => a.year > annual.at(-1).year - 10 && isNum(a.temp));
    const recentMean = recent.reduce((s, a) => s + a.temp, 0) / recent.length;
    return { annual, baseMean, tempTrend, precipTrend, recentMean };
  }, [remote.data]);

  if (!requested && remote.status !== "loaded") {
    return (
      <div className="climate-cta">
        <EmptyState icon={Database} title="Load the 1950–present climate record for this point">
          Retrieves daily ERA5 reanalysis (≈ 650 KB, a few seconds) from the Open-Meteo archive and computes
          annual mean temperature and annual precipitation, with Mann–Kendall / Sen's slope trend statistics.
        </EmptyState>
        <button type="button" className="btn" onClick={() => setRequested(true)}>
          <Database size={13} aria-hidden="true" /> Load ERA5 record
        </button>
      </div>
    );
  }

  if (!model) {
    return remote.status === "error" ? (
      <div className="climate-cta">
        <p className="row-note tone-bad">The ERA5 archive could not be loaded: {remote.error}</p>
        <button type="button" className="btn" onClick={remote.reload}>
          Retry
        </button>
      </div>
    ) : (
      <p className="chart-empty">Loading 75 years of daily ERA5 data…</p>
    );
  }

  const years = model.annual.map((a) => a.year);
  const anomaly = [
    {
      id: "anom",
      label: "Annual mean vs 1961–1990",
      type: "bar",
      color: SERIES_COLORS.red,
      colorAt: (v) => (v >= 0 ? SERIES_COLORS.red : SERIES_COLORS.blue),
      values: model.annual.map((a) => (isNum(a.temp) && isNum(model.baseMean) ? a.temp - model.baseMean : null)),
    },
  ];
  const precip = [{ id: "p", label: "Annual precipitation", type: "bar", color: SERIES_COLORS.blueDeep, values: model.annual.map((a) => a.precip) }];
  const t = model.tempTrend;
  const p = model.precipTrend;

  return (
    <>
      <div className="tab-toolbar">
        <span className="panel-meta">
          ERA5 reanalysis via Open-Meteo archive · ~25 km grid cell at{" "}
          <span className="mono">
            {fmtNum(remote.data.gridLatitude, 2)}, {fmtNum(remote.data.gridLongitude, 2)}
          </span>{" "}
          · complete years {years[0]}–{years.at(-1)}
        </span>
      </div>
      <div className="stat-row">
        <div>
          <span className="kpi-label">1961–1990 mean temperature</span>
          <strong className="num stat-big">
            {fmtNum(model.baseMean, 1)}
            <span className="kpi-unit">°C</span>
          </strong>
        </div>
        <div>
          <span className="kpi-label">Last 10 years mean</span>
          <strong className="num stat-big">
            {fmtNum(model.recentMean, 1)}
            <span className="kpi-unit">
              °C (<SignedNumber value={model.recentMean - model.baseMean} digits={1} />)
            </span>
          </strong>
        </div>
        <div>
          <span className="kpi-label">Temperature trend (Sen's slope)</span>
          <strong className="num stat-big">
            <SignedNumber value={t.senSlopePerDecade} digits={2} />
            <span className="kpi-unit">°C/decade</span>
          </strong>
          <span className="kpi-sub">{t.isSignificant ? "Significant" : "Not significant"} at α = 0.05</span>
        </div>
        <div>
          <span className="kpi-label">Precipitation trend</span>
          <strong className="num stat-big">
            <SignedNumber value={p.senSlopePerDecade} digits={1} />
            <span className="kpi-unit">mm/decade</span>
          </strong>
          <span className="kpi-sub">{p.isSignificant ? "Significant" : "Not significant"} at α = 0.05</span>
        </div>
      </div>
      <div className="chart-grid chart-grid-2">
        <figure className="chart-cell">
          <figcaption className="chart-cell-head">
            <span className="chart-title">Annual mean temperature anomaly · °C vs 1961–1990</span>
          </figcaption>
          <XYChart x={years} series={anomaly} height={170} unit="°C" legend={false} formatY={(v, tip) => (tip ? `${v > 0 ? "+" : ""}${v.toFixed(2)}` : v.toFixed(1))} ariaLabel="Annual mean temperature anomaly at the selected point" />
        </figure>
        <figure className="chart-cell">
          <figcaption className="chart-cell-head">
            <span className="chart-title">Annual precipitation · mm</span>
          </figcaption>
          <XYChart x={years} series={precip} height={170} unit="mm" legend={false} formatY={(v) => fmtNum(v, 0)} ariaLabel="Annual precipitation total at the selected point" />
        </figure>
      </div>
      <SourceLine href="https://open-meteo.com/en/docs/historical-weather-api" label="Open-Meteo historical API">
        ERA5 is a reanalysis (a model constrained by observations), representing a grid cell rather than a
        point station. Anomalies, annual aggregates and trend statistics are computed here; years with fewer
        than 360 valid days are omitted. Serial autocorrelation is not adjusted for.
      </SourceLine>
    </>
  );
}

// ------------------------------------------------------------------ panel

export default function LocationAnalytics({ location, state }) {
  const [tab, setTab] = useState("hourly");
  const hasPoint = isNum(location?.latitude) && isNum(location?.longitude);

  return (
    <Panel
      id="trends"
      className="analytics-panel"
      title="Location analytics"
      meta={hasPoint ? `${location.name || "Unnamed area"} · ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}` : "Select a point on the globe"}
    >
      <div className="panel-tabs" role="tablist" aria-label="Location analytics views">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            className={tab === id ? "is-active" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={13} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-body">
        {!hasPoint ? (
          <EmptyState icon={LineChart} title="No point selected">
            Click a point on the globe to load hourly series, 92 days of modeled air pollution with WHO
            guideline comparisons, daily weather with a 16-day forecast, and the 1950–present ERA5 climate
            record for that location.
          </EmptyState>
        ) : tab === "hourly" ? (
          <HourlyCharts location={location} state={state} />
        ) : tab === "air" ? (
          <AirHistory key={pointKey(location)} location={location} />
        ) : tab === "weather" ? (
          <DailyWeather key={pointKey(location)} location={location} />
        ) : (
          <ClimateRecord key={pointKey(location)} location={location} />
        )}
      </div>
    </Panel>
  );
}
