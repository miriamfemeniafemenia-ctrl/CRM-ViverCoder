"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ReminderItem } from "@/components/reminder-item";
import { formatLongDate, groupByDate, splitRemindersByToday } from "@/lib/reminders";
import { useTodayMadrid } from "@/lib/use-today-madrid";
import { api } from "../../../convex/_generated/api";

type Tab = "hoy" | "proximas";

const TABS: { id: Tab; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "proximas", label: "Próximas" },
];

// Route por defecto ("/") — P1 según ARC-8. Lista de recordatorios pendientes
// de quien está conectado, con lápiz (editar) y papelera (eliminar), mismo
// patrón que P3 (ARC-70). Dos vistas (ARC-62): «Hoy» (vencidos y de hoy) y
// «Próximas» (futuros agrupados por fecha); la pestaña elegida vive solo en
// memoria, al volver de editar se abre «Hoy». El resto de P1 (filtro de
// vencimiento, insignias, layout desde el filtro de cliente...) sigue
// pendiente: ARC-17, ARC-35, ARC-58, ARC-63, ARC-64, ARC-65.
export default function Page() {
  const reminders = useQuery(api.reminders.listPendingByAssignee);
  const currentUser = useQuery(api.users.current);
  const removeReminder = useMutation(api.reminders.remove);
  const today = useTodayMadrid();
  const [tab, setTab] = useState<Tab>("hoy");

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

  const { dueOrToday, upcoming } = splitRemindersByToday(reminders ?? [], today);

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

        {reminders === undefined || !currentUser ? (
          <p className="text-text-tertiary text-sm">Cargando…</p>
        ) : tab === "hoy" ? (
          dueOrToday.length === 0 ? (
            <p className="text-text-secondary text-sm">
              No tienes recordatorios para hoy ni vencidos.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">{dueOrToday.map(renderItem)}</ul>
          )
        ) : upcoming.length === 0 ? (
          <p className="text-text-secondary text-sm">No tienes recordatorios próximos.</p>
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
