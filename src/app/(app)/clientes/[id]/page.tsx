"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { use } from "react";
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

// Origen desde el que se abrió P3 (regla de navegación ARC-8: "volver" debe
// llevar al origen correcto). Solo P2 enlaza aquí hoy; P1 y P6 siguen siendo
// placeholders y añadirán su propio ?from= cuando se construyan de verdad.
const BACK_DESTINATION_BY_ORIGIN: Record<string, string> = {
  p2: "/clientes",
};
const DEFAULT_BACK_DESTINATION = "/clientes";
const DEFAULT_BACK_LABEL = "← Clientes";

// /clientes/[id] — P3, ficha de cliente. Muestra por ahora los datos básicos
// del alta (ARC-10/ARC-9); el resto de funciones de la ficha (F3, F4, F7,
// F8, F10 — historial, recordatorios, siniestros, pólizas...) siguen
// pendientes: ARC-12, ARC-14, ARC-16, ARC-18, ARC-19, ARC-21, ARC-33,
// ARC-50, ARC-52, ARC-56.
export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = use(params);
  const { from } = use(searchParams);
  const backHref =
    (from && BACK_DESTINATION_BY_ORIGIN[from]) || DEFAULT_BACK_DESTINATION;
  const client = useQuery(api.clients.get, { id: id as Id<"clients"> });

  if (client === undefined) {
    return (
      <div className="flex min-h-full flex-1 flex-col p-6">
        <p className="text-sm text-text-tertiary">Cargando…</p>
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-3 p-6">
        <p className="text-sm text-text-secondary">
          No se encontró este cliente.
        </p>
        <Link href="/clientes" className="text-sm text-text-link">
          Volver a la lista de clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col p-6">
      <Link href={backHref} className="mb-4 text-sm text-text-link">
        {DEFAULT_BACK_LABEL}
      </Link>

      <div className="max-w-lg rounded-lg border border-border-default bg-surface-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">
            {client.name}
          </h1>
          <span className="rounded-pill bg-sale-interesado-bg px-3 py-1 text-xs font-medium text-sale-interesado-fg">
            {SALE_STATUS_LABEL[client.saleStatus]}
          </span>
        </div>

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Teléfono</dt>
            <dd className="text-text-primary">{client.phone || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Correo electrónico</dt>
            <dd className="text-text-primary">{client.email || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Canal de entrada</dt>
            <dd className="text-text-primary">
              {CHANNEL_LABEL[client.channel]}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-tertiary">Fecha de alta</dt>
            <dd className="text-text-primary">
              {new Date(client.createdAt).toLocaleString("es-ES")}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
