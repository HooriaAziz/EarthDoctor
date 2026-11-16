import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { EmptyState } from "./ui";
import TimeSeriesChart from "./TimeSeriesChart";
import { fmtNum, isNum } from "../lib/format";

const RANGES = [
  { id: "all", label: "−24 h / +48 h" },
  { id: "next24", label: "Next 24 h" },
  { id: "past24", label: "Past 24 h" },
];

function sliceRange(times, values, nowTime, range) {
  if (!Array.isArray(times) || !Array.isArray(values)) return { times: [], values: [] };
  if (range === "all" || !nowTime) return { times, values };

  let nowIndex = 0;
  times.forEach((t, i) => {
    if (t <= nowTime) nowIndex = i;
  });

  const [start, end] =
    range === "next24" ? [nowIndex, nowIndex + 25] : [Math.max(0, nowIndex - 24), nowIndex + 1];
  return { times: times.slice(start, end), values: values.slice(start, end) };
}

function ChartCell({ title, series, unit, digits, nowValue, children }) {
  const valid = series.values.filter(isNum);
  return (
    <figure className="chart-cell">
      <figcaption className="chart-cell-head">
        <span className="chart-title">{title}</span>
        <span className="chart-stats mono">
          now <strong className="num">{fmtNum(nowValue, digits)}</strong> {isNum(nowValue) ? unit : ""}
          {valid.length > 1 && (
            <span className="chart-range">
              {" "}· {fmtNum(Math.min(...valid), digits)}–{fmtNum(Math.max(...valid), digits)}
            </span>
          )}
        </span>
      </figcaption>
      {children}
    </figure>
  );
}

export default function HourlyCharts({ location, state }) {
  const [range, setRange] = useState("all");

  const weather = state.data?.weather;
  const air = state.data?.airQuality;
  const tz = weather?.timezone_abbreviation || air?.timezone_abbreviation || "";
  const tzName = weather?.timezone || air?.timezone || "";
  const wxNow = weather?.current?.time ?? null;
  const aqNow = air?.current?.time ?? null;

  const series = useMemo(() => {
    const wh = weather?.hourly;
    const ah = air?.hourly;
    return {
      temp: sliceRange(wh?.time, wh?.temperature_2m, wxNow, range),
      humidity: sliceRange(wh?.time, wh?.relative_humidity_2m, wxNow, range),
      precip: sliceRange(wh?.time, wh?.precipitation, wxNow, range),
      aqi: sliceRange(ah?.time, ah?.us_aqi, aqNow, range),
    };
  }, [weather, air, wxNow, aqNow, range]);

  const hasAny = weather?.hourly || air?.hourly;
  const hasPoint = isNum(location?.latitude) && isNum(location?.longitude);

  return (
    <>
      <div className="tab-toolbar">
        <span className="panel-meta">
          {hasAny
            ? `Open-Meteo · CAMS · local time ${tz}${tzName ? ` (${tzName})` : ""} · shaded = forecast`
            : "Model series for the selected point"}
        </span>
        {hasAny && (
          <div className="segmented" role="radiogroup" aria-label="Time range">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={range === item.id}
                className={range === item.id ? "is-active" : undefined}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {!hasPoint ? (
        <EmptyState icon={LineChart} title="No series loaded">
          Select a point on the globe to load the hourly model series (past 24 h analysis and 48 h
          forecast) for temperature, humidity, precipitation and air quality.
        </EmptyState>
      ) : !hasAny ? (
        <EmptyState icon={LineChart} title={state.status === "loading" ? "Loading series…" : "Series unavailable"}>
          {state.status === "loading"
            ? "Requesting hourly data from Open-Meteo."
            : "The sources did not return hourly data for this point."}
        </EmptyState>
      ) : (
        <div className="chart-grid">
          <ChartCell title="Air temperature · 2 m" series={series.temp} unit="°C" digits={1} nowValue={weather?.current?.temperature_2m}>
            <TimeSeriesChart label="Air temperature, degrees Celsius" times={series.temp.times} values={series.temp.values} unit="°C" digits={1} color="#398CF0" nowTime={wxNow} tzAbbr={tz} />
          </ChartCell>
          <ChartCell title="Relative humidity · 2 m" series={series.humidity} unit="%" digits={0} nowValue={weather?.current?.relative_humidity_2m}>
            <TimeSeriesChart label="Relative humidity, percent" times={series.humidity.times} values={series.humidity.values} unit="%" digits={0} color="#13B981" nowTime={wxNow} tzAbbr={tz} zeroBased />
          </ChartCell>
          <ChartCell title="Precipitation · hourly total" series={series.precip} unit="mm" digits={1} nowValue={weather?.current?.precipitation}>
            <TimeSeriesChart label="Hourly precipitation, millimetres" type="bar" times={series.precip.times} values={series.precip.values} unit="mm" digits={1} color="#2563D9" nowTime={wxNow} tzAbbr={tz} />
          </ChartCell>
          <ChartCell title="US AQI · CAMS model" series={series.aqi} unit="" digits={0} nowValue={air?.current?.us_aqi}>
            <TimeSeriesChart
              label="US Air Quality Index"
              times={series.aqi.times}
              values={series.aqi.values}
              digits={0}
              color="#E8B341"
              nowTime={aqNow}
              tzAbbr={tz}
              zeroBased
              thresholds={[
                { value: 100, label: "100 · USG", color: "#E8B341" },
                { value: 150, label: "150 · Unhealthy", color: "#E54858" },
              ]}
            />
          </ChartCell>
        </div>
      )}
    </>
  );
}
