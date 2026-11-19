"use client";

import { ConvexError } from "convex/values";
import { useEffect, useId, useRef, useState } from "react";
import { badgeAriaLabel, createSaveGuard, menuAlign, nextIndex } from "@/lib/badge-menu";
import { KNOWN_SERVER_ERRORS } from "@/lib/client-form";

function errorMessage(err: unknown, fallback: string): string {
  const data = err instanceof ConvexError ? err.data : undefined;
  return typeof data === "string" && KNOWN_SERVER_ERRORS.has(data) ? data : fallback;
}

// Badge con cambio rápido de la ficha P3: prioridad (ARC-33) y estado de venta
// (ARC-18). Implementación propia: toma como referencia visual y de
// comportamiento `StatusBadge` y `Popover` del sistema de diseño, que no
// existen como componentes de la app.
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
// muestre en su región `role="alert"` (null = sin error).
export function BadgeMenu<T extends string>({
  value,
  options,
  badgeClass,
  name,
  onChange,
  onError,
  saveErrorMessage,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  badgeClass: (value: T) => string;
  // Nombre del campo, para el texto accesible y el menú: «Prioridad».
  name: string;
  onChange: (value: T) => Promise<unknown>;
  onError: (message: string | null) => void;
  // Mensaje si el guardado falla por un error no previsto: «No se ha podido
  // cambiar la prioridad. Inténtalo de nuevo.».
  saveErrorMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [align, setAlign] = useState<"start" | "end">("start");
  // Un único guard por montaje: si se recreara en cada render perdería la
  // exclusión mutua.
  const [guard] = useState(createSaveGuard);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const label = options.find((o) => o.value === value)?.label ?? value;

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
    // En móvil, un badge pegado a la derecha abre el menú hacia la izquierda
    // para que no se salga de la pantalla.
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAlign(menuAlign(rect.left, document.documentElement.clientWidth));
    setFocusIndex(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(next: T) {
    if (guard.isBusy()) return;
    closeMenu();
    if (next === value) return;
    const run = guard.run(() => onChange(next));
    if (run === false) return;
    setSaving(true);
    run
      .catch((err: unknown) => onError(errorMessage(err, saveErrorMessage)))
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
        aria-label={badgeAriaLabel(name, label, saving)}
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
          className={`rounded-pill inline-flex items-center gap-1 px-3 py-1 text-xs font-medium whitespace-nowrap ${badgeClass(value)}`}
        >
          {label}
          <span aria-hidden="true">▾</span>
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={name}
          className={`border-border-default bg-surface-card absolute top-full z-50 mt-1 flex max-w-[13rem] min-w-40 flex-col rounded-md border p-2 shadow-md ${align === "end" ? "right-0" : "left-0"}`}
        >
          {options.map((option, i) => {
            const checked = option.value === value;
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
                  const next = nextIndex(i, e.key, options.length);
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
                  className={`rounded-pill px-3 py-1 text-xs font-medium whitespace-nowrap ${badgeClass(option.value)}`}
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
