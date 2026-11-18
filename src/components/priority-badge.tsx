"use client";

import { ConvexError } from "convex/values";
import { useEffect, useId, useRef, useState } from "react";
import { KNOWN_SERVER_ERRORS, PRIORITY_OPTIONS } from "@/lib/client-form";
import {
  createSaveGuard,
  nextIndex,
  priorityAriaLabel,
  priorityBadgeClass,
} from "@/lib/priority-menu";
import type { Priority } from "@/types";

const SAVE_ERROR = "No se ha podido cambiar la prioridad. Inténtalo de nuevo.";

function errorMessage(err: unknown): string {
  const data = err instanceof ConvexError ? err.data : undefined;
  return typeof data === "string" && KNOWN_SERVER_ERRORS.has(data) ? data : SAVE_ERROR;
}

// Badge de prioridad de la ficha P3 con cambio rápido (ARC-33). Implementación
// propia: toma como referencia visual y de comportamiento `StatusBadge`
// (dominio priority) y `Popover` del sistema de diseño, que no existen como
// componentes de la app.
//
// Patrón WAI-ARIA «menu button»: al abrir, el foco va a la opción actual;
// ↓/↑ circulares, Inicio/Fin, Enter/Espacio eligen, Escape cierra y devuelve el
// foco al badge, Tab cierra. Pulsar fuera cierra sin cambiar nada.
//
// Mientras se guarda: el menú no se abre ni las opciones responden, y
// `onChange` no se vuelve a llamar hasta que termina la promesa anterior
// (`createSaveGuard`, estable durante todo el montaje). `aria-disabled` solo lo
// anuncia; no se usa `disabled` para no perder el foco.
//
// El error no se pinta aquí: se entrega a `onError` para que la página lo
// muestre en su región `role="alert"` bajo la cabecera (null = sin error).
export function PriorityBadge({
  priority,
  onChange,
  onError,
}: {
  priority: Priority;
  onChange: (priority: Priority) => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  // Un único guard por montaje: si se recreara en cada render perdería la
  // exclusión mutua.
  const [guard] = useState(createSaveGuard);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Foco en la opción activa mientras el menú está abierto.
  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  // Pulsar fuera cierra el menú sin cambiar nada.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openMenu() {
    if (guard.isBusy()) return;
    onError(null);
    setFocusIndex(
      Math.max(
        0,
        PRIORITY_OPTIONS.findIndex((o) => o.value === priority),
      ),
    );
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(next: Priority) {
    if (guard.isBusy()) return;
    closeMenu();
    if (next === priority) return;
    const run = guard.run(() => onChange(next));
    if (run === false) return;
    setSaving(true);
    run
      .catch((err: unknown) => onError(errorMessage(err)))
      .finally(() => setSaving(false));
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={priorityAriaLabel(priority, saving)}
        aria-disabled={saving || undefined}
        aria-busy={saving || undefined}
        onClick={() => {
          if (guard.isBusy()) return;
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openMenu();
          }
        }}
        className="focus-visible:outline-border-focus inline-flex min-h-[var(--tap-target-min)] min-w-[var(--tap-target-min)] items-center justify-center rounded-md focus-visible:outline-2 aria-disabled:cursor-progress aria-disabled:opacity-60"
      >
        <span
          className={`rounded-pill inline-flex items-center gap-1 px-3 py-1 text-xs font-medium whitespace-nowrap ${priorityBadgeClass(priority)}`}
        >
          {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority}
          <span aria-hidden="true">▾</span>
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Prioridad"
          className="border-border-default bg-surface-card absolute top-full left-0 z-50 mt-1 flex min-w-40 flex-col rounded-md border p-2 shadow-md"
        >
          {PRIORITY_OPTIONS.map((option, i) => {
            const checked = option.value === priority;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => choose(option.value)}
                onKeyDown={(e) => {
                  const next = nextIndex(i, e.key, PRIORITY_OPTIONS.length);
                  if (next !== null) {
                    e.preventDefault();
                    setFocusIndex(next);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(option.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeMenu();
                  } else if (e.key === "Tab") {
                    setOpen(false);
                  }
                }}
                className="text-text-primary hover:bg-surface-sunken focus:bg-surface-sunken flex min-h-[var(--tap-target-min)] w-full items-center gap-2 rounded-sm px-3 text-left text-sm focus:outline-none"
              >
                <span aria-hidden="true" className="w-4 text-center">
                  {checked ? "✓" : ""}
                </span>
                <span
                  className={`rounded-pill px-3 py-1 text-xs font-medium ${priorityBadgeClass(option.value)}`}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
