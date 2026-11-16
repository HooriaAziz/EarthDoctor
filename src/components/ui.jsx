// Small presentation primitives shared across the workspace.
import { statusMeta } from "../lib/status";
import { EVENT_GROUP_BY_ID, shapePath } from "../lib/eventTypes";

export function Panel({ title, meta, actions, children, className = "", id, as: Tag = "section", ...rest }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag className={`panel ${className}`} id={id} aria-labelledby={headingId} {...rest}>
      {(title || actions || meta) && (
        <header className="panel-head">
          <div className="panel-head-text">
            {title && (
              <h2 className="panel-title" id={headingId}>
                {title}
              </h2>
            )}
            {meta && <span className="panel-meta">{meta}</span>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </Tag>
  );
}

export function StatusBadge({ status, label, title }) {
  const meta = statusMeta(status);
  const Icon = meta.Icon;
  return (
    <span className={`badge badge-${meta.tone}`} title={title}>
      <Icon size={12} aria-hidden="true" className={status === "loading" ? "spin" : undefined} />
      {label ?? meta.label}
    </span>
  );
}

export function Tag({ tone = "muted", children, title }) {
  return (
    <span className={`tag tag-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function EventGlyph({ group, size = 12, title }) {
  const meta = EVENT_GROUP_BY_ID[group] || EVENT_GROUP_BY_ID.other;
  const ring = meta.shape === "ring";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className="event-glyph"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      <path
        d={shapePath(meta.shape)}
        fill={ring ? "none" : meta.color}
        stroke={ring ? meta.color : "rgba(7,11,18,0.9)"}
        strokeWidth={ring ? 2.4 : 1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={16} aria-hidden="true" />}
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
