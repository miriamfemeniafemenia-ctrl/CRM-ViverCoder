import React from "react";

export function TextArea({ label, value, onChange, placeholder, error, disabled = false, rows = 3 }) {
  const [focused, setFocused] = React.useState(false);
  let border = "1px solid var(--border-default)";
  let shadow = "none";
  if (error) border = "1px solid var(--color-warning-border)";
  if (focused && !error) { border = "1px solid var(--border-focus)"; shadow = "var(--focus-ring)"; }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }}>
      {label ? <span style={{ font: "var(--text-label)", color: "var(--text-secondary)" }}>{label}</span> : null}
      <textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        onChange={e => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          paddingBlock: "var(--space-2)",
          paddingInline: "var(--space-3)",
          borderRadius: "var(--radius-xs)",
          border,
          boxShadow: shadow,
          background: disabled ? "var(--color-neutral-100)" : "var(--color-neutral-0)",
          color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
          font: "var(--text-body)",
          outline: "none",
          resize: "vertical",
          cursor: disabled ? "not-allowed" : "text",
          transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
        }}
      />
      {error ? <span style={{ font: "var(--text-meta)", color: "var(--color-warning-fg)" }}>{error}</span> : null}
    </label>
  );
}
