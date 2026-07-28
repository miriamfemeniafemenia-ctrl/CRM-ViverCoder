import React from "react";

export function StatTile({ label, value, caption }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      padding: "var(--space-4)",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-sm)",
      minWidth: 0,
    }}>
      <span style={{
        font: "var(--text-label)",
        color: "var(--text-tertiary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>{label}</span>
      <span style={{
        font: "var(--text-display)",
        color: "var(--text-primary)",
        letterSpacing: "var(--letter-spacing-tight)",
      }}>{value}</span>
      {caption ? <span style={{ font: "var(--text-meta)", color: "var(--text-tertiary)" }}>{caption}</span> : null}
    </div>
  );
}
