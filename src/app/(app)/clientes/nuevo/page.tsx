"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "../../../../../convex/_generated/api";

const KNOWN_SERVER_ERRORS = new Set([
  "El nombre completo es obligatorio",
  "Introduce al menos un teléfono o un correo electrónico",
  "El teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  "El correo electrónico no tiene un formato válido.",
]);

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
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("llamada");
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
    } catch (err) {
      const data = err instanceof ConvexError ? err.data : undefined;
      setError(
        typeof data === "string" && KNOWN_SERVER_ERRORS.has(data)
          ? data
          : "No se ha podido guardar el cliente. Inténtalo de nuevo.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">Nuevo cliente</h1>

        <form
          onSubmit={handleSubmit}
          className="border-border-default bg-surface-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary text-sm font-medium">
              Nombre completo
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre y apellidos"
              disabled={isSaving}
              className="border-border-default text-text-primary focus:border-primary-500 disabled:text-text-tertiary h-12 w-full rounded-md border px-3 outline-none disabled:bg-neutral-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-text-secondary text-sm font-medium">Teléfono</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="600 000 000"
              disabled={isSaving}
              className="border-border-default text-text-primary focus:border-primary-500 disabled:text-text-tertiary h-12 w-full rounded-md border px-3 outline-none disabled:bg-neutral-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-text-secondary text-sm font-medium">
              Correo electrónico
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="cliente@correo.es"
              disabled={isSaving}
              className="border-border-default text-text-primary focus:border-primary-500 disabled:text-text-tertiary h-12 w-full rounded-md border px-3 outline-none disabled:bg-neutral-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-text-secondary text-sm font-medium">
              Canal de entrada
            </span>
            <select
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as (typeof CHANNELS)[number]["value"])
              }
              disabled={isSaving}
              className="border-border-default bg-surface-card text-text-primary focus:border-primary-500 disabled:text-text-tertiary h-12 w-full rounded-md border px-3 outline-none disabled:bg-neutral-100"
            >
              {CHANNELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div className="border-warning-border bg-warning-bg flex items-start gap-2 rounded-md border px-4 py-3">
              <span className="text-warning-fg">⚠</span>
              <span className="text-warning-fg text-sm">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/clientes")}
              disabled={isSaving}
              className="border-border-default text-text-primary flex h-12 items-center justify-center rounded-md border px-5 font-medium disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-primary-500 text-on-brand flex h-12 items-center justify-center rounded-md px-5 font-medium disabled:opacity-60"
            >
              {isSaving ? "Guardando…" : "Guardar cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
