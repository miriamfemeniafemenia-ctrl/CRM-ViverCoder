import React from "react";

function Icon({ name }) {
  const common = { fill: "none", stroke: "var(--text-tertiary)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "search") return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
  if (name === "claim") return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...common}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M12 8v4M12 15h.01" />
    </svg>
  );
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...common}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

export function EmptyState({ icon = "check", message = "No hay nada por aquí", action }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-3)",
      padding: "var(--space-10) var(--space-6)",
      textAlign: "center",
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: "var(--radius-pill)",
        background: "var(--color-neutral-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Icon name={icon} />
      </div>
      <p style={{ margin: 0, font: "var(--text-body)", color: "var(--text-secondary)", maxWidth: 260 }}>{message}</p>
      {action ? <div style={{ marginTop: "var(--space-1)" }}>{action}</div> : null}
    </div>
  );
}
