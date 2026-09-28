"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";

const SALE_STATUS_LABEL: Record<string, string> = {
  interesado: "Interesado",
  presupuesto: "Presupuesto enviado",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

const SALE_STATUS_CLASS: Record<string, string> = {
  interesado: "bg-sale-interesado-bg text-sale-interesado-fg",
  presupuesto: "bg-sale-presupuesto-bg text-sale-presupuesto-fg",
  cerrado: "bg-sale-cerrado-bg text-sale-cerrado-fg",
  perdido: "bg-sale-perdido-bg text-sale-perdido-fg",
};

// /clientes — P2, lista de clientes con buscador (ARC-9/F2).
export default function Page() {
  const [search, setSearch] = useState("");
  const clients = useQuery(api.clients.list, { search });

  return (
    <div className="flex min-h-full flex-1 flex-col p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-text-primary text-2xl font-semibold">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="bg-primary-500 text-on-brand flex h-11 items-center justify-center rounded-md px-5 font-medium"
        >
          Nuevo cliente
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nombre, teléfono o correo…"
        className="border-border-default text-text-primary focus:border-primary-500 mb-4 h-12 w-full max-w-md rounded-md border px-3 outline-none"
      />

      {clients === undefined && <p className="text-text-tertiary text-sm">Cargando…</p>}

      {clients !== undefined && clients.length === 0 && search.trim() && (
        <p className="text-text-secondary text-sm">
          No se encontró ningún cliente con ese criterio.
        </p>
      )}

      {clients !== undefined && clients.length === 0 && !search.trim() && (
        <div className="border-border-default bg-surface-card flex flex-col items-start gap-3 rounded-lg border p-6">
          <p className="text-text-secondary text-sm">
            Todavía no hay ningún cliente registrado.
          </p>
          <Link
            href="/clientes/nuevo"
            className="bg-primary-500 text-on-brand flex h-11 items-center justify-center rounded-md px-5 font-medium"
          >
            Crear el primer cliente
          </Link>
        </div>
      )}

      {clients !== undefined && clients.length > 0 && (
        <ul className="divide-border-default border-border-default bg-surface-card flex flex-col divide-y rounded-lg border">
          {clients.map((client) => (
            <li key={client._id}>
              <Link
                href={`/clientes/${client._id}?from=p2`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-text-primary font-medium">{client.name}</span>
                <span
                  className={`rounded-pill px-3 py-1 text-xs font-medium ${SALE_STATUS_CLASS[client.saleStatus]}`}
                >
                  {SALE_STATUS_LABEL[client.saleStatus]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
