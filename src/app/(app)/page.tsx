"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ReminderItem } from "@/components/reminder-item";
import {
  type DueFilter,
  clientFilterOptions,
  filterByClient,
  filterByDue,
  formatLongDate,
  groupByDate,
  resolveClientFilter,
  splitRemindersByToday,
} from "@/lib/reminders";
import { useTodayMadrid } from "@/lib/use-today-madrid";
import { api } from "../../../convex/_generated/api";

type Tab = "hoy" | "proximas";

const TABS: { id: Tab; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "proximas", label: "Próximas" },
];

const DUE_FILTERS: { id: DueFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "vencidas", label: "Vencidas" },
  { id: "hoy", label: "Para hoy" },
];

const selectClass =
  "border-border-default text-text-primary bg-surface-card focus:border-primary-500 h-10 w-full rounded-md border px-3 text-sm outline-none";

// Route por defecto ("/") — P1 según ARC-8. Lista de recordatorios pendientes
// de quien está conectado, con lápiz (editar) y papelera (eliminar), mismo
// patrón que P3 (ARC-70). Dos vistas (ARC-62): «Hoy» (vencidos y de hoy) y
// «Próximas» (futuros agrupados por fecha). Filtros (ARC-63): «Cliente» en las
// dos pestañas y «Fecha de vencimiento» solo en «Hoy». La pestaña y los
// filtros viven solo en memoria, al volver de editar se abre «Hoy» sin filtros.
// El resto de P1 (insignias, layout desde el filtro de cliente...) sigue
// pendiente: ARC-17, ARC-35, ARC-58, ARC-64, ARC-65.
export default function Page() {
  const reminders = useQuery(api.reminders.listPendingByAssignee);
  const currentUser = useQuery(api.users.current);
  const removeReminder = useMutation(api.reminders.remove);
  const today = useTodayMadrid();
  const [tab, setTab] = useState<Tab>("hoy");
  const [dueFilter, setDueFilter] = useState<DueFilter>("todas");
  const [clientFilter, setClientFilter] = useState<string | null>(null);

  // Sin memoizar: las opciones y el valor resuelto se recalculan en cada render
  // desde la lista actual. Si el cliente elegido se queda sin recordatorios, el
  // estado se resetea de verdad (no solo se oculta) para que no reaparezca.
  // Es el ajuste de estado durante el render que recomienda React (la regla
  // `react-hooks/set-state-in-effect` desaconseja hacerlo en un efecto); no hay
  // bucle porque tras el reset el estado y el valor resuelto coinciden (`null`),
  // y no se hace mientras la lista carga.
  const clientOptions = clientFilterOptions(reminders ?? []);
  const resolvedClient = resolveClientFilter(clientFilter, clientOptions);
  if (reminders !== undefined && resolvedClient !== clientFilter) {
    setClientFilter(null);
  }

  function renderItem(reminder: NonNullable<typeof reminders>[number]) {
    return (
      <ReminderItem
        key={reminder._id}
        clientName={reminder.clientName}
        date={reminder.date}
        note={reminder.note}
        assignedTo={currentUser?.name ?? "—"}
        editHref={`/clientes/${reminder.clientId}/recordatorios/${reminder._id}/editar?from=p1`}
        onDelete={() => removeReminder({ id: reminder._id })}
      />
    );
  }

  // Cliente → separación Hoy/Próximas (ARC-62) → solo «Hoy»: vencimiento.
  const { dueOrToday, upcoming } = splitRemindersByToday(
    filterByClient(reminders ?? [], resolvedClient),
    today,
  );
  const todayVisible = filterByDue(dueOrToday, dueFilter, today);
  const filtersActive =
    resolvedClient !== null || (tab === "hoy" && dueFilter !== "todas");

  return (
    <div className="flex min-h-full flex-1 flex-col p-6">
      <h1 className="text-text-primary mb-4 text-2xl font-semibold">
        Mis recordatorios pendientes
      </h1>

      <div className="max-w-lg">
        <div className="mb-4 flex gap-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`h-10 rounded-md px-4 text-sm font-medium ${
                tab === id
                  ? "bg-primary-500 text-on-brand"
                  : "border-border-default text-text-primary border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {reminders !== undefined && currentUser && reminders.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex min-w-40 flex-1 flex-col gap-1">
              <span className="text-text-secondary text-sm font-medium">Cliente</span>
              <select
                value={resolvedClient ?? ""}
                onChange={(event) => setClientFilter(event.target.value || null)}
                className={selectClass}
              >
                <option value="">Todos los clientes</option>
                {clientOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {tab === "hoy" && (
              <label className="flex min-w-40 flex-1 flex-col gap-1">
                <span className="text-text-secondary text-sm font-medium">
                  Fecha de vencimiento
                </span>
                <select
                  value={dueFilter}
                  onChange={(event) => setDueFilter(event.target.value as DueFilter)}
                  className={selectClass}
                >
                  {DUE_FILTERS.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {reminders === undefined || !currentUser ? (
          <p className="text-text-tertiary text-sm">Cargando…</p>
        ) : tab === "hoy" ? (
          todayVisible.length === 0 ? (
            <p className="text-text-secondary text-sm">
              {filtersActive
                ? "Ningún recordatorio coincide con los filtros."
                : "No tienes recordatorios para hoy ni vencidos."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">{todayVisible.map(renderItem)}</ul>
          )
        ) : upcoming.length === 0 ? (
          <p className="text-text-secondary text-sm">
            {filtersActive
              ? "Ningún recordatorio coincide con los filtros."
              : "No tienes recordatorios próximos."}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groupByDate(upcoming).map(({ date, items }) => (
              <section key={date} className="flex flex-col gap-3">
                <h2 className="text-text-primary text-sm font-semibold first-letter:uppercase">
                  {formatLongDate(date)}
                </h2>
                <ul className="flex flex-col gap-3 text-sm">{items.map(renderItem)}</ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
