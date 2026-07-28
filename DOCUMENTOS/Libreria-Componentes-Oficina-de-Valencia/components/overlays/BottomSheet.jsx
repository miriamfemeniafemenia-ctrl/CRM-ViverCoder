import React from "react";

export function BottomSheet({ open, title, onClose, children, footer }) {
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
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div style={{
        width: "100%",
        maxWidth: 560,
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-card)",
        borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        boxShadow: "var(--shadow-lg)",
        paddingBottom: "var(--safe-bottom)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-2)" }}>
          <span style={{ width: 36, height: 4, borderRadius: "var(--radius-pill)", background: "var(--color-neutral-300)" }} />
        </div>
        {title ? (
          <header style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--border-default)",
            flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, font: "var(--text-title)", color: "var(--text-primary)" }}>{title}</h2>
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
