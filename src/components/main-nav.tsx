"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";

// Shell de navegación principal (ARC-8). Iconos y estructura portados 1:1
// desde el design system real: DOCUMENTOS/Libreria-Componentes-Oficina-de-
// Valencia/components/navigation/MainNav.jsx (set de iconos inline, sin
// dependencia externa). Ese componente define 6 entradas (incluye Resumen/
// Sin seguimiento para F12/F13); aquí solo se usan las 4 del MVP — añadir
// las otras 2 cuando esas pantallas existan de verdad es solo ampliar
// NAV_ITEMS.
const NAV_ITEMS = [
  { href: "/", label: "Mis tareas de hoy", icon: "tasks" },
  { href: "/clientes", label: "Clientes", icon: "clients" },
  { href: "/posibles-clientes", label: "Posibles clientes", icon: "leads" },
  { href: "/siniestros", label: "Siniestros", icon: "claims" },
] as const;

type IconName = (typeof NAV_ITEMS)[number]["icon"];

function NavIcon({ name, active }: { name: IconName; active: boolean }) {
  const stroke = active ? "var(--color-primary-600)" : "var(--color-neutral-500)";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "tasks") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 12l2.5 2.5L16 9" />
      </svg>
    );
  }
  if (name === "clients") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
        <circle cx="17" cy="8.5" r="2.3" />
        <path d="M15.5 14.3c2.5.3 4.5 2.6 4.5 5.7" />
      </svg>
    );
  }
  if (name === "leads") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
        <path d="M18 4v6M15 7h6" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M12 8v4M12 15h.01" />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.current);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(var(--bottom-nav-height)+var(--safe-bottom))] items-stretch border-t border-border-default bg-surface-card pb-[var(--safe-bottom)] shadow-nav md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-[var(--side-nav-width)] md:flex-col md:items-stretch md:border-t-0 md:border-r md:pb-0"
      aria-label="Navegación principal"
    >
      <div className="hidden shrink-0 flex-col gap-1 px-5 pt-6 pb-4 md:flex">
        <span className="text-lg font-bold text-text-primary">
          Arco Seguros
        </span>
        <span className="text-sm text-text-tertiary">CRM</span>
      </div>

      <ul className="flex flex-1 items-stretch md:flex-col md:items-stretch md:gap-0.5 md:px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`press-feedback flex min-h-[var(--tap-target-min)] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-center text-xs md:h-[38px] md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm ${
                  active
                    ? "font-semibold text-primary-600 md:bg-primary-50 md:text-primary-700"
                    : "font-medium text-text-tertiary md:text-text-secondary"
                }`}
              >
                <NavIcon name={item.icon} active={active} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden shrink-0 flex-col gap-2 border-t border-border-default px-5 py-4 md:flex">
        <span className="truncate text-sm font-medium text-text-primary">
          {user === undefined ? "Cargando…" : (user?.name ?? "")}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="press-feedback self-start text-sm text-text-link"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
