import React from "react";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function SearchBar({ value = "", onChange, placeholder = "Buscar por nombre, teléfono o correo…", disabled = false }) {
  const [focused, setFocused] = React.useState(false);
  const border = focused ? "1px solid var(--border-focus)" : "1px solid var(--border-default)";
  const shadow = focused ? "var(--focus-ring)" : "none";

  return (
    <span style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      width: "100%",
      boxSizing: "border-box",
      height: 40,
      paddingInline: "var(--space-3)",
      borderRadius: "var(--radius-xs)",
      border,
      boxShadow: shadow,
      background: disabled ? "var(--color-neutral-100)" : "var(--color-neutral-0)",
      transition: "border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
    }}>
      <SearchIcon />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--text-body)",
          color: "var(--text-primary)",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => onChange && onChange("")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            border: "none",
            borderRadius: "var(--radius-pill)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <ClearIcon />
        </button>
      ) : null}
    </span>
  );
}
