"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type ReactNode, use, useState } from "react";
import { BadgeMenu } from "@/components/badge-menu";
import { ClosedSaleDialog } from "@/components/closed-sale-dialog";
import { ContactHistoryItem } from "@/components/contact-history-item";
import { ReminderItem } from "@/components/reminder-item";
import {
  agentDisplay,
  EMPTY,
  formatAddress,
  formatBirthDate,
  optionLabel,
  textOrEmpty,
} from "@/lib/client-display";
import {
  DEFAULT_PRIORITY,
  LANGUAGE_OPTIONS,
  PRIORITY_OPTIONS,
  priorityBadgeClass,
  SEX_OPTIONS,
} from "@/lib/client-form";
import { contactAuthor } from "@/lib/contact-history";
import {
  SALE_STATUS_OPTIONS,
  saleStatusBadgeClass,
  shouldShowClosedPrompt,
} from "@/lib/sale-status";
import { useTodayMadrid } from "@/lib/use-today-madrid";
import { clientPageContext } from "@/lib/client-nav";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const CHANNEL_LABEL: Record<string, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  web: "Web",
  redes: "Redes sociales",
  presencial: "Presencial",
};

// /clientes/[id] — P3, ficha de cliente. Muestra los datos del alta (ARC-10/
// ARC-9), los datos ampliados (ARC-50: DNI, nacimiento, dirección, agente…;
// vacíos con guion, como teléfono y correo), la prioridad y el estado de venta
// con cambio rápido (ARC-33; F7/ARC-18) — al pasar a «Cerrado», aviso de venta
// cerrada (F8/ARC-19) —, el historial de interacciones (F4/ARC-14: la más
// reciente primero, con «Anotar interacción» en su cabecera) y los recordatorios
// pendientes (F5: ARC-60, alta con asignación; ARC-61, editar y eliminar;
// ARC-16, marcar como hecho y vencidos destacados, por fecha). El resto de
// funciones de la ficha (F3, F10 — siniestros, pólizas...) siguen pendientes:
// ARC-12, ARC-21, ARC-52, ARC-56.
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
  const contacts = useQuery(api.contacts.listByClient, { clientId });
  const removeReminder = useMutation(api.reminders.remove);
  const completeReminder = useMutation(api.reminders.complete);
  const today = useTodayMadrid();
  const setPriority = useMutation(api.clients.setPriority);
  const setSaleStatus = useMutation(api.clients.setSaleStatus);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [closedPromptOpen, setClosedPromptOpen] = useState(false);
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
      {/* La cabecera se parte en dos líneas si no cabe: el nombre conserva un
          ancho mínimo y los badges bajan a la línea siguiente (ARC-33). */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-[1_1_12rem]">
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
        {/* Prioridad, estado y «Editar»: se parten en líneas si no caben (a
            343 px, «Presupuesto enviado» no cabe con los otros dos). */}
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {/* Prioridad con cambio rápido (ARC-33). */}
          <BadgeMenu
            name="Prioridad"
            // Salvaguarda ante un documento escrito a mano sin prioridad (como
            // `clientToForm` en P4); el esquema la declara obligatoria.
            value={client.priority ?? DEFAULT_PRIORITY}
            options={PRIORITY_OPTIONS}
            badgeClass={priorityBadgeClass}
            onChange={(priority) => setPriority({ id: clientId, priority })}
            onError={setBadgeError}
            saveErrorMessage="No se ha podido cambiar la prioridad. Inténtalo de nuevo."
          />
          {/* Estado de venta con cambio rápido (F7/ARC-18), con el color de
              cada estado (ARC-77). Cualquier estado a cualquier otro. */}
          <BadgeMenu
            name="Estado de venta"
            value={client.saleStatus}
            options={SALE_STATUS_OPTIONS}
            badgeClass={saleStatusBadgeClass}
            onChange={async (saleStatus) => {
              const result = await setSaleStatus({ id: clientId, saleStatus });
              // Aviso de venta cerrada (ARC-19): lo decide el resultado del
              // servidor, nunca el valor que la ficha tenía en pantalla.
              if (shouldShowClosedPrompt(result)) setClosedPromptOpen(true);
            }}
            onError={setBadgeError}
            saveErrorMessage="No se ha podido cambiar el estado de venta. Inténtalo de nuevo."
          />
          {/* P4 Editar (ARC-11): único punto de entrada a la edición. */}
          <Link
            href={`/clientes/${clientId}/editar`}
            className="text-text-link text-sm font-medium"
          >
            Editar
          </Link>
        </div>
      </div>
      {/* Errores de los dos badges. Siempre presente (vacía si no hay error)
          para que el aviso se anuncie. */}
      <div role="alert" className="text-warning-fg mb-4 text-sm empty:hidden">
        {badgeError}
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

  // Historial de interacciones (ARC-14). Decisiones de Miriam (24/11/2026):
  // va tras los datos del cliente; «Anotar interacción» vive en su cabecera; el
  // autor es quien la realizó (y «anotada por» si la registró otra persona);
  // solo la fecha. Lista completa, sin scroll interno: la página crece.
  const historyCard = (
    <section
      aria-labelledby="historial-titulo"
      className="border-border-default bg-surface-card max-w-lg rounded-lg border p-6 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="historial-titulo" className="text-text-primary text-lg font-semibold">
          Historial de interacciones
        </h2>
        <Link
          href={`/interacciones/nueva?clientId=${clientId}&from=${clientId}`}
          className="border-border-default text-text-primary flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Anotar interacción
        </Link>
      </div>

      {contacts === undefined ? (
        <p className="text-text-tertiary text-sm">Cargando…</p>
      ) : contacts.length === 0 ? (
        <p className="text-text-secondary text-sm">
          Todavía no hay interacciones con este cliente.
        </p>
      ) : (
        <ul className="divide-border-default flex flex-col divide-y">
          {contacts.map((contact) => (
            <ContactHistoryItem
              key={contact._id}
              type={contact.type}
              date={contact.date}
              note={contact.note}
              author={contactAuthor(contact.performedById, contact.createdById, users)}
            />
          ))}
        </ul>
      )}
    </section>
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
              overdue={reminder.date < today}
              editHref={`/clientes/${clientId}/recordatorios/${reminder._id}/editar`}
              onComplete={() => completeReminder({ id: reminder._id })}
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
          <div className="mt-4">{historyCard}</div>
        </>
      ) : (
        <>
          {clientCard}
          <div className="mt-4">{historyCard}</div>
          <div className="mt-4">{remindersCard}</div>
        </>
      )}

      <ClosedSaleDialog
        open={closedPromptOpen}
        annotateHref={`/interacciones/nueva?clientId=${clientId}&from=${clientId}&motivo=venta-cerrada`}
        onClose={() => setClosedPromptOpen(false)}
      />
    </div>
  );
}
