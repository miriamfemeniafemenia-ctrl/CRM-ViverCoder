import React from "react";

export function FilterChip({ label, active = false, onClick }) {
  const [hover, setHover] = React.useState(false);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        paddingInline: "var(--space-3)",
        borderRadius: "var(--radius-pill)",
        border: active ? "1px solid var(--color-primary-500)" : "1px solid var(--border-default)",
        background: active ? "var(--color-primary-50)" : hover ? "var(--surface-sunken)" : "var(--color-neutral-0)",
        color: active ? "var(--color-primary-700)" : "var(--text-secondary)",
        font: "var(--text-label)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
      }}
    >
      {label}
    </button>
  );
}
