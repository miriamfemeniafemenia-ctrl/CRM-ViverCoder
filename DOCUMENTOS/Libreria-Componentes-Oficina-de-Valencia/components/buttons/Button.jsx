import React from "react";

const iconPaths = {
  edit: <path d="M4 20l4-1 10-10a2.1 2.1 0 0 0-3-3L5 16l-1 4z" />,
  save: (
    <>
      <path d="M5 4h11l3 3v13H5V4z" />
      <path d="M8 4v6h7V4" />
      <path d="M8 14h8v6H8z" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.35-4.35" />
    </>
  ),
};

function ButtonIcon({ name }) {
  if (!iconPaths[name]) return null;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "ov-spin 0.6s linear infinite" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const sizeStyles = {
  standard: { height: 40, paddingInline: 18, font: "var(--text-label)" },
  compact:  { height: 32, paddingInline: 12, font: "var(--text-label)" },
};

const variantStyles = {
  primary: {
    base: { background: "var(--color-primary-500)", color: "var(--text-on-brand)", border: "1px solid transparent" },
    hover: { background: "var(--color-primary-600)" },
    active: { background: "var(--color-primary-700)" },
    disabled: { background: "var(--color-neutral-200)", color: "var(--color-neutral-400)" },
  },
  secondary: {
    base: { background: "var(--color-neutral-0)", color: "var(--color-primary-600)", border: "1px solid var(--border-strong)" },
    hover: { background: "var(--color-primary-50)" },
    active: { background: "var(--color-primary-100)" },
    disabled: { background: "var(--color-neutral-0)", color: "var(--color-neutral-400)", border: "1px solid var(--border-default)" },
  },
  text: {
    base: { background: "transparent", color: "var(--color-primary-600)", border: "1px solid transparent", paddingInline: 4 },
    hover: { textDecoration: "underline" },
    active: { color: "var(--color-primary-700)" },
    disabled: { color: "var(--color-neutral-400)" },
  },
};

export function Button({ variant = "primary", size = "standard", disabled = false, loading = false, icon, children, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const v = variantStyles[variant] || variantStyles.primary;
  const s = sizeStyles[size] || sizeStyles.standard;
  const isInteractive = !disabled && !loading;

  let visual = { ...v.base };
  if (disabled) visual = { ...visual, ...v.disabled, cursor: "not-allowed", opacity: variant === "text" ? 0.6 : 1 };
  else if (loading) visual = { ...visual, cursor: "wait" };
  else if (active) visual = { ...visual, ...v.active };
  else if (hover) visual = { ...visual, ...v.hover };

  return (
    <button
      onClick={isInteractive ? onClick : undefined}
      onMouseEnter={() => isInteractive && setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => isInteractive && setActive(true)}
      onMouseUp={() => setActive(false)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: s.height,
        minHeight: "var(--tap-target-min)",
        paddingInline: s.paddingInline,
        borderRadius: variant === "primary" ? "var(--radius-pill)" : "var(--radius-md)",
        font: s.font,
        cursor: disabled ? "not-allowed" : loading ? "wait" : "pointer",
        transform: isInteractive && active ? "scale(var(--scale-press))" : "scale(1)",
        transition: "background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)",
        ...visual,
        ...style,
      }}
    >
      {loading ? <Spinner /> : <ButtonIcon name={icon} />}
      {children}
    </button>
  );
}
