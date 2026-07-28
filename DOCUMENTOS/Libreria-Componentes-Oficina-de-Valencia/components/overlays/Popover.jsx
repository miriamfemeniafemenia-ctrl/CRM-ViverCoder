import React from "react";

export function Popover({ trigger, children, align = "start", width, open: openProp, onOpenChange }) {
  const [openState, setOpenState] = React.useState(false);
  const rootRef = React.useRef(null);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;

  const setOpen = next => {
    if (!isControlled) setOpenState(next);
    if (onOpenChange) onOpenChange(next);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKeyDown = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <span onClick={() => setOpen(!open)}>{trigger}</span>
      {open ? (
        <div style={{
          position: "absolute",
          top: "calc(100% + var(--space-1))",
          [align === "end" ? "right" : "left"]: 0,
          minWidth: width || 180,
          background: "var(--surface-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
          padding: "var(--space-2)",
          zIndex: 50,
        }}>
          {children}
        </div>
      ) : null}
    </span>
  );
}
