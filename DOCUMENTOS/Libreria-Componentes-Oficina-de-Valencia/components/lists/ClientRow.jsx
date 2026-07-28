import React from "react";
import { StatusBadge } from "../badges/StatusBadge";

export function ClientRow({ name, saleStatus, priority, subtitle, action, divider = true, onClick }) {
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
        minHeight: subtitle ? 56 : "var(--table-row-height)",
        paddingBlock: subtitle ? "var(--space-2)" : 0,
        paddingInline: "var(--space-4)",
        borderBottom: divider ? "1px solid var(--border-default)" : "none",
        background: hover ? "var(--surface-sunken)" : "transparent",
        cursor: onClick ? "pointer" : "default",
        transform: active ? "scale(var(--scale-press))" : "scale(1)",
        transition: "background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{
          font: "var(--text-body-strong)",
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{name}</span>
        {subtitle ? (
          <span style={{
            font: "var(--text-meta)",
            color: "var(--text-tertiary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>{subtitle}</span>
        ) : null}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
        {priority ? <StatusBadge domain="priority" status={priority} /> : null}
        <StatusBadge domain="sale" status={saleStatus} />
        {action ? <span onClick={e => e.stopPropagation()} style={{ display: "inline-flex" }}>{action}</span> : null}
      </span>
    </div>
  );
}
