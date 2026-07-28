import React from "react";

const domains = {
  sale: {
    interesado:   { label: "Interesado", fg: "var(--color-sale-interesado-fg)", bg: "var(--color-sale-interesado-bg)" },
    presupuesto:  { label: "Presupuesto enviado", fg: "var(--color-sale-presupuesto-fg)", bg: "var(--color-sale-presupuesto-bg)" },
    cerrado:      { label: "Cerrado", fg: "var(--color-sale-cerrado-fg)", bg: "var(--color-sale-cerrado-bg)" },
    perdido:      { label: "Perdido", fg: "var(--color-sale-perdido-fg)", bg: "var(--color-sale-perdido-bg)" },
  },
  claim: {
    abierto:      { label: "Abierto", fg: "var(--color-claim-abierto-fg)", bg: "var(--color-claim-abierto-bg)" },
    tramitacion:  { label: "En tramitación", fg: "var(--color-claim-tramitacion-fg)", bg: "var(--color-claim-tramitacion-bg)" },
    resuelto:     { label: "Resuelto", fg: "var(--color-claim-resuelto-fg)", bg: "var(--color-claim-resuelto-bg)" },
  },
  priority: {
    alta:   { label: "Alta", fg: "var(--color-priority-alta-fg)", bg: "var(--color-priority-alta-bg)" },
    media:  { label: "Media", fg: "var(--color-priority-media-fg)", bg: "var(--color-priority-media-bg)" },
    baja:   { label: "Baja", fg: "var(--color-priority-baja-fg)", bg: "var(--color-priority-baja-bg)" },
  },
  policy: {
    activa:       { label: "Activa", fg: "var(--color-policy-activa-fg)", bg: "var(--color-policy-activa-bg)" },
    reemplazada:  { label: "Reemplazada", fg: "var(--color-policy-reemplazada-fg)", bg: "var(--color-policy-reemplazada-bg)" },
    anulada:      { label: "Anulada", fg: "var(--color-policy-anulada-fg)", bg: "var(--color-policy-anulada-bg)" },
  },
};

export function StatusBadge({ domain = "sale", status }) {
  const table = domains[domain] || domains.sale;
  const key = status && table[status] ? status : Object.keys(table)[0];
  const s = table[key];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      height: 22,
      paddingInline: 10,
      borderRadius: "var(--radius-pill)",
      font: "var(--text-micro)",
      letterSpacing: "var(--letter-spacing-wide)",
      textTransform: "uppercase",
      color: s.fg,
      background: s.bg,
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}
