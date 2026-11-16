import { useState } from "react";
import { Check, Copy, ExternalLink, Megaphone, Sparkles } from "lucide-react";
import { Panel, StatusBadge, EmptyState, Tag } from "./ui";
import { useRemote } from "../hooks/useRemote";
import { fmtDateTime, fmtNum } from "../lib/format";

const LEVELS = [
  { id: "individual", label: "Individual" },
  { id: "family", label: "Family" },
  { id: "school", label: "School" },
  { id: "neighborhood", label: "Neighborhood" },
  { id: "community", label: "Community" },
  { id: "political", label: "Civic & policy" },
];

const PLATFORM_LABEL = { x: "X", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn" };
const EFFORT_TONE = { low: "ok", medium: "info", high: "warning" };
const THIRTY_MIN = 30 * 60 * 1000;

async function loadActions(code, signal) {
  let response;
  try {
    response = await fetch(`/api/actions/${code}`, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return { state: "offline" };
  }
  const body = await response.json().catch(() => null);
  if (response.ok && body?.levels) return { state: "ready", doc: body };
  // The first request for a country triggers generation (about 10–40 s);
  // afterwards the server answers from its 12-hour cache.
  if (response.status === 503 && body?.error === "not-configured") return { state: "not-configured", missing: body.missing ?? [] };
  if (response.status === 502 && body?.error === "generation-failed") return { state: "failed", detail: body.detail };
  return { state: "offline" };
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function shareLinks(text) {
  const encoded = encodeURIComponent(text);
  return [
    { label: "X", href: `https://x.com/intent/post?text=${encoded}` },
    { label: "Bluesky", href: `https://bsky.app/intent/compose?text=${encoded}` },
  ];
}

export default function ActionPanel({ country }) {
  const code = country?.code ?? null;
  const [level, setLevel] = useState("individual");
  const remote = useRemote(code ? `actions-${code}` : null, (signal) => loadActions(code, signal), {
    enabled: Boolean(code),
    maxAgeMs: THIRTY_MIN,
  });
  const state = remote.data?.state ?? (remote.status === "error" ? "offline" : "loading");
  const doc = remote.data?.doc;

  const badge =
    state === "ready"
      ? doc.cache === "stale"
        ? { status: "partial", label: "Expired copy" }
        : { status: "connected", label: doc.cache === "miss" ? "Generated now" : "From cache" }
      : state === "loading"
        ? { status: "loading", label: "Generating" }
        : {
            status: "unavailable",
            label: state === "not-configured" ? "Not configured" : state === "failed" ? "Generation failed" : "Service offline",
          };

  return (
    <Panel
      id="take-action"
      className="action-panel"
      title={country ? `Take action · ${country.name}` : "Take action"}
      meta={
        state === "ready"
          ? `AI-generated with ${doc.model} · ${fmtDateTime(doc.generatedAt)} · cached until ${fmtDateTime(doc.expiresAt)}`
          : "Practical AI suggestions based on this country's emissions profile"
      }
      actions={country && <StatusBadge status={badge.status} label={badge.label} />}
    >
      {!country ? (
        <EmptyState icon={Sparkles} title="Select a country">
          Click a country on the globe or search one to see what individuals, families, schools,
          neighborhoods, communities and civic participants there can do.
        </EmptyState>
      ) : state === "loading" ? (
        <div className="action-generating" role="status">
          <Sparkles size={16} aria-hidden="true" className="spin-slow" />
          <div>
            <strong>Preparing suggestions for {country.name}…</strong>
            <p>
              Preparing actions based on the country's largest sources of emissions. This may take a
              moment; saved suggestions load faster next time.
            </p>
          </div>
        </div>
      ) : state === "failed" ? (
        <EmptyState icon={Sparkles} title="Suggestions could not be generated">
          The model did not return a usable answer{remote.data.detail ? ` (${remote.data.detail})` : ""}. Nothing
          was cached.
          <button type="button" className="btn btn-sm action-retry" onClick={remote.reload}>
            Try again
          </button>
        </EmptyState>
      ) : state === "not-configured" ? (
        <EmptyState icon={Sparkles} title="Action service not configured">
          Add {remote.data.missing.join(" and ") || "the keys"} to the server's .env file and restart{" "}
          <code>npm run server</code>.
          <button type="button" className="btn btn-sm action-retry" onClick={remote.reload}>
            Retry
          </button>
        </EmptyState>
      ) : state === "offline" ? (
        <EmptyState icon={Sparkles} title="Action service offline">
          The suggestions API could not be reached. Start it with <code>npm run server</code>.
          <button type="button" className="btn btn-sm action-retry" onClick={remote.reload}>
            Retry
          </button>
        </EmptyState>
      ) : (
        <>
          <p className="action-summary">{doc.summary}</p>

          {doc.input && (
            <dl className="action-basis">
              <div>
                <dt>Emissions {doc.input.year}</dt>
                <dd className="mono">
                  {fmtNum(doc.input.totalMtCO2e, 1)} Mt CO₂e · #{doc.input.rankOf?.rank} of {doc.input.rankOf?.of}
                </dd>
              </div>
              <div>
                <dt>Per person</dt>
                <dd className="mono">
                  {fmtNum(doc.input.perCapitaT, 2)} t (world {fmtNum(doc.input.worldPerCapitaT, 2)} t)
                </dd>
              </div>
              <div>
                <dt>Largest sectors</dt>
                <dd>{doc.input.topSectors?.slice(0, 3).map((s) => `${s.sector} ${fmtNum(s.sharePct, 0)}%`).join(" · ")}</dd>
              </div>
            </dl>
          )}

          <div className="panel-tabs action-levels" role="tablist" aria-label="Level of action">
            {LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={level === item.id}
                className={level === item.id ? "is-active" : undefined}
                onClick={() => setLevel(item.id)}
              >
                {item.label}
                <span className="layer-count">{doc.levels?.[item.id]?.length ?? 0}</span>
              </button>
            ))}
          </div>

          <ol className="action-list" role="tabpanel" aria-label={`${LEVELS.find((l) => l.id === level)?.label} actions`}>
            {(doc.levels?.[level] ?? []).map((item, i) => (
              <li key={`${level}-${i}`}>
                <div className="action-head">
                  <strong>{item.action}</strong>
                  <Tag tone={EFFORT_TONE[item.effort] || "muted"}>{item.effort} effort</Tag>
                </div>
                {item.why && <p>{item.why}</p>}
              </li>
            ))}
          </ol>
          {level === "political" && (
            <p className="row-note">Non-partisan civic participation only — no party or candidate is endorsed.</p>
          )}

          {doc.movements?.length > 0 && (
            <section className="action-social" aria-label="Campaigns to join">
              <h3 className="subhead">Campaigns to join</h3>
              <div className="post-grid">
                {doc.movements.map((movement) => (
                  <article className="post-card" key={movement.id}>
                    <strong>{movement.name}</strong>
                    <span className="muted">{movement.when}</span>
                    <p>{movement.why}</p>
                    <p>{movement.how}</p>
                    <CopyButton text={`${movement.name}: ${movement.how} ${movement.hashtag}`} label="Copy idea" />
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="action-social">
            <div className="action-social-head">
              <h3 className="subhead">
                <Megaphone size={13} aria-hidden="true" /> Hashtags
              </h3>
              <CopyButton text={doc.hashtags.join(" ")} label="Copy all" />
            </div>
            <ul className="hashtag-list">
              {doc.hashtags.map((tag) => (
                <li key={tag} className="mono">
                  {tag}
                </li>
              ))}
            </ul>

            <h3 className="subhead">Ready-to-post messages</h3>
            <div className="post-grid">
              {doc.posts.map((post, i) => {
                const full = post.platform === "x" ? post.text : `${post.text}\n\n${doc.hashtags.slice(0, 5).join(" ")}`;
                return (
                  <article key={i} className="post-card">
                    <header>
                      <span className="post-platform">{PLATFORM_LABEL[post.platform] || post.platform}</span>
                      <span className="mono muted">{full.length} chars</span>
                    </header>
                    <p>{post.text}</p>
                    <footer>
                      <CopyButton text={full} />
                      {shareLinks(full).map((link) => (
                        <a key={link.label} className="btn btn-ghost btn-sm" href={link.href} target="_blank" rel="noreferrer">
                          {link.label} <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      ))}
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>

          <p className="source-line">
            Suggestions are generated by an AI model from the country's EDGAR 2026 emissions profile and may be
            imperfect — check local rules and facts before acting or posting. Suggestions are cached for{" "}
            {doc.cacheHours} hours and renewed when requested after expiry.
          </p>
        </>
      )}
    </Panel>
  );
}
