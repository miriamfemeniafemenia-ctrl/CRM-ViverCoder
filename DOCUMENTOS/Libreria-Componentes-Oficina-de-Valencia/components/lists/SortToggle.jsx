import React from "react";

function ChevronIcon({ direction }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: direction === "desc" ? "rotate(180deg)" : "none", transition: "transform var(--duration-fast) var(--ease-standard)" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function SortToggle({ label, direction, onToggle }) {
  const [hover, setHover] = React.useState(false);
  const active = direction === "asc" || direction === "desc";
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Ordenar por ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        height: 28,
        paddingInline: "var(--space-2)",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: hover ? "var(--surface-sunken)" : "transparent",
        color: active ? "var(--color-primary-600)" : "var(--text-tertiary)",
        font: "var(--text-label)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
      }}
    >
      {label}
      <ChevronIcon direction={active ? direction : "asc"} />
    </button>
  );
}
