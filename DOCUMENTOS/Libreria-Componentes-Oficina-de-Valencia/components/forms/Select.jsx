import React from "react";

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Select({ label, value, onChange, options = [], placeholder, error, disabled = false }) {
  const [focused, setFocused] = React.useState(false);
  let border = "1px solid var(--border-default)";
  let shadow = "none";
  if (error) border = "1px solid var(--color-warning-border)";
  if (focused && !error) { border = "1px solid var(--border-focus)"; shadow = "var(--focus-ring)"; }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }}>
      {label ? <span style={{ font: "var(--text-label)", color: "var(--text-secondary)" }}>{label}</span> : null}
      <span style={{ position: "relative", display: "flex", width: "100%" }}>
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 40,
            paddingInline: "var(--space-3)",
            paddingRight: "var(--space-8)",
            borderRadius: "var(--radius-xs)",
            border,
            boxShadow: shadow,
            background: disabled ? "var(--color-neutral-100)" : "var(--color-neutral-0)",
            color: value ? "var(--text-primary)" : "var(--text-tertiary)",
            font: "var(--text-body)",
            outline: "none",
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
          }}
        >
          {placeholder ? <option value="" disabled hidden>{placeholder}</option> : null}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span style={{
          position: "absolute",
          right: "var(--space-3)",
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}>
          <ChevronIcon />
        </span>
      </span>
      {error ? <span style={{ font: "var(--text-meta)", color: "var(--color-warning-fg)" }}>{error}</span> : null}
    </label>
  );
}
