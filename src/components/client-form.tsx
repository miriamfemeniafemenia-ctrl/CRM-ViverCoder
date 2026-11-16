"use client";

import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  cloneElement,
  FormEvent,
  ReactElement,
  ReactNode,
  useEffect,
  useId,
  useReducer,
  useState,
} from "react";
import {
  addressReducer,
  AddressState,
  Channel,
  CHANNELS,
  ClientFormFields,
  ClientPayload,
  currentNormalizedPostalCode,
  EDIT_CONFLICT_ERROR,
  formToPayload,
  KNOWN_SERVER_ERRORS,
  Language,
  LANGUAGE_OPTIONS,
  provinceMismatch,
  SEX_OPTIONS,
} from "@/lib/client-form";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const fieldClass =
  "border-border-default text-text-primary focus:border-primary-500 disabled:text-text-tertiary h-12 w-full rounded-md border px-3 outline-none disabled:bg-neutral-100";
const selectClass = `${fieldClass} bg-surface-card`;

// Un campo: `<label htmlFor>` + el control (recibe el `id`) + una ayuda
// opcional FUERA de la etiqueta (puede llevar botones, que no pueden ir dentro
// de un <label>).
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-text-secondary text-sm font-medium">
        {label}
      </label>
      {cloneElement(children, { id })}
      {hint}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-text-primary mb-1 text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

// Formulario P4 de cliente, compartido por Nuevo (ARC-10/ARC-49) y Editar
// (ARC-11). Cuatro bloques (contacto, datos personales, dirección, gestión
// interna). El código postal rellena la provincia y propone poblaciones usadas
// antes con ese código (ARC-66); las reglas están en src/lib/client-form.ts.
//
// El estado inicial se toma UNA vez al montar: para recargar los datos (por
// ejemplo tras un conflicto de edición), el padre vuelve a montar el formulario
// con otra `key`.
export function ClientForm({
  initialFields,
  initialAddress,
  submitLabel,
  onSubmit,
  onCancel,
  onDiscardAndReload,
}: {
  initialFields: ClientFormFields;
  initialAddress: AddressState;
  submitLabel: string;
  onSubmit: (payload: ClientPayload) => Promise<void>;
  onCancel: () => void;
  // Solo en Editar: ante un conflicto de edición, descarta lo escrito y vuelve a
  // cargar el cliente con su versión actual.
  onDiscardAndReload?: () => void;
}) {
  const users = useQuery(api.users.list);
  const [fields, setFields] = useState(initialFields);
  const [address, dispatch] = useReducer(addressReducer, initialAddress);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const citiesListId = useId();

  const set = <K extends keyof ClientFormFields>(key: K, value: ClientFormFields[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // Poblaciones usadas antes con el código postal vigente (normalizado). La
  // respuesta pasa al reductor desde un efecto, nunca durante el render; el
  // reductor descarta las de un código anterior y es idempotente, así que una
  // respuesta repetida no provoca más renders.
  const postalCode = currentNormalizedPostalCode(address);
  const citiesResult = useQuery(
    api.clients.citiesForPostalCode,
    postalCode === null ? "skip" : { postalCode },
  );
  useEffect(() => {
    if (citiesResult) {
      dispatch({ type: "citiesLoaded", postalCode: citiesResult.postalCode, cities: citiesResult.cities });
    }
  }, [citiesResult]);
  const suggestedCities =
    citiesResult && citiesResult.postalCode === postalCode ? citiesResult.cities : [];

  const expectedProvince = provinceMismatch(address);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);
    if (!fields.name.trim()) {
      setError("El nombre completo es obligatorio.");
      return;
    }
    if (!fields.phone.trim() && !fields.email.trim()) {
      setError("Introduce al menos un teléfono o un correo electrónico.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(formToPayload(fields, address));
      // Al guardar, el padre navega fuera: el formulario sigue bloqueado.
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
    <form
      onSubmit={handleSubmit}
      className="border-border-default bg-surface-card flex flex-col gap-8 rounded-lg border p-6 shadow-sm"
    >
      <Section title="Datos de contacto">
        <Field label="Nombre completo">
          <input
            type="text"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nombre y apellidos"
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Teléfono">
          <input
            type="tel"
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="600 000 000"
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Correo electrónico">
          <input
            type="email"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="cliente@correo.es"
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Segundo teléfono">
          <input
            type="tel"
            value={fields.secondPhone}
            onChange={(e) => set("secondPhone", e.target.value)}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="WhatsApp">
          <input
            type="tel"
            value={fields.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Canal de entrada">
          <select
            value={fields.channel}
            onChange={(e) => set("channel", e.target.value as Channel)}
            disabled={isSaving}
            className={selectClass}
          >
            {CHANNELS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Datos personales">
        <Field label="DNI / NIE">
          <input
            type="text"
            value={fields.dni}
            onChange={(e) => set("dni", e.target.value)}
            placeholder="12345678Z"
            autoCapitalize="characters"
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Fecha de nacimiento">
          <input
            type="date"
            value={fields.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Sexo">
          <select
            value={fields.sex}
            onChange={(e) => set("sex", e.target.value)}
            disabled={isSaving}
            className={selectClass}
          >
            <option value="">—</option>
            {SEX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Idioma">
          <select
            value={fields.language}
            onChange={(e) => set("language", e.target.value as Language | "")}
            disabled={isSaving}
            className={selectClass}
          >
            <option value="">—</option>
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Dirección">
        <Field label="Calle">
          <input
            type="text"
            value={address.street}
            onChange={(e) => dispatch({ type: "fieldEdited", field: "street", value: e.target.value })}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número">
            <input
              type="text"
              value={address.number}
              onChange={(e) => dispatch({ type: "fieldEdited", field: "number", value: e.target.value })}
              disabled={isSaving}
              className={fieldClass}
            />
          </Field>
          <Field label="Piso / puerta">
            <input
              type="text"
              value={address.floorDoor}
              onChange={(e) => dispatch({ type: "fieldEdited", field: "floorDoor", value: e.target.value })}
              disabled={isSaving}
              className={fieldClass}
            />
          </Field>
        </div>
        <Field label="Código postal">
          <input
            type="text"
            inputMode="numeric"
            value={address.postalCode}
            onChange={(e) => dispatch({ type: "postalCodeChanged", value: e.target.value })}
            placeholder="46001"
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field
          label="Población"
          hint={
            suggestedCities.length > 0 && (
              <span className="text-text-tertiary text-xs">
                Poblaciones usadas antes con este código: {suggestedCities.join(", ")}
              </span>
            )
          }
        >
          <input
            type="text"
            value={address.city}
            onChange={(e) => dispatch({ type: "cityEdited", value: e.target.value })}
            list={citiesListId}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <datalist id={citiesListId}>
          {suggestedCities.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
        <Field
          label="Provincia"
          hint={
            expectedProvince !== null && (
              <span className="text-warning-fg flex flex-wrap items-center gap-2 text-xs">
                La provincia no coincide con el código postal (sería {expectedProvince}).
                <button
                  type="button"
                  onClick={() => dispatch({ type: "useExpectedProvince" })}
                  disabled={isSaving}
                  className="text-text-link font-medium underline"
                >
                  Usar {expectedProvince}
                </button>
              </span>
            )
          }
        >
          <input
            type="text"
            value={address.province}
            onChange={(e) => dispatch({ type: "provinceEdited", value: e.target.value })}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
      </Section>

      <Section title="Gestión interna">
        <Field label="Referido por">
          <input
            type="text"
            value={fields.referredBy}
            onChange={(e) => set("referredBy", e.target.value)}
            disabled={isSaving}
            className={fieldClass}
          />
        </Field>
        <Field label="Agente asignado">
          <select
            value={fields.assignedAgentId}
            onChange={(e) => set("assignedAgentId", e.target.value as Id<"users"> | "")}
            disabled={isSaving || users === undefined}
            className={selectClass}
          >
            <option value="">Sin asignar</option>
            {(users ?? []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {error && (
        <div className="border-warning-border bg-warning-bg flex flex-col gap-2 rounded-md border px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-warning-fg">⚠</span>
            <span className="text-warning-fg text-sm">{error}</span>
          </div>
          {error === EDIT_CONFLICT_ERROR && onDiscardAndReload && (
            <button
              type="button"
              onClick={onDiscardAndReload}
              className="border-border-default text-text-primary self-start rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Descartar mis cambios y recargar
            </button>
          )}
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
          disabled={isSaving}
          className="bg-primary-500 text-on-brand flex h-12 items-center justify-center rounded-md px-5 font-medium disabled:opacity-60"
        >
          {isSaving ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
