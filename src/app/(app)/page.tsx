"use client";

import { useMutation, useQuery } from "convex/react";
import { ReminderItem } from "@/components/reminder-item";
import { api } from "../../../convex/_generated/api";

// Route por defecto ("/") — P1 según ARC-8. Lista de recordatorios pendientes
// de quien está conectado, con lápiz (editar) y papelera (eliminar), mismo
// patrón que P3 (ARC-70). Sin filtrar por fecha (vencidos, de hoy y futuros):
// el corte por "hoy" y la pestaña "Próximas" son ARC-62/63, fuera de este
// alcance. El resto de P1 (insignias, layout desde el filtro de cliente...)
// sigue pendiente: ARC-17, ARC-35, ARC-58, ARC-64, ARC-65.
export default function Page() {
  const reminders = useQuery(api.reminders.listPendingByAssignee);
  const currentUser = useQuery(api.users.current);
  const removeReminder = useMutation(api.reminders.remove);

  return (
    <div className="flex min-h-full flex-1 flex-col p-6">
      <h1 className="text-text-primary mb-4 text-2xl font-semibold">
        Mis recordatorios pendientes
      </h1>

      <div className="max-w-lg">
        {reminders === undefined || !currentUser ? (
          <p className="text-text-tertiary text-sm">Cargando…</p>
        ) : reminders.length === 0 ? (
          <p className="text-text-secondary text-sm">
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
                assignedTo={currentUser.name}
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
