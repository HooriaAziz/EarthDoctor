import { useEffect, useState } from "react";
import { Globe2, Orbit } from "lucide-react";
import { statusMeta } from "../lib/status";

function UtcClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Minute precision is enough; align updates to the minute boundary.
    let intervalId;
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  const iso = now.toISOString();
  return (
    <time className="utc-clock mono" dateTime={iso} title="Coordinated Universal Time">
      <span className="utc-label">UTC</span> {iso.slice(0, 10)} {iso.slice(11, 16)}
    </time>
  );
}

function SourceChip({ label, status, detail }) {
  const meta = statusMeta(status);
  const Icon = meta.Icon;
  return (
    <li className={`source-chip tone-${meta.tone}`} title={`${label}: ${meta.label}${detail ? ` · ${detail}` : ""}`}>
      <Icon size={12} aria-hidden="true" className={status === "loading" ? "spin" : undefined} />
      <span className="source-chip-label">{label}</span>
      <span className="sr-only">{meta.label}</span>
    </li>
  );
}

const SECTIONS = [
  { id: "inside", label: "Inside Earth", Icon: Globe2 },
  { id: "outside", label: "Around Earth", Icon: Orbit },
];

export default function AppHeader({ section, onSectionChange, search, sources }) {
  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="Earth Doctor home">
        <svg className="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#398CF0" strokeWidth="1.6" />
          <ellipse cx="12" cy="12" rx="4.2" ry="10" fill="none" stroke="#398CF0" strokeWidth="1.2" />
          <path d="M2.5 9h19M2.5 15h19" stroke="#13B981" strokeWidth="1.2" />
          <circle cx="17.5" cy="6.5" r="2.2" fill="#E54858" />
        </svg>
        <span className="brand-text">
          <strong>Earth Doctor</strong>
          <span>Planetary intelligence</span>
        </span>
      </a>

      <nav className="section-nav" aria-label="Workspace">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`section-tab ${section === id ? "is-active" : ""}`}
            aria-current={section === id ? "page" : undefined}
            onClick={() => onSectionChange(id)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="header-search">{search}</div>

      <div className="header-right">
        {sources?.length > 0 && (
          <ul className="source-chips" aria-label="Data source status">
            {sources.map((source) => (
              <SourceChip key={source.label} {...source} />
            ))}
          </ul>
        )}
        <UtcClock />
      </div>
    </header>
  );
}
