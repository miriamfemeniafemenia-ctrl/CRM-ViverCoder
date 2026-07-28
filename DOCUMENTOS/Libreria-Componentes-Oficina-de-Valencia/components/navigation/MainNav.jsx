import React from "react";

// Minimal inline icon set (line style, 1.75 stroke) so this component has
// no external dependency at runtime.
function Icon({ name, active }) {
  const stroke = active ? "var(--color-primary-600)" : "var(--color-neutral-500)";
  const common = { fill: "none", stroke, strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "tasks") return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
  if (name === "clients") return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.5 14.3c2.5.3 4.5 2.6 4.5 5.7" />
    </svg>
  );
  if (name === "leads") return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <path d="M18 4v6M15 7h6" />
    </svg>
  );
  if (name === "summary") return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M4 20V11M12 20V4M20 20v-6" />
      <path d="M4 20h16" />
    </svg>
  );
  if (name === "unfollowed") return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M12 8v4M12 15h.01" />
    </svg>
  );
}

const items = [
  { key: "tasks", label: "Tareas de hoy", icon: "tasks" },
  { key: "clients", label: "Clientes", icon: "clients" },
  { key: "leads", label: "Posibles clientes", icon: "leads" },
  { key: "claims", label: "Siniestros", icon: "claims" },
  { key: "summary", label: "Resumen", icon: "summary" },
  { key: "unfollowed", label: "Sin seguimiento", icon: "unfollowed" },
];

function CountBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      position: "absolute",
      top: -2,
      right: -8,
      minWidth: 16,
      height: 16,
      paddingInline: 3,
      borderRadius: "var(--radius-pill)",
      background: "var(--color-primary-500)",
      color: "var(--text-on-brand)",
      font: "var(--text-micro)",
      fontWeight: 700,
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>{count > 9 ? "9+" : count}</span>
  );
}

export function MainNav({ active = "tasks", onNavigate, mode = "auto", counts = {} }) {
  const isDesktop = mode === "desktop";
  const isMobile = mode === "mobile";

  const bottomNav = (
    <nav style={{
      display: isDesktop ? "none" : "flex",
      height: "var(--bottom-nav-height)",
      paddingBottom: "var(--safe-bottom)",
      background: "var(--surface-card)",
      borderTop: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-nav)",
    }}>
      {items.map(it => {
        const isActive = it.key === active;
        return (
          <button key={it.key} onClick={() => onNavigate && onNavigate(it.key)} style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            minHeight: "var(--tap-target-min)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon name={it.icon} active={isActive} />
              <CountBadge count={counts[it.key]} />
            </span>
            <span style={{
              font: "var(--text-micro)",
              textTransform: "none",
              letterSpacing: 0,
              color: isActive ? "var(--color-primary-600)" : "var(--text-tertiary)",
              fontWeight: isActive ? 600 : 500,
              textAlign: "center",
              lineHeight: 1.15,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingInline: 2,
            }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const sideNav = (
    <nav style={{
      display: isMobile ? "none" : "flex",
      flexDirection: "column",
      width: "var(--side-nav-width)",
      height: "100%",
      paddingTop: "calc(var(--space-5) + var(--safe-top))",
      paddingInline: "var(--space-3)",
      gap: 2,
      background: "var(--surface-card)",
      borderRight: "1px solid var(--border-default)",
      boxSizing: "border-box",
    }}>
      {items.map(it => {
        const isActive = it.key === active;
        return (
          <button key={it.key} onClick={() => onNavigate && onNavigate(it.key)} style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            height: 38,
            paddingInline: "var(--space-3)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: "pointer",
            background: isActive ? "var(--color-primary-50)" : "transparent",
            textAlign: "left",
          }}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon name={it.icon} active={isActive} />
              <CountBadge count={counts[it.key]} />
            </span>
            <span style={{
              font: "var(--text-label)",
              color: isActive ? "var(--color-primary-700)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 500,
            }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );

  if (mode === "desktop") return sideNav;
  if (mode === "mobile") return bottomNav;

  return (
    <React.Fragment>
      <div style={{ display: "contents" }}>{sideNav}</div>
      <div style={{ display: "contents" }}>{bottomNav}</div>
    </React.Fragment>
  );
}
