import { useEffect, useMemo, useRef, useState } from "react";
import { fmtLocalWallClock, fmtNum, isNum } from "../lib/format";

const HEIGHT = 128;
const M = { top: 8, right: 8, bottom: 18, left: 36 };

function niceStep(range, targetTicks) {
  const raw = range / Math.max(targetTicks, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const normalized = raw / magnitude;
  const step = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return step * magnitude;
}

export default function TimeSeriesChart({
  times,
  values,
  type = "line",
  color = "var(--blue-bright)",
  unit = "",
  digits = 1,
  nowTime = null,
  thresholds = [],
  zeroBased = false,
  label,
  tzAbbr = "",
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const n = times.length;
  const valid = useMemo(() => values.filter(isNum), [values]);

  const model = useMemo(() => {
    if (!width || n < 2 || valid.length < 2) return null;

    const plotW = width - M.left - M.right;
    const plotH = HEIGHT - M.top - M.bottom;

    // Thresholds only widen the axis when the data comes reasonably
    // close to them; otherwise they would flatten the series.
    const dataMax = Math.max(...valid);
    const nearThresholds = thresholds
      .filter((t) => t.value <= dataMax * 1.6)
      .map((t) => t.value);
    let lo = Math.min(...valid);
    let hi = Math.max(dataMax, ...nearThresholds);
    if (zeroBased || type === "bar") lo = Math.min(0, lo);
    if (hi === lo) hi = lo + 1;
    const step = niceStep(hi - lo, 3);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    if (type === "bar" && hi === 0) hi = step;

    const x = (i) =>
      type === "bar"
        ? M.left + ((i + 0.5) / n) * plotW
        : M.left + (i / (n - 1)) * plotW;
    const y = (v) => M.top + plotH - ((v - lo) / (hi - lo)) * plotH;

    const yTicks = [];
    for (let v = lo; v <= hi + step / 2; v += step) yTicks.push(Number(v.toFixed(6)));

    let path = "";
    let pen = false;
    values.forEach((v, i) => {
      if (!isNum(v)) {
        pen = false;
        return;
      }
      path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });

    let nowIndex = -1;
    if (nowTime) {
      for (let i = 0; i < n; i += 1) if (times[i] <= nowTime) nowIndex = i;
    }

    const xTicks = [];
    const minSpacing = 46;
    let lastX = -Infinity;
    times.forEach((t, i) => {
      const hour = t.slice(11, 13);
      const isMidnight = hour === "00";
      const isNoon = hour === "12";
      if (!isMidnight && !(isNoon && plotW > 420)) return;
      const px = x(i);
      if (px - lastX < minSpacing) return;
      lastX = px;
      xTicks.push({ px, text: isMidnight ? fmtLocalWallClock(t).split(" ").slice(0, 2).join(" ") : "12:00", major: isMidnight });
    });

    return { plotW, plotH, x, y, lo, hi, yTicks, xTicks, path, nowIndex, barW: Math.max(1, plotW / n - 1) };
  }, [width, n, valid, values, times, thresholds, zeroBased, type, nowTime]);

  if (valid.length < 2) {
    return <p className="chart-empty">No series returned by the source for this range.</p>;
  }

  const minV = Math.min(...valid);
  const maxV = Math.max(...valid);

  function indexFromClientX(clientX) {
    if (!model || !wrapRef.current) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left - M.left;
    const ratio = Math.max(0, Math.min(1, px / model.plotW));
    return type === "bar" ? Math.min(n - 1, Math.floor(ratio * n)) : Math.round(ratio * (n - 1));
  }

  function onKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setHover((current) => {
      const start = current ?? (model?.nowIndex >= 0 ? model.nowIndex : 0);
      return Math.max(0, Math.min(n - 1, start + (event.key === "ArrowRight" ? 1 : -1)));
    });
  }

  const hv = hover != null ? values[hover] : null;
  const isForecast = hover != null && model?.nowIndex >= 0 && hover > model.nowIndex;

  return (
    <div
      className="ts-chart"
      ref={wrapRef}
      tabIndex={0}
      role="img"
      aria-label={`${label}. Range ${fmtNum(minV, digits)} to ${fmtNum(maxV, digits)} ${unit} from ${fmtLocalWallClock(times[0])} to ${fmtLocalWallClock(times[n - 1])} ${tzAbbr}. Use left and right arrow keys to read hourly values.`}
      onKeyDown={onKeyDown}
      onBlur={() => setHover(null)}
      onPointerMove={(event) => setHover(indexFromClientX(event.clientX))}
      onPointerLeave={() => setHover(null)}
    >
      {model && (
        <svg width={width} height={HEIGHT} aria-hidden="true">
          {model.nowIndex >= 0 && model.nowIndex < n - 1 && (
            <rect
              className="ts-forecast-zone"
              x={model.x(model.nowIndex)}
              y={M.top}
              width={M.left + model.plotW - model.x(model.nowIndex)}
              height={model.plotH}
            />
          )}

          {model.yTicks.map((v) => (
            <g key={v}>
              <line className="ts-grid" x1={M.left} x2={M.left + model.plotW} y1={model.y(v)} y2={model.y(v)} />
              <text className="ts-axis" x={M.left - 5} y={model.y(v) + 3} textAnchor="end">
                {Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmtNum(v, Number.isInteger(v) ? 0 : 1)}
              </text>
            </g>
          ))}

          {model.xTicks.map((tick) => (
            <g key={tick.px}>
              <line className={tick.major ? "ts-day" : "ts-grid"} x1={tick.px} x2={tick.px} y1={M.top} y2={M.top + model.plotH} />
              <text className="ts-axis" x={tick.px} y={HEIGHT - 5} textAnchor="middle">
                {tick.text}
              </text>
            </g>
          ))}

          {thresholds.map((t) =>
            t.value >= model.lo && t.value <= model.hi ? (
              <g key={t.value}>
                <line className="ts-threshold" x1={M.left} x2={M.left + model.plotW} y1={model.y(t.value)} y2={model.y(t.value)} stroke={t.color} />
                <text className="ts-threshold-label" x={M.left + model.plotW - 2} y={model.y(t.value) - 3} textAnchor="end" fill={t.color}>
                  {t.label}
                </text>
              </g>
            ) : null
          )}

          {type === "bar"
            ? values.map((v, i) =>
                isNum(v) && v > 0 ? (
                  <rect
                    key={times[i]}
                    x={model.x(i) - model.barW / 2}
                    y={model.y(v)}
                    width={model.barW}
                    height={model.y(model.lo) - model.y(v)}
                    fill={color}
                    opacity={model.nowIndex >= 0 && i > model.nowIndex ? 0.6 : 1}
                  />
                ) : null
              )
            : <path d={model.path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />}

          {model.nowIndex >= 0 && (
            <g>
              <line className="ts-now" x1={model.x(model.nowIndex)} x2={model.x(model.nowIndex)} y1={M.top} y2={M.top + model.plotH} />
              <text className="ts-now-label" x={model.x(model.nowIndex) + 3} y={M.top + 9}>
                now
              </text>
            </g>
          )}

          {hover != null && (
            <g>
              <line className="ts-cursor" x1={model.x(hover)} x2={model.x(hover)} y1={M.top} y2={M.top + model.plotH} />
              {isNum(hv) && <circle cx={model.x(hover)} cy={model.y(hv)} r="3" fill={color} stroke="var(--bg-panel)" strokeWidth="1.5" />}
            </g>
          )}
        </svg>
      )}

      {hover != null && model && (
        <div
          className="ts-tooltip"
          style={{
            left: Math.min(Math.max(model.x(hover) - 70, 0), width - 140),
          }}
        >
          <span className="mono">
            {fmtLocalWallClock(times[hover])} {tzAbbr}
          </span>
          <strong className="num">
            {fmtNum(hv, digits)} {isNum(hv) ? unit : ""}
          </strong>
          <span className="ts-kind">{isForecast ? "Forecast" : "Model analysis"}</span>
        </div>
      )}
    </div>
  );
}
