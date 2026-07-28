import React from "react";

const typeMeta = {
  llamada:  { label: "Llamada",        icon: "phone" },
  whatsapp: { label: "WhatsApp",       icon: "chat" },
  correo:   { label: "Correo",         icon: "mail" },
  redes:    { label: "Redes sociales", icon: "share" },
  web:      { label: "Web",            icon: "globe" },
};

function Icon({ name }) {
  const common = { fill: "none", stroke: "var(--color-secondary-600)", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "phone") return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...common}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10.5 21 3 13.5 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
  if (name === "chat") return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...common}>
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-5A8 8 0 1 1 21 12z" />
    </svg>
  );
  if (name === "mail") return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...common}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
  if (name === "share") return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...common}>
      <circle cx="18" cy="5" r="2.3" />
      <circle cx="6" cy="12" r="2.3" />
      <circle cx="18" cy="19" r="2.3" />
      <path d="M8.1 10.8l7.8-4.4M8.1 13.2l7.8 4.4" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5z" />
    </svg>
  );
}

export function ContactHistoryItem({ type = "llamada", note, datetime, author, divider = true }) {
  const meta = typeMeta[type] || typeMeta.llamada;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      paddingBlock: "var(--space-3)",
      borderBottom: divider ? "1px solid var(--border-default)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <Icon name={meta.icon} />
          <span style={{ font: "var(--text-label)", color: "var(--text-secondary)" }}>{meta.label}</span>
        </span>
        <span style={{ font: "var(--text-meta)", color: "var(--text-tertiary)" }}>{datetime}</span>
      </div>
      {note ? <p style={{ margin: 0, font: "var(--text-body)", color: "var(--text-primary)" }}>{note}</p> : null}
      {author ? <span style={{ font: "var(--text-meta)", color: "var(--text-tertiary)" }}>— {author}</span> : null}
    </div>
  );
}
