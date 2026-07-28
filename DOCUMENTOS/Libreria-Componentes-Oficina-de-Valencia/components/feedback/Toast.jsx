import React from "react";

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Toast({ open, message, variant = "neutral", duration, onClose }) {
  React.useEffect(() => {
    if (!open || !duration) return;
    const id = setTimeout(() => { if (onClose) onClose(); }, duration);
    return () => clearTimeout(id);
  }, [open, duration, onClose]);

  if (!open) return null;

  const isError = variant === "error";

  return (
    <div style={{
      position: "fixed",
      left: "50%",
      bottom: "var(--space-6)",
      transform: "translateX(-50%)",
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      maxWidth: 420,
      padding: "var(--space-3) var(--space-4)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-lg)",
      background: isError ? "var(--color-warning-bg)" : "var(--color-neutral-800)",
      color: isError ? "var(--color-warning-fg)" : "var(--color-neutral-0)",
      border: isError ? "1px solid var(--color-warning-border)" : "1px solid transparent",
    }}>
      {isError ? <AlertIcon /> : <CheckIcon />}
      <span style={{ font: "var(--text-body)", flex: 1 }}>{message}</span>
      {onClose ? (
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}
