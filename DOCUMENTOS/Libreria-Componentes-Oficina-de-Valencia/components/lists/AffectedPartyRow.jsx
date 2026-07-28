import React from "react";

function ActionIcon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "edit") return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...common}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    </svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...common}>
      <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m3 0-.8 12.1a2 2 0 0 1-2 1.9H7.8a2 2 0 0 1-2-1.9L5 7z" />
    </svg>
  );
}

function IconButton({ name, title, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={e => { e.stopPropagation(); onClick && onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: hover ? "var(--surface-sunken)" : "transparent",
        color: "var(--text-tertiary)",
        cursor: "pointer",
      }}
    >
      <ActionIcon name={name} />
    </button>
  );
}

export function AffectedPartyRow({ name, phone, email, divider = true, onEdit, onRemove }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-3)",
      paddingBlock: "var(--space-2)",
      paddingInline: "var(--space-4)",
      borderBottom: divider ? "1px solid var(--border-default)" : "none",
    }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{
          font: "var(--text-body-strong)",
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{name}</span>
        <span style={{
          font: "var(--text-meta)",
          color: "var(--text-tertiary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{[phone, email].filter(Boolean).join(" · ")}</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <IconButton name="edit" title="Editar parte afectada" onClick={onEdit} />
        <IconButton name="trash" title="Quitar parte afectada" onClick={onRemove} />
      </span>
    </div>
  );
}
