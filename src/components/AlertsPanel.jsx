import { AlertOctagon, AlertTriangle, CheckCircle2, Info, MinusCircle } from "lucide-react";
import { Panel, StatusBadge } from "./ui";
import { fmtDateTime, isNum } from "../lib/format";

const SEVERITY = {
  Extreme: { tone: "critical", Icon: AlertOctagon },
  Severe: { tone: "critical", Icon: AlertOctagon },
  Moderate: { tone: "warning", Icon: AlertTriangle },
  Minor: { tone: "info", Icon: Info },
  Unknown: { tone: "muted", Icon: Info },
};

export default function AlertsPanel({ location, state }) {
  const hasPoint = isNum(location?.latitude) && isNum(location?.longitude);
  const nws = state.data?.sourceStatus?.nws;
  const alerts = state.data?.alerts || [];

  let status = "idle";
  let label = "No point";
  if (hasPoint) {
    if (state.status === "loading" && !nws) {
      status = "loading";
      label = "Checking";
    } else if (nws === "connected") {
      status = alerts.length ? "partial" : "connected";
      label = alerts.length ? `${alerts.length} active` : "None active";
    } else if (nws === "not-covered") {
      status = "not-covered";
      label = "Not covered";
    } else if (nws === "unavailable" || state.status === "error") {
      status = "unavailable";
      label = "Unavailable";
    }
  }

  if (alerts.length && alerts.some((alert) => SEVERITY[alert.severity]?.tone === "critical")) {
    status = "unavailable"; // red tone for genuinely severe alerts
    label = `${alerts.length} active · severe`;
  }

  return (
    <Panel
      id="nws-alerts"
      className="alerts-panel"
      title="Weather alerts"
      meta="NOAA / NWS · contiguous US"
      actions={<StatusBadge status={status} label={label} />}
    >
      {!hasPoint ? (
        <p className="row-note">Select a point to check active National Weather Service alerts.</p>
      ) : status === "loading" ? (
        <p className="row-note">Querying the NWS active-alert feed for this point…</p>
      ) : nws === "not-covered" ? (
        <p className="row-note">
          <MinusCircle size={12} aria-hidden="true" /> Outside NWS coverage. Alerts are only queried for
          the contiguous United States — this is not a statement that no hazards exist here.
        </p>
      ) : nws === "unavailable" || (state.status === "error" && !nws) ? (
        <p className="row-note tone-bad" role="alert">
          <AlertTriangle size={12} aria-hidden="true" /> The NWS feed could not be reached. Absence of
          alerts is <strong>not</strong> confirmed.
        </p>
      ) : alerts.length === 0 ? (
        <p className="row-note tone-ok">
          <CheckCircle2 size={12} aria-hidden="true" /> No active alerts returned for this point. Not a
          guarantee that no local hazards exist.
        </p>
      ) : (
        <ul className="alert-list">
          {alerts.slice(0, 6).map((alert) => {
            const severity = SEVERITY[alert.severity] || SEVERITY.Unknown;
            const Icon = severity.Icon;
            return (
              <li key={alert.id} className={`alert-row sev-${severity.tone}`}>
                <Icon size={14} aria-hidden="true" className="alert-icon" />
                <div className="alert-body">
                  <div className="alert-top">
                    <strong>{alert.event}</strong>
                    <span className={`tag tag-${severity.tone}`}>{alert.severity}</span>
                  </div>
                  {alert.areaDesc && <p className="alert-area">{alert.areaDesc}</p>}
                  <p className="alert-times mono">
                    {fmtDateTime(alert.effective)} → {fmtDateTime(alert.expires)}
                  </p>
                </div>
                <a href={alert.url} target="_blank" rel="noreferrer" className="alert-link">
                  NWS<span className="sr-only"> source for {alert.event}</span> ↗
                </a>
              </li>
            );
          })}
          {alerts.length > 6 && <li className="row-note">+{alerts.length - 6} more on weather.gov</li>}
        </ul>
      )}
    </Panel>
  );
}
