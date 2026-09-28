"use client";

import { useMutation, useQuery } from "convex/react";
import { ReminderItem } from "@/components/reminder-item";
import { api } from "../../../convex/_generated/api";

// Route por defecto ("/") — P1 según ARC-8. Por ahora solo la lista mínima de
// recordatorios pendientes de quien está conectado, con editar y eliminar
// (ARC-61). El resto de P1 (vencidos, marcar como hecho, filtros, pestañas)
// sigue pendiente: ARC-17, ARC-35, ARC-58, ARC-62, ARC-63, ARC-65.
export default function Page() {
  const reminders = useQuery(api.reminders.listPendingByAssignee);
  const removeReminder = useMutation(api.reminders.remove);

  return (
    <div className="flex min-h-full flex-1 flex-col p-6">
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">
        Mis recordatorios pendientes
      </h1>

      <div className="max-w-lg">
        {reminders === undefined ? (
          <p className="text-sm text-text-tertiary">Cargando…</p>
        ) : reminders.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No tienes recordatorios pendientes.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {reminders.map((reminder) => (
              <ReminderItem
                key={reminder._id}
                clientName={reminder.clientName}
                date={reminder.date}
                note={reminder.note}
                editHref={`/clientes/${reminder.clientId}/recordatorios/${reminder._id}/editar?from=p1`}
                onDelete={() => removeReminder({ id: reminder._id })}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
