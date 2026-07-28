import React from "react";

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-brand)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function Checkbox({ label, checked = false, onChange, disabled = false }) {
  const [focused, setFocused] = React.useState(false);

  return (
    <label style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-2)",
      minHeight: "var(--tap-target-min)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange && onChange(e.target.checked)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}
      />
      <span aria-hidden="true" style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: "var(--radius-xs)",
        border: checked ? "1px solid var(--color-primary-500)" : "1px solid var(--border-strong)",
        background: checked ? "var(--color-primary-500)" : "var(--color-neutral-0)",
        boxShadow: focused ? "var(--focus-ring)" : "none",
        transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
      }}>
        {checked ? <CheckIcon /> : null}
      </span>
      {label ? <span style={{ font: "var(--text-body)", color: "var(--text-primary)" }}>{label}</span> : null}
    </label>
  );
}
