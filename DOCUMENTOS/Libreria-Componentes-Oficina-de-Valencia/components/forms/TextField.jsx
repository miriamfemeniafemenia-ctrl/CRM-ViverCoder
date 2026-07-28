import React from "react";

const baseInput = {
  width: "100%",
  boxSizing: "border-box",
  height: 40,
  paddingInline: "var(--space-3)",
  borderRadius: "var(--radius-xs)",
  background: "var(--color-neutral-0)",
  font: "var(--text-body)",
  color: "var(--text-primary)",
  outline: "none",
  transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
};

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.1 4.1M6.7 6.7C4 8.4 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.8" />
      <path d="M9.5 9.8a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function TextField({ label, value, onChange, placeholder, error, disabled = false, type = "text" }) {
  const [focused, setFocused] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword ? (reveal ? "text" : "password") : type;

  let border = "1px solid var(--border-default)";
  let shadow = "none";
  if (error) border = "1px solid var(--color-warning-border)";
  if (focused && !error) { border = "1px solid var(--border-focus)"; shadow = "var(--focus-ring)"; }
  if (disabled) border = "1px solid var(--border-default)";

  const inputEl = (
    <input
      type={effectiveType}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={e => onChange && onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...baseInput,
        border,
        boxShadow: shadow,
        paddingRight: isPassword ? 40 : "var(--space-3)",
        background: disabled ? "var(--color-neutral-100)" : "var(--color-neutral-0)",
        color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "text",
      }}
    />
  );

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }}>
      {label ? <span style={{ font: "var(--text-label)", color: "var(--text-secondary)" }}>{label}</span> : null}
      {isPassword ? (
        <span style={{ position: "relative", display: "flex", width: "100%" }}>
          {inputEl}
          <button
            type="button"
            aria-label={reveal ? "Ocultar contraseña" : "Mostrar contraseña"}
            disabled={disabled}
            onClick={() => setReveal(r => !r)}
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {reveal ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </span>
      ) : inputEl}
      {error ? <span style={{ font: "var(--text-meta)", color: "var(--color-warning-fg)" }}>{error}</span> : null}
    </label>
  );
}
