import React from "react";

function ActionIcon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "check") return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
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

function IconButton({ name, title, color = "var(--text-tertiary)", onClick }) {
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
        color,
        cursor: "pointer",
      }}
    >
      <ActionIcon name={name} />
    </button>
  );
}

export function ReminderItem({ clientName, date, note, assignedTo, overdue = false, done = false, onClick, onComplete, onEdit, onDelete }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && onClick) { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: hover ? "var(--surface-sunken)" : "var(--surface-card)",
        border: overdue ? "1px solid var(--color-warning-border)" : "1px solid var(--border-default)",
        borderLeft: overdue ? "3px solid var(--color-warning-border)" : "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-xs)",
        cursor: onClick ? "pointer" : "default",
        transform: active ? "scale(var(--scale-press))" : "scale(1)",
        transition: "background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)",
        opacity: done ? 0.6 : 1,
      }}
    >
      <IconButton
        name="check"
        title={done ? "Marcada como hecha" : "Marcar como hecha"}
        color={done ? "var(--color-primary-600)" : "var(--text-tertiary)"}
        onClick={onComplete}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          <span style={{
            font: "var(--text-body-strong)",
            color: "var(--text-primary)",
            textDecoration: done ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{clientName}</span>
          <span style={{ font: "var(--text-meta)", color: overdue ? "var(--color-warning-fg)" : "var(--text-tertiary)", whiteSpace: "nowrap" }}>
            {overdue ? "Vencido · " : ""}{date}{assignedTo ? ` · ${assignedTo}` : ""}
          </span>
        </div>
        {note ? <p style={{ margin: 0, font: "var(--text-body)", color: "var(--text-secondary)" }}>{note}</p> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton name="edit" title="Editar recordatorio" onClick={onEdit} />
        <IconButton name="trash" title="Eliminar recordatorio" onClick={onDelete} />
      </div>
    </div>
  );
}
