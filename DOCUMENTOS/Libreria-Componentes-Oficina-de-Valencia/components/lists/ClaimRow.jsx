import React from "react";
import { StatusBadge } from "../badges/StatusBadge";

export function ClaimRow({ clientName, claimType, claimStatus, divider = true, onClick }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && onClick) { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        height: "var(--table-row-height)",
        paddingInline: "var(--space-4)",
        borderBottom: divider ? "1px solid var(--border-default)" : "none",
        background: hover ? "var(--surface-sunken)" : "transparent",
        cursor: onClick ? "pointer" : "default",
        transform: active ? "scale(var(--scale-press))" : "scale(1)",
        transition: "background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)",
      }}
    >
      <span style={{
        display: "flex",
        alignItems: "baseline",
        gap: "var(--space-3)",
        minWidth: 0,
      }}>
        <span style={{
          font: "var(--text-body-strong)",
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{clientName}</span>
        <span style={{
          font: "var(--text-meta)",
          color: "var(--text-tertiary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{claimType}</span>
      </span>
      <StatusBadge domain="claim" status={claimStatus} />
    </div>
  );
}
