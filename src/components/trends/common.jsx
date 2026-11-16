import { ExternalLink } from "lucide-react";
import { isNum } from "../../lib/format";
import { SERIES_COLORS } from "../../lib/colors";

export function SourceLine({ children, href, label }) {
  return (
    <p className="source-line">
      {children}
      {href && (
        <>
          {" "}
          <a href={href} target="_blank" rel="noreferrer">
            {label || "Source"} <ExternalLink size={10} aria-hidden="true" />
          </a>
        </>
      )}
    </p>
  );
}

export function Sparkline({ values, color = SERIES_COLORS.blue, width = 96, height = 22, label }) {
  const v = values.map((x) => (isNum(x) ? x : null));
  const valid = v.filter((x) => x != null);
  if (valid.length < 2) return null;
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const span = hi - lo || 1;
  let d = "";
  let pen = false;
  v.forEach((x, i) => {
    if (x == null) {
      pen = false;
      return;
    }
    const px = (i / (v.length - 1)) * (width - 2) + 1;
    const py = height - 2 - ((x - lo) / span) * (height - 4);
    d += `${pen ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
    pen = true;
  });
  return (
    <svg width={width} height={height} className="sparkline" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

export function KpiCell({ label, value, unit, sub, tone, title }) {
  return (
    <div className={`kpi-cell ${tone ? `tone-${tone}` : ""}`} title={title}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-cell-value num">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

export function SignedNumber({ value, digits = 1, unit = "", suffix = "" }) {
  if (!isNum(value)) return <span>—</span>;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return (
    <span className="num">
      {sign}
      {Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
      {unit}
      {suffix}
    </span>
  );
}

export function RangeTabs({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={value === option.id ? "is-active" : undefined}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
