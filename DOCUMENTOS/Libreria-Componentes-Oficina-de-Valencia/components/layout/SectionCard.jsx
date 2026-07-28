import React from "react";

export function SectionCard({ title, action, children }) {
  return (
    <section style={{
      background: "var(--surface-card)",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
    }}>
      {(title || action) && (
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "1px solid var(--border-default)",
        }}>
          <h3 style={{ margin: 0, font: "var(--text-subtitle)", color: "var(--text-primary)" }}>{title}</h3>
          {action}
        </header>
      )}
      <div style={{ padding: "var(--space-4)" }}>{children}</div>
    </section>
  );
}
