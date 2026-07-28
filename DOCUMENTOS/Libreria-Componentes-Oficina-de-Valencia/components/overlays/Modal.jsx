import React from "react";

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-500)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Modal({ open, title, onClose, children, footer, width = 480 }) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = e => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--surface-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        zIndex: 100,
      }}
    >
      <div style={{
        width: "100%",
        maxWidth: width,
        maxHeight: "calc(100vh - var(--space-8))",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
      }}>
        {title || onClose ? (
          <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--border-default)",
            flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, font: "var(--text-title)", color: "var(--text-primary)" }}>{title}</h2>
            {onClose ? (
              <button type="button" aria-label="Cerrar" onClick={onClose} style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                cursor: "pointer",
              }}>
                <CloseIcon />
              </button>
            ) : null}
          </header>
        ) : null}
        <div style={{ padding: "var(--space-4)", overflowY: "auto" }}>{children}</div>
        {footer ? (
          <footer style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            borderTop: "1px solid var(--border-default)",
            flexShrink: 0,
          }}>{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
