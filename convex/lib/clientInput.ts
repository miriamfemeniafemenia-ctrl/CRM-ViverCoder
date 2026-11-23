import { ConvexError, Infer, v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { addressValidator } from "./addressFields";
import { priorityValidator } from "./priority";
import { assertAssignableUser } from "./team";
import { isValidISODate, todayISODateMadrid } from "./validation";

// Alta y edición de cliente: reglas compartidas por `clients.create` (P4),
// `clients.update` (P4 editar, ARC-11) y el alta inline de `contacts.create`
// (ARC-72). Solo helpers: no exporta funciones Convex y no comprueba sesión —
// la autorización es responsabilidad de la mutation que llama
// (convex/lib/team.ts).
//
// Los mensajes de error son frases fijas que nunca incluyen valores del
// usuario (no se filtran datos personales a registros). La interfaz los
// reconoce por su texto exacto (KNOWN_SERVER_ERRORS en el formulario).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?:\+34|0034)?[6789]\d{8}$/;

function isValidPhone(value: string) {
  return PHONE_RE.test(value.replace(/[\s\-.()]/g, ""));
}

// Canal de captación del cliente (distinto del canal de una interacción,
// `contacts.type`: "presencial" solo existe aquí, "correo" solo allí).
export const clientChannelValidator = v.union(
  v.literal("llamada"),
  v.literal("whatsapp"),
  v.literal("web"),
  v.literal("redes"),
  v.literal("presencial"),
);

// Campos básicos del alta. Es también lo único que acepta el alta rápida de
// «Anotar interacción» (`contacts.create`), que no cambia con ARC-49.
const basicClientFields = {
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  channel: clientChannelValidator,
};

export const newClientValidator = v.object(basicClientFields);

// Campos ampliados de D1 (ARC-49), todos opcionales.
export const clientDetailsFields = {
  secondPhone: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  dni: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  sex: v.optional(v.string()),
  language: v.optional(v.union(v.literal("castellano"), v.literal("valenciano"))),
  address: v.optional(addressValidator),
  referredBy: v.optional(v.string()),
  assignedAgentId: v.optional(v.id("users")),
  // Prioridad (ARC-32). Opcional en los argumentos: al crear, sin valor →
  // «media»; al editar, sin valor → se conserva la actual. Es obligatoria en el
  // documento, así que nunca se «vacía». No pasa por normalizeClientFields.
  priority: v.optional(priorityValidator),
};

// Básicos + ampliados: argumentos de `clients.create` y `clients.update`.
export const clientFields = { ...basicClientFields, ...clientDetailsFields };
export const clientFieldsValidator = v.object(clientFields);

export type NewClientInput = Infer<typeof newClientValidator>;
export type ClientFieldsInput = Infer<typeof clientFieldsValidator>;

export const TEXT_MAX_LENGTH = 200;
export const SEX_VALUES = ["mujer", "hombre", "otro"] as const;

export const CLIENT_ERRORS = {
  nameRequired: "El nombre completo es obligatorio",
  contactRequired: "Introduce al menos un teléfono o un correo electrónico",
  phone: "El teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  email: "El correo electrónico no tiene un formato válido.",
  secondPhone:
    "El segundo teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  whatsapp: "El WhatsApp no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  dni: "El DNI/NIE no es válido.",
  dniDuplicate: "Ya existe un cliente con este DNI/NIE",
  birthDate: "La fecha de nacimiento no es válida.",
  sex: "El sexo no es válido.",
  postalCode: "El código postal no es válido (5 cifras de un código español).",
  textTooLong: `Algún texto es demasiado largo (máximo ${TEXT_MAX_LENGTH} caracteres).`,
  notFound: "No se encontró este cliente",
  editConflict:
    "Otra persona ha modificado este cliente mientras lo editabas. Recarga para ver sus cambios antes de guardar.",
} as const;

// ---------------------------------------------------------------------------
// Normalizadores puros (exportados para las pruebas).

// DNI/NIE. Contrato único: quita espacios, guiones y puntos y pasa a
// mayúsculas; después exige DNI (8 cifras + letra) o NIE (X/Y/Z + 7 cifras +
// letra) con la letra de control correcta. Cualquier otro carácter → inválido
// (null).
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const DNI_RE = /^(\d{8})([A-Z])$/;
const NIE_RE = /^([XYZ])(\d{7})([A-Z])$/;

export function normalizeDni(raw: string): string | null {
  const value = raw.replace(/[\s.-]/g, "").toUpperCase();
  const dni = DNI_RE.exec(value);
  if (dni) {
    return DNI_LETTERS[Number(dni[1]) % 23] === dni[2] ? value : null;
  }
  const nie = NIE_RE.exec(value);
  if (nie) {
    const number = Number(`${"XYZ".indexOf(nie[1])}${nie[2]}`);
    return DNI_LETTERS[number % 23] === nie[3] ? value : null;
  }
  return null;
}

// Código postal español. Quita los espacios; válido si son 5 cifras con
// prefijo de provincia 01–52. Copia con la misma lógica en
// src/lib/client-form.ts: si se toca una, tocar la otra.
export function normalizePostalCode(raw: string): string | null {
  const value = raw.replace(/\s/g, "");
  if (!/^\d{5}$/.test(value)) return null;
  const prefix = Number(value.slice(0, 2));
  return prefix >= 1 && prefix <= 52 ? value : null;
}

function optionalText(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value.length > TEXT_MAX_LENGTH) {
    throw new ConvexError(CLIENT_ERRORS.textTooLong);
  }
  return value;
}

function normalizeAddress(raw: ClientFieldsInput["address"]): Doc<"clients">["address"] {
  if (!raw) return undefined;
  const rawPostalCode = raw.postalCode?.trim();
  let postalCode: string | undefined;
  if (rawPostalCode) {
    const normalized = normalizePostalCode(rawPostalCode);
    if (normalized === null) {
      throw new ConvexError(CLIENT_ERRORS.postalCode);
    }
    postalCode = normalized;
  }
  const address = {
    street: optionalText(raw.street),
    number: optionalText(raw.number),
    floorDoor: optionalText(raw.floorDoor),
    postalCode,
    city: optionalText(raw.city),
    // La provincia se guarda tal como se escribe: corregirla a mano está
    // permitido aunque no coincida con el prefijo del código postal.
    province: optionalText(raw.province),
  };
  // Sin ningún subcampo con valor, no se guarda dirección.
  if (Object.values(address).every((value) => value === undefined)) {
    return undefined;
  }
  // Sin claves con `undefined`: el documento guarda solo lo que tiene valor.
  return Object.fromEntries(
    Object.entries(address).filter(([, value]) => value !== undefined),
  ) as Doc<"clients">["address"];
}

// Normaliza y valida todos los campos editables (básicos + ampliados). Las
// cadenas vacías pasan a `undefined`. No comprueba nada que necesite la base
// de datos (DNI duplicado, agente): eso es `assertClientReferences`.
export function normalizeClientFields(input: ClientFieldsInput | NewClientInput) {
  const details: Partial<ClientFieldsInput> = input;
  const name = input.name.trim();
  const phone = input.phone?.trim() || undefined;
  const email = input.email?.trim() || undefined;
  if (!name) {
    throw new ConvexError(CLIENT_ERRORS.nameRequired);
  }
  if (!phone && !email) {
    throw new ConvexError(CLIENT_ERRORS.contactRequired);
  }
  if (phone && !isValidPhone(phone)) {
    throw new ConvexError(CLIENT_ERRORS.phone);
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new ConvexError(CLIENT_ERRORS.email);
  }

  const secondPhone = details.secondPhone?.trim() || undefined;
  if (secondPhone && !isValidPhone(secondPhone)) {
    throw new ConvexError(CLIENT_ERRORS.secondPhone);
  }
  const whatsapp = details.whatsapp?.trim() || undefined;
  if (whatsapp && !isValidPhone(whatsapp)) {
    throw new ConvexError(CLIENT_ERRORS.whatsapp);
  }

  let dni: string | undefined;
  if (details.dni?.trim()) {
    const normalized = normalizeDni(details.dni);
    if (normalized === null) {
      throw new ConvexError(CLIENT_ERRORS.dni);
    }
    dni = normalized;
  }

  const birthDate = details.birthDate?.trim() || undefined;
  if (
    birthDate &&
    (!isValidISODate(birthDate) ||
      birthDate < "1900-01-01" ||
      birthDate > todayISODateMadrid())
  ) {
    throw new ConvexError(CLIENT_ERRORS.birthDate);
  }

  const sex = details.sex?.trim() || undefined;
  if (sex && !(SEX_VALUES as readonly string[]).includes(sex)) {
    throw new ConvexError(CLIENT_ERRORS.sex);
  }

  return {
    name,
    phone,
    email,
    channel: input.channel,
    secondPhone,
    whatsapp,
    dni,
    birthDate,
    sex,
    language: details.language,
    address: normalizeAddress(details.address),
    referredBy: optionalText(details.referredBy),
    assignedAgentId: details.assignedAgentId,
  };
}

export type NormalizedClientFields = ReturnType<typeof normalizeClientFields>;

// Comprobaciones que leen la base de datos. Corren dentro de la mutation que
// llama, así que son atómicas con la escritura: Convex serializa las
// mutations, y dos altas simultáneas con el mismo DNI leen el mismo rango del
// índice `by_dni`, por lo que una se reintenta y ve a la otra.
export async function assertClientReferences(
  ctx: QueryCtx,
  fields: NormalizedClientFields,
  selfId?: Id<"clients">,
) {
  if (fields.dni) {
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_dni", (q) => q.eq("dni", fields.dni))
      .first();
    if (existing && existing._id !== selfId) {
      throw new ConvexError(CLIENT_ERRORS.dniDuplicate);
    }
  }
  if (fields.assignedAgentId) {
    await assertAssignableUser(ctx, fields.assignedAgentId);
  }
}

export type SaleStatus = Doc<"clients">["saleStatus"];

export type SaleStatusResult = {
  changed: boolean;
  previousSaleStatus: SaleStatus;
  saleStatus: SaleStatus;
};

// Cambio de estado de venta (F7/ARC-18), compartido por `clients.setSaleStatus`
// y `contacts.create` («Anotar interacción»). `client` es el documento leído DENTRO de la
// mutation, así que `previousSaleStatus` es el valor real en el momento
// serializado del cambio (no el que el navegador tenía en pantalla). Mismo
// valor → no escribe ni sube la versión. Si cambia, la versión SÍ sube: un P4
// «Editar» abierto recibe el aviso de edición simultánea.
export async function applySaleStatus(
  ctx: MutationCtx,
  client: Doc<"clients">,
  saleStatus: SaleStatus,
): Promise<SaleStatusResult> {
  const previousSaleStatus = client.saleStatus;
  if (previousSaleStatus === saleStatus) {
    return { changed: false, previousSaleStatus, saleStatus };
  }
  const currentVersion = client.updatedAt ?? client.createdAt;
  await ctx.db.patch(client._id, {
    saleStatus,
    updatedAt: Math.max(Date.now(), currentVersion + 1),
  });
  return { changed: true, previousSaleStatus, saleStatus };
}

// Alta de cliente (P4 y alta rápida de «Anotar interacción»). Inicializa
// siempre `updatedAt = createdAt`: todos los clientes nuevos tienen la misma
// semántica de versión (control de ediciones simultáneas de `clients.update`).
export async function insertClient(
  ctx: MutationCtx,
  input: ClientFieldsInput | NewClientInput,
) {
  const fields = normalizeClientFields(input);
  await assertClientReferences(ctx, fields);
  // El alta rápida (NewClientInput) no lleva prioridad: siempre «media».
  const { priority }: Partial<ClientFieldsInput> = input;
  const now = Date.now();
  return await ctx.db.insert("clients", {
    ...fields,
    saleStatus: "interesado",
    priority: priority ?? "media",
    createdAt: now,
    updatedAt: now,
  });
}
