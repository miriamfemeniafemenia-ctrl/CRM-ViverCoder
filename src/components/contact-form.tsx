"use client";

import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { NOTE_MAX_LENGTH, todayISODateMadrid } from "@/lib/reminders";
import type { ClientChannel, ContactChannel } from "@/types";

// Canal de la INTERACCIÓN (`contacts.type`). No confundir con el canal de
// captación del cliente nuevo (`clients.channel`, `CLIENT_CHANNELS`): son
// uniones distintas ("correo" solo existe aquí, "presencial" solo allí).
const CONTACT_TYPES: { value: ContactChannel; label: string }[] = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "correo", label: "Correo" },
  { value: "redes", label: "Redes sociales" },
  { value: "web", label: "Web" },
];

const CLIENT_CHANNELS: { value: ClientChannel; label: string }[] = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "web", label: "Web" },
  { value: "redes", label: "Redes sociales" },
  { value: "presencial", label: "Presencial" },
];

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 250;

export type PickedClient = { _id: Id<"clients">; name: string; phone?: string };

export type ContactFormValues = {
  target:
    | { clientId: Id<"clients"> }
    | {
        newClient: {
          name: string;
          phone?: string;
          email?: string;
          channel: ClientChannel;
        };
      };
  type: ContactChannel;
  date: string;
  note: string;
  performedById: Id<"users">;
};

// Errores de negocio: `ConvexError({ userMessage })` (contacts.create) o
// `ConvexError("texto")` (validaciones del alta de cliente, lib/clientInput.ts).
// Cualquier otro (red, "No autenticado"...) cae en el mensaje genérico.
function contactErrorMessage(err: unknown, fallback: string) {
  const data: unknown = err instanceof ConvexError ? err.data : undefined;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null && "userMessage" in data) {
    const { userMessage } = data;
    if (typeof userMessage === "string") return userMessage;
  }
  return fallback;
}

const fieldClass =
  "border-border-default text-text-primary focus:border-primary-500 disabled:text-text-tertiary h-12 w-full rounded-md border px-3 outline-none disabled:bg-neutral-100";

// Formulario de "Anotar interacción" (ARC-72). `initialClient` viene de
// `?clientId=` ya resuelto por el backend (clients.lookup).
export function ContactForm({
  initialClient,
  onSubmit,
  onCancel,
}: {
  initialClient?: PickedClient;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const currentUser = useQuery(api.users.current);
  const users = useQuery(api.users.list);

  const [client, setClient] = useState<PickedClient | null>(initialClient ?? null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newChannel, setNewChannel] = useState<ClientChannel>("llamada");

  const [type, setType] = useState<ContactChannel>("llamada");
  const [date, setDate] = useState(() => todayISODateMadrid());
  const [note, setNote] = useState("");
  // "" hasta que se elige otra persona: por defecto, quien tiene la sesión.
  const [performedByOverride, setPerformedByOverride] = useState<Id<"users"> | "">("");
  const candidatePerformedById = performedByOverride || currentUser?._id || "";
  const performedById =
    users && !users.some((u) => u._id === candidatePerformedById)
      ? ""
      : candidatePerformedById;

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Debounce del buscador. El efecto solo corre mientras se está buscando
  // (sin cliente elegido y sin alta inline); al salir de ese estado el cleanup
  // cancela el temporizador pendiente, y `searchTerm` pasa a "" (más abajo), así
  // que una respuesta o un término anterior no pueden volver a pintar sugerencias.
  const isSearching = client === null && !creatingClient;
  useEffect(() => {
    if (!isSearching) return;
    const timer = setTimeout(() => setDebouncedTerm(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, isSearching]);

  // Solo se consulta si el término ya está estabilizado (debounced == texto
  // actual) y es suficientemente largo; si no, "skip" y no hay sugerencias.
  const searchTerm =
    isSearching &&
    debouncedTerm === searchText.trim() &&
    debouncedTerm.length >= SEARCH_MIN_CHARS
      ? debouncedTerm
      : null;
  const suggestions = useQuery(
    api.clients.searchForPicker,
    searchTerm === null ? "skip" : { term: searchTerm },
  );

  function pickClient(picked: PickedClient) {
    setClient(picked);
    setSearchText("");
    setDebouncedTerm("");
    setError(null);
  }

  function startCreatingClient() {
    setCreatingClient(true);
    setClient(null);
    setSearchText("");
    setDebouncedTerm("");
    setError(null);
  }

  function backToSearch() {
    setCreatingClient(false);
    setClient(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    let target: ContactFormValues["target"];
    if (creatingClient) {
      if (!newName.trim()) {
        setError("El nombre completo del cliente es obligatorio.");
        return;
      }
      if (!newPhone.trim() && !newEmail.trim()) {
        setError("Introduce al menos un teléfono o un correo electrónico del cliente.");
        return;
      }
      target = {
        newClient: {
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          channel: newChannel,
        },
      };
    } else if (client) {
      target = { clientId: client._id };
    } else {
      setError("Elige un cliente o da de alta uno nuevo.");
      return;
    }
    if (!date) {
      setError("La fecha es obligatoria.");
      return;
    }
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      setError("La nota es obligatoria.");
      return;
    }
    if (normalizedNote.length > NOTE_MAX_LENGTH) {
      setError(`La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`);
      return;
    }
    if (!performedById) {
      setError("Selecciona quién realizó la interacción.");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ target, type, date, note: normalizedNote, performedById });
    } catch (err) {
      setError(
        contactErrorMessage(err, "No se ha podido guardar la interacción. Inténtalo de nuevo."),
      );
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border-default bg-surface-card flex flex-col gap-5 rounded-lg border p-6 shadow-sm"
    >
      <fieldset className="flex flex-col gap-2" disabled={isSaving}>
        <legend className="text-text-secondary mb-1 text-sm font-medium">Cliente</legend>

        {client && (
          <div className="border-border-default flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="flex flex-col">
              <span className="text-text-primary font-medium">{client.name}</span>
              {client.phone && (
                <span className="text-text-tertiary text-sm">{client.phone}</span>
              )}
            </div>
            <button
              type="button"
              onClick={backToSearch}
              className="text-text-link text-sm"
            >
              Cambiar
            </button>
          </div>
        )}

        {isSearching && (
          <>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nombre, teléfono o correo"
              className={fieldClass}
            />
            {searchText.trim().length > 0 && searchText.trim().length < SEARCH_MIN_CHARS && (
              <p className="text-text-tertiary text-sm">
                Escribe al menos {SEARCH_MIN_CHARS} caracteres.
              </p>
            )}
            {suggestions && suggestions.length === 0 && (
              <p className="text-text-secondary text-sm">
                No se encontró ningún cliente con ese dato.
              </p>
            )}
            {suggestions && suggestions.length > 0 && (
              <ul className="border-border-default flex flex-col rounded-md border">
                {suggestions.map((s) => (
                  <li key={s._id}>
                    <button
                      type="button"
                      onClick={() => pickClient({ _id: s._id, name: s.name, phone: s.phone })}
                      className="hover:bg-neutral-100 flex w-full flex-col px-3 py-2 text-left"
                    >
                      <span className="text-text-primary font-medium">{s.name}</span>
                      {s.phone && (
                        <span className="text-text-tertiary text-sm">{s.phone}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={startCreatingClient}
              className="text-text-link self-start text-sm"
            >
              ¿No existe? Dar de alta un cliente nuevo
            </button>
          </>
        )}

        {creatingClient && (
          <div className="border-border-default flex flex-col gap-3 rounded-md border p-3">
            <label className="flex flex-col gap-1">
              <span className="text-text-secondary text-sm font-medium">Nombre completo</span>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-secondary text-sm font-medium">Teléfono</span>
              <input
                type="tel"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-secondary text-sm font-medium">Correo electrónico</span>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-secondary text-sm font-medium">
                Canal de entrada del cliente
              </span>
              <select
                value={newChannel}
                onChange={(event) => setNewChannel(event.target.value as ClientChannel)}
                className={`bg-surface-card ${fieldClass}`}
              >
                {CLIENT_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={backToSearch}
              className="text-text-link self-start text-sm"
            >
              Buscar un cliente existente
            </button>
          </div>
        )}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-text-secondary text-sm font-medium">Canal</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as ContactChannel)}
          disabled={isSaving}
          className={`bg-surface-card ${fieldClass}`}
        >
          {CONTACT_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-secondary text-sm font-medium">Fecha</span>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={isSaving}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-secondary text-sm font-medium">Realizada por</span>
        <select
          value={performedById}
          onChange={(event) => setPerformedByOverride(event.target.value as Id<"users">)}
          disabled={isSaving || !users}
          className={`bg-surface-card ${fieldClass}`}
        >
          {!users && <option value="">Cargando…</option>}
          {users && !performedById && <option value="">Selecciona…</option>}
          {users?.map((option) => (
            <option key={option._id} value={option._id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-secondary text-sm font-medium">Nota</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ej.: Pidió presupuesto de hogar"
          disabled={isSaving}
          rows={4}
          maxLength={NOTE_MAX_LENGTH}
          className="border-border-default text-text-primary focus:border-primary-500 disabled:text-text-tertiary w-full rounded-md border px-3 py-2 outline-none disabled:bg-neutral-100"
        />
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
          onClick={onCancel}
          disabled={isSaving}
          className="border-border-default text-text-primary flex h-12 items-center justify-center rounded-md border px-5 font-medium disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving || !users || !currentUser}
          className="bg-primary-500 text-on-brand flex h-12 items-center justify-center rounded-md px-5 font-medium disabled:opacity-60"
        >
          {isSaving ? "Guardando…" : "Guardar interacción"}
        </button>
      </div>
    </form>
  );
}
