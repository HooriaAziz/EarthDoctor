import { useEffect, useMemo, useRef, useState } from "react";
import { compactNumber, isNum } from "../lib/format";

// General-purpose SVG chart: numeric or category x, one or more series
// drawn as line / area / bar, optional stacking, thresholds and a shaded
// region. Hover and arrow keys read exact values; nothing is smoothed.

const M = { top: 10, right: 10, bottom: 20, left: 44 };

function model_bandHalf(plotW, n) {
  return plotW / n / 2;
}

function niceStep(range, target) {
  const raw = range / Math.max(target, 1);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

export default function XYChart({
  x,
  series,
  height = 180,
  xType = "year", // year | time | category
  stacked = false,
  zeroBased = false,
  thresholds = [],
  shadeFrom = null, // x value from which the plot is shaded (e.g. forecast)
  shadeLabel = "",
  formatX = (v) => String(v),
  formatTick = null,
  formatY = (v) => compactNumber(v),
  unit = "",
  legend = true,
  ariaLabel,
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const n = x.length;
  const isBar = series.some((s) => s.type === "bar");
  const band = isBar || xType === "category";

  const model = useMemo(() => {
    if (!width || n === 0) return null;
    const plotW = Math.max(10, width - M.left - M.right);
    const plotH = height - M.top - M.bottom;

    // Stack bases.
    const stacks = series.map(() => new Array(n).fill(0));
    if (stacked) {
      // Positive values stack upward from zero, negative values downward.
      const pos = new Array(n).fill(0);
      const neg = new Array(n).fill(0);
      series.forEach((s, k) => {
        for (let i = 0; i < n; i += 1) {
          const v = s.values[i];
          if (!isNum(v)) continue;
          if (v >= 0) {
            stacks[k][i] = pos[i];
            pos[i] += v;
          } else {
            stacks[k][i] = neg[i];
            neg[i] += v;
          }
        }
      });
    }

    let lo = Infinity;
    let hi = -Infinity;
    series.forEach((s, k) => {
      for (let i = 0; i < n; i += 1) {
        const v = s.values[i];
        if (!isNum(v)) continue;
        const top = stacked ? stacks[k][i] + v : v;
        lo = Math.min(lo, stacked ? stacks[k][i] : v, top);
        hi = Math.max(hi, top);
      }
    });
    if (!Number.isFinite(lo)) return null;
    thresholds.forEach((t) => {
      if (t.value <= hi * 1.5 && t.value >= lo - Math.abs(hi - lo) * 0.5) {
        lo = Math.min(lo, t.value);
        hi = Math.max(hi, t.value);
      }
    });
    if (zeroBased || stacked || isBar) lo = Math.min(0, lo);
    if (hi === lo) hi = lo + 1;
    const step = niceStep(hi - lo, Math.max(2, Math.round(plotH / 40)));
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;

    const xMin = band ? 0 : x[0];
    const xMax = band ? n : x[n - 1];
    const xs = (i) =>
      band
        ? M.left + ((i + 0.5) / n) * plotW
        : M.left + ((x[i] - xMin) / Math.max(xMax - xMin, 1e-9)) * plotW;
    const xv = (value) => M.left + ((value - xMin) / Math.max(xMax - xMin, 1e-9)) * plotW;
    const y = (v) => M.top + plotH - ((v - lo) / (hi - lo)) * plotH;

    const yTicks = [];
    for (let v = lo; v <= hi + step / 2; v += step) yTicks.push(Number(v.toPrecision(12)));

    // X ticks.
    const xTicks = [];
    const maxTicks = Math.max(2, Math.floor(plotW / 64));
    if (xType === "year") {
      // Round-year ticks; for bar (band) layouts, centre on that year's bar.
      const first = x[0];
      const last = x[n - 1];
      const yStep = Math.max(1, niceStep(last - first, maxTicks));
      for (let v = Math.ceil(first / yStep) * yStep; v <= last; v += yStep) {
        if (band) {
          const idx = x.indexOf(v);
          if (idx >= 0) xTicks.push({ px: xs(idx), text: String(v) });
        } else {
          xTicks.push({ px: xv(v), text: String(Math.round(v)) });
        }
      }
    } else {
      // Evenly spaced ticks; when several points share a label (e.g. many
      // readings per day), tick only where the label changes.
      const fmt = formatTick || formatX;
      const labels = x.map((v, i) => fmt(v, i));
      const changes = labels.map((t, i) => i).filter((i) => i === 0 || labels[i] !== labels[i - 1]);
      const candidates = changes.length < n ? changes : labels.map((t, i) => i);
      const every = Math.max(1, Math.ceil(candidates.length / maxTicks));
      for (let k = 0; k < candidates.length; k += every) {
        const i = candidates[k];
        xTicks.push({ px: band ? xs(i) - (changes.length < n ? model_bandHalf(plotW, n) : 0) : xs(i), text: labels[i] });
      }
    }

    const shapes = series.map((s, k) => {
      if (s.type === "bar") return null;
      let line = "";
      let pen = false;
      const top = [];
      for (let i = 0; i < n; i += 1) {
        const v = s.values[i];
        if (!isNum(v)) {
          pen = false;
          continue;
        }
        const yy = y(stacked ? stacks[k][i] + v : v);
        line += `${pen ? "L" : "M"}${xs(i).toFixed(1)},${yy.toFixed(1)}`;
        pen = true;
        top.push([xs(i), yy, i]);
      }
      let area = "";
      if (s.type === "area" && top.length > 1) {
        const base = top.map(([px, , i]) => [px, y(stacked ? stacks[k][i] : Math.max(lo, Math.min(0, hi)))]).reverse();
        area = `M${top.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join("L")}L${base
          .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
          .join("L")}Z`;
      }
      return { line, area };
    });

    const barSeries = series.filter((s) => s.type === "bar");
    const bandW = plotW / n;
    const barW = Math.max(1, bandW * (n > 60 ? 0.9 : 0.72));

    // Axis labels: use the caller's formatter unless it collapses distinct
    // ticks into identical text (e.g. tiny values rounded to 0).
    let yLabels = yTicks.map((v) => formatY(v, false));
    if (new Set(yLabels).size < yLabels.length) {
      const decimals = Math.min(6, Math.max(0, -Math.floor(Math.log10(step))));
      yLabels = yTicks.map((v) => v.toFixed(decimals));
    }

    // Threshold labels: skip one that would overlap the previous label.
    let lastLabelY = -Infinity;
    const thresholdLabels = [...thresholds]
      .filter((t) => t.value >= lo && t.value <= hi)
      .sort((a, b) => b.value - a.value)
      .map((t) => {
        const ty = y(t.value);
        const show = ty - lastLabelY >= 11;
        if (show) lastLabelY = ty;
        return { ...t, showLabel: show };
      });

    return { plotW, plotH, xs, xv, y, lo, hi, yTicks, yLabels, xTicks, shapes, stacks, barSeries, barW, xMin, xMax, thresholdLabels };
  }, [width, n, series, x, height, stacked, zeroBased, thresholds, band, xType, formatTick, formatX, formatY, isBar]);

  function indexFromClientX(clientX) {
    if (!model || !wrapRef.current) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    if (band) {
      return Math.max(0, Math.min(n - 1, Math.floor(((px - M.left) / model.plotW) * n)));
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(model.xs(i) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  const valid = series.some((s) => s.values.some(isNum));
  if (!valid) return <p className="chart-empty">No values returned by the source for this range.</p>;

  const tooltipRows =
    hover != null
      ? series.map((s) => ({ ...s, v: s.values[hover] })).filter((s) => isNum(s.v) || series.length === 1)
      : [];
  const total = stacked && hover != null ? tooltipRows.reduce((sum, s) => sum + (isNum(s.v) ? s.v : 0), 0) : null;

  return (
    <div className="xy">
      {legend && series.length > 1 && (
        <ul className="xy-legend" aria-hidden="true">
          {series.map((s) => (
            <li key={s.id}>
              <span
                className={`xy-swatch ${s.type === "line" ? "is-line" : ""} ${s.dash ? "is-dash" : ""}`}
                style={{ "--c": s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={wrapRef}
        className="xy-plot"
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}
        onPointerMove={(e) => setHover(indexFromClientX(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + (e.key === "ArrowRight" ? 1 : -1))));
        }}
      >
        {model && (
          <svg width={width} height={height} aria-hidden="true">
            {shadeFrom != null && (band ? x.some((v) => v >= shadeFrom) : shadeFrom <= model.xMax) && (
              <g>
                <rect
                  className="ts-forecast-zone"
                  x={band ? model.xs(x.findIndex((v) => v >= shadeFrom)) - model.plotW / n / 2 : model.xv(shadeFrom)}
                  y={M.top}
                  width={Math.max(0, M.left + model.plotW - (band ? model.xs(x.findIndex((v) => v >= shadeFrom)) - model.plotW / n / 2 : model.xv(shadeFrom)))}
                  height={model.plotH}
                />
                {shadeLabel && (
                  <text className="ts-now-label" x={(band ? model.xs(x.findIndex((v) => v >= shadeFrom)) - model.plotW / n / 2 : model.xv(shadeFrom)) + 3} y={M.top + 9}>
                    {shadeLabel}
                  </text>
                )}
              </g>
            )}

            {model.yTicks.map((v, i) => (
              <g key={v}>
                <line className={v === 0 ? "ts-day" : "ts-grid"} x1={M.left} x2={M.left + model.plotW} y1={model.y(v)} y2={model.y(v)} />
                <text className="ts-axis" x={M.left - 5} y={model.y(v) + 3} textAnchor="end">
                  {model.yLabels[i]}
                </text>
              </g>
            ))}
            {model.xTicks.map((t) => (
              <text key={`${t.px}-${t.text}`} className="ts-axis" x={t.px} y={height - 5} textAnchor="middle">
                {t.text}
              </text>
            ))}

            {model.thresholdLabels.map((t) => (
              <g key={t.value}>
                <line className="ts-threshold" x1={M.left} x2={M.left + model.plotW} y1={model.y(t.value)} y2={model.y(t.value)} stroke={t.color} />
                {t.showLabel && (
                  <text className="ts-threshold-label" x={M.left + model.plotW - 2} y={model.y(t.value) - 3} textAnchor="end" fill={t.color}>
                    {t.label}
                  </text>
                )}
              </g>
            ))}

            {series.map((s, k) =>
              s.type === "bar"
                ? s.values.map((v, i) => {
                    if (!isNum(v) || v === 0) return null;
                    const base = stacked ? model.stacks[k][i] : 0;
                    const y1 = model.y(base + v);
                    const y0 = model.y(base);
                    return (
                      <rect
                        key={`${s.id}-${i}`}
                        x={model.xs(i) - model.barW / 2}
                        y={Math.min(y0, y1)}
                        width={model.barW}
                        height={Math.max(0.5, Math.abs(y0 - y1))}
                        fill={s.colorAt ? s.colorAt(v, i) : s.color}
                        opacity={hover === i ? 1 : 0.9}
                      />
                    );
                  })
                : (
                    <g key={s.id}>
                      {model.shapes[k].area && <path d={model.shapes[k].area} fill={s.color} opacity={stacked ? 0.75 : 0.14} />}
                      <path
                        d={model.shapes[k].line}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={s.width ?? (stacked ? 1 : 1.6)}
                        strokeDasharray={s.dash ? "4 3" : undefined}
                        strokeLinejoin="round"
                      />
                    </g>
                  )
            )}

            {hover != null && (
              <g>
                <line className="ts-cursor" x1={model.xs(hover)} x2={model.xs(hover)} y1={M.top} y2={M.top + model.plotH} />
                {!isBar &&
                  series.map((s, k) =>
                    isNum(s.values[hover]) ? (
                      <circle
                        key={s.id}
                        cx={model.xs(hover)}
                        cy={model.y(stacked ? model.stacks[k][hover] + s.values[hover] : s.values[hover])}
                        r="2.8"
                        fill={s.color}
                        stroke="var(--bg-panel)"
                        strokeWidth="1.2"
                      />
                    ) : null
                  )}
              </g>
            )}
          </svg>
        )}

        {hover != null && model && (
          <div
            className="ts-tooltip xy-tooltip"
            style={{ left: Math.min(Math.max(model.xs(hover) + 10, 0), width - 180) }}
          >
            <span className="mono">{formatX(x[hover], hover)}</span>
            {tooltipRows.map((s) => (
              <span key={s.id} className="xy-tip-row">
                {series.length > 1 && <span className="xy-swatch" style={{ "--c": s.colorAt ? s.colorAt(s.v, hover) : s.color }} />}
                {series.length > 1 && <span className="xy-tip-label">{s.label}</span>}
                <strong className="num">
                  {isNum(s.v) ? formatY(s.v, true) : "—"}
                  {isNum(s.v) && unit ? ` ${unit}` : ""}
                </strong>
              </span>
            ))}
            {total != null && (
              <span className="xy-tip-row xy-tip-total">
                <span className="xy-tip-label">Total</span>
                <strong className="num">
                  {formatY(total, true)}
                  {unit ? ` ${unit}` : ""}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
