"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "../../../../../convex/_generated/api";

const CHANNELS = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "web", label: "Web" },
  { value: "redes", label: "Redes sociales" },
  { value: "presencial", label: "Presencial" },
] as const;

// /clientes/nuevo — P4, alta de cliente nuevo (ARC-10/F1).
export default function Page() {
  const router = useRouter();
  const createClient = useMutation(api.clients.create);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] =
    useState<(typeof CHANNELS)[number]["value"]>("llamada");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!name.trim()) {
      setError("El nombre completo es obligatorio.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Introduce al menos un teléfono o un correo electrónico.");
      return;
    }

    setIsSaving(true);
    try {
      const id = await createClient({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        channel,
      });
      router.push(`/clientes/${id}`);
    } catch {
      setError("No se ha podido guardar el cliente. Inténtalo de nuevo.");
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">
          Nuevo cliente
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Nombre completo
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre y apellidos"
              disabled={isSaving}
              className="h-12 w-full rounded-md border border-border-default px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Teléfono
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="600 000 000"
              disabled={isSaving}
              className="h-12 w-full rounded-md border border-border-default px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Correo electrónico
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="cliente@correo.es"
              disabled={isSaving}
              className="h-12 w-full rounded-md border border-border-default px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Canal de entrada
            </span>
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as (typeof CHANNELS)[number]["value"])
              }
              disabled={isSaving}
              className="h-12 w-full rounded-md border border-border-default bg-surface-card px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
            >
              {CHANNELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg px-4 py-3">
              <span className="text-warning-fg">⚠</span>
              <span className="text-sm text-warning-fg">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/clientes")}
              disabled={isSaving}
              className="flex h-12 items-center justify-center rounded-md border border-border-default px-5 font-medium text-text-primary disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex h-12 items-center justify-center rounded-md bg-primary-500 px-5 font-medium text-on-brand disabled:opacity-60"
            >
              {isSaving ? "Guardando…" : "Guardar cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
