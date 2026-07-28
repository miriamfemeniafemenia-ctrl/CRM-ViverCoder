import React from "react";

export function Tabs({ items = [], active, onChange }) {
  return (
    <div role="tablist" style={{
      display: "flex",
      gap: "var(--space-4)",
      borderBottom: "1px solid var(--border-default)",
      overflowX: "auto",
    }}>
      {items.map(it => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange && onChange(it.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
              paddingBlock: "var(--space-2)",
              minHeight: "var(--tap-target-min)",
              border: "none",
              borderBottom: isActive ? "2px solid var(--color-primary-500)" : "2px solid transparent",
              background: "transparent",
              font: "var(--text-label)",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--color-primary-600)" : "var(--text-secondary)",
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
            }}
          >
            {it.label}
            {it.count ? (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 18,
                height: 18,
                paddingInline: 4,
                borderRadius: "var(--radius-pill)",
                background: isActive ? "var(--color-primary-500)" : "var(--color-neutral-200)",
                color: isActive ? "var(--text-on-brand)" : "var(--text-secondary)",
                font: "var(--text-micro)",
                fontWeight: 700,
              }}>{it.count > 9 ? "9+" : it.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
