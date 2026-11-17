"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type ReactNode, use } from "react";
import { ReminderItem } from "@/components/reminder-item";
import {
  agentDisplay,
  EMPTY,
  formatAddress,
  formatBirthDate,
  optionLabel,
  textOrEmpty,
} from "@/lib/client-display";
import { LANGUAGE_OPTIONS, SEX_OPTIONS } from "@/lib/client-form";
import { clientPageContext } from "@/lib/client-nav";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const SALE_STATUS_LABEL: Record<string, string> = {
  interesado: "Interesado",
  presupuesto: "Presupuesto enviado",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

const CHANNEL_LABEL: Record<string, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  web: "Web",
  redes: "Redes sociales",
  presencial: "Presencial",
};

// /clientes/[id] — P3, ficha de cliente. Muestra los datos del alta (ARC-10/
// ARC-9), los datos ampliados (ARC-50: DNI, nacimiento, dirección, agente…;
// vacíos con guion, como teléfono y correo) y una lista mínima de recordatorios pendientes
// (ARC-60, alta con asignación; ARC-61, editar y eliminar). La sección
// completa de F5 (vencidos destacados, marcar como hecho) es ARC-16; el resto
// de funciones de la ficha (F3, F4, F7, F8, F10 — historial, siniestros,
// pólizas...) siguen pendientes: ARC-12, ARC-14, ARC-18, ARC-19, ARC-21,
// ARC-33, ARC-52, ARC-56.
//
// `?from=` dice desde dónde se abrió (regla de navegación ARC-8: «volver» lleva
// al origen) y, desde P1 con un cliente elegido en el filtro, `?vista=recordatorios`
// pone Recordatorios arriba y los datos del cliente debajo (ARC-64). Ver
// `clientPageContext`.
export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[]; vista?: string | string[] }>;
}) {
  const { id } = use(params);
  const { from, vista } = use(searchParams);
  const { backHref, backLabel, focusReminders } = clientPageContext(from, vista);
  const clientId = id as Id<"clients">;
  const client = useQuery(api.clients.get, { id: clientId });
  const pendingReminders = useQuery(api.reminders.listPendingByClient, {
    clientId,
  });
  const removeReminder = useMutation(api.reminders.remove);
  const users = useQuery(api.users.list);
  const userNameById = new Map((users ?? []).map((u) => [u._id, u.name]));

  if (client === undefined) {
    return (
      <div className="flex min-h-full flex-1 flex-col p-6">
        <p className="text-text-tertiary text-sm">Cargando…</p>
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-3 p-6">
        <p className="text-text-secondary text-sm">No se encontró este cliente.</p>
        <Link href="/clientes" className="text-text-link text-sm">
          Volver a la lista de clientes
        </Link>
      </div>
    );
  }

  const agent = agentDisplay(client.assignedAgentId, users);
  const addressLines = formatAddress(client.address);
  // Pares <dt>/<dd> de «Datos del cliente», en el orden de la ficha (ARC-50).
  const rows: { label: string; value: ReactNode }[] = [
    { label: "Teléfono", value: textOrEmpty(client.phone) },
    { label: "Segundo teléfono", value: textOrEmpty(client.secondPhone) },
    { label: "WhatsApp", value: textOrEmpty(client.whatsapp) },
    { label: "Correo electrónico", value: textOrEmpty(client.email) },
    { label: "DNI/NIE", value: textOrEmpty(client.dni) },
    { label: "Fecha de nacimiento", value: formatBirthDate(client.birthDate) },
    { label: "Sexo", value: optionLabel(SEX_OPTIONS, client.sex) },
    { label: "Idioma", value: optionLabel(LANGUAGE_OPTIONS, client.language) },
    {
      label: "Dirección",
      value:
        addressLines.length === 0
          ? EMPTY
          : addressLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            )),
    },
    { label: "Referido por", value: textOrEmpty(client.referredBy) },
    { label: "Canal de entrada", value: CHANNEL_LABEL[client.channel] },
    { label: "Fecha de alta", value: new Date(client.createdAt).toLocaleString("es-ES") },
  ];

  const clientCard = (
    <div className="border-border-default bg-surface-card max-w-lg rounded-lg border p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-text-primary text-2xl font-semibold [overflow-wrap:anywhere]">
            {client.name}
          </h1>
          {/* Agente asignado, destacado bajo el nombre (ARC-50): quién lleva al cliente. */}
          <p className="mt-1 text-sm">
            {agent.kind === "none" ? (
              <span className="text-text-tertiary">Sin agente asignado</span>
            ) : (
              <>
                <span className="text-text-secondary">Agente: </span>
                {agent.kind === "known" ? (
                  <span className="text-text-primary font-medium">{agent.name}</span>
                ) : agent.kind === "loading" ? (
                  <span className="text-text-tertiary">…</span>
                ) : (
                  <span className="text-text-tertiary">usuario no disponible</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-pill bg-sale-interesado-bg text-sale-interesado-fg px-3 py-1 text-xs font-medium">
            {SALE_STATUS_LABEL[client.saleStatus]}
          </span>
          {/* P4 Editar (ARC-11): único punto de entrada a la edición. */}
          <Link
            href={`/clientes/${clientId}/editar`}
            className="text-text-link text-sm font-medium"
          >
            Editar
          </Link>
        </div>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-text-tertiary shrink-0">{row.label}</dt>
            <dd className="text-text-primary min-w-0 text-right [overflow-wrap:anywhere]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const interactionButton = (
    <div className="mt-4 flex max-w-lg justify-end">
      <Link
        href={`/interacciones/nueva?clientId=${clientId}&from=${clientId}`}
        className="border-border-default text-text-primary flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
      >
        Anotar interacción
      </Link>
    </div>
  );

  const remindersCard = (
    <div className="border-border-default bg-surface-card max-w-lg rounded-lg border p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-text-primary text-lg font-semibold">
          Recordatorios pendientes
        </h2>
        <Link
          href={`/clientes/${clientId}/recordatorios/nuevo`}
          className="bg-primary-500 text-on-brand flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium"
        >
          Nuevo recordatorio
        </Link>
      </div>

      {pendingReminders === undefined ? (
        <p className="text-text-tertiary text-sm">Cargando…</p>
      ) : pendingReminders.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No hay recordatorios pendientes para este cliente.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {pendingReminders.map((reminder) => (
            <ReminderItem
              key={reminder._id}
              date={reminder.date}
              note={reminder.note}
              assignedTo={userNameById.get(reminder.assignedToId) ?? "—"}
              editHref={`/clientes/${clientId}/recordatorios/${reminder._id}/editar`}
              onDelete={() => removeReminder({ id: reminder._id })}
            />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col p-6">
      <Link href={backHref} className="text-text-link mb-4 text-sm">
        {backLabel}
      </Link>

      {focusReminders ? (
        <>
          {/* Con los recordatorios arriba, el nombre del cliente (que vive en la
              tarjeta de datos) se repite encima para saber de quién son. */}
          <p className="text-text-secondary mb-2 max-w-lg text-sm">{client.name}</p>
          {remindersCard}
          <div className="mt-4">{clientCard}</div>
          {interactionButton}
        </>
      ) : (
        <>
          {clientCard}
          {interactionButton}
          <div className="mt-4">{remindersCard}</div>
        </>
      )}
    </div>
  );
}
