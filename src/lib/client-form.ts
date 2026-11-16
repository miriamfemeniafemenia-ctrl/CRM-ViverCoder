// Formulario P4 de cliente (Nuevo y Editar; ARC-49, ARC-11, ARC-66). Lógica
// pura, sin React: estado del formulario, paso a/desde el documento y el
// reductor de la dirección (código postal → provincia/población).
//
// Convex solo empaqueta `convex/` y Next.js solo `src/`: lo que se comparte
// con el servidor está DUPLICADO aquí con la misma lógica (`normalizePostalCode`
// y los mensajes de error). Si se toca una copia, tocar la otra; las pruebas
// (client-form.test.ts) comparan ambas.
import type { Doc, Id } from "../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Código postal y provincia

// Copia de `normalizePostalCode` de convex/lib/clientInput.ts: quita espacios;
// válido si son 5 cifras con prefijo de provincia 01–52.
export function normalizePostalCode(raw: string): string | null {
  const value = raw.replace(/\s/g, "");
  if (!/^\d{5}$/.test(value)) return null;
  const prefix = Number(value.slice(0, 2));
  return prefix >= 1 && prefix <= 52 ? value : null;
}

// Provincia por las dos primeras cifras del código postal (nombres en
// castellano).
export const PROVINCES: Readonly<Record<string, string>> = {
  "01": "Álava",
  "02": "Albacete",
  "03": "Alicante",
  "04": "Almería",
  "05": "Ávila",
  "06": "Badajoz",
  "07": "Illes Balears",
  "08": "Barcelona",
  "09": "Burgos",
  "10": "Cáceres",
  "11": "Cádiz",
  "12": "Castellón",
  "13": "Ciudad Real",
  "14": "Córdoba",
  "15": "A Coruña",
  "16": "Cuenca",
  "17": "Girona",
  "18": "Granada",
  "19": "Guadalajara",
  "20": "Gipuzkoa",
  "21": "Huelva",
  "22": "Huesca",
  "23": "Jaén",
  "24": "León",
  "25": "Lleida",
  "26": "La Rioja",
  "27": "Lugo",
  "28": "Madrid",
  "29": "Málaga",
  "30": "Murcia",
  "31": "Navarra",
  "32": "Ourense",
  "33": "Asturias",
  "34": "Palencia",
  "35": "Las Palmas",
  "36": "Pontevedra",
  "37": "Salamanca",
  "38": "Santa Cruz de Tenerife",
  "39": "Cantabria",
  "40": "Segovia",
  "41": "Sevilla",
  "42": "Soria",
  "43": "Tarragona",
  "44": "Teruel",
  "45": "Toledo",
  "46": "Valencia",
  "47": "Valladolid",
  "48": "Bizkaia",
  "49": "Zamora",
  "50": "Zaragoza",
  "51": "Ceuta",
  "52": "Melilla",
};

export function provinceFromPostalCode(raw: string): string | null {
  const postalCode = normalizePostalCode(raw);
  return postalCode === null ? null : (PROVINCES[postalCode.slice(0, 2)] ?? null);
}

// Comparación solo para el aviso visual: sin mayúsculas, acentos ni espacios
// de los extremos. Nunca se usa para reescribir lo que escribe el usuario.
function sameProvince(a: string, b: string) {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return norm(a) === norm(b);
}

// ---------------------------------------------------------------------------
// Dirección: reductor

export type Source = "auto" | "manual";

export type AddressState = {
  street: string;
  number: string;
  floorDoor: string;
  // Tal como se teclea (para no mover el cursor); las decisiones usan siempre
  // `currentNormalizedPostalCode(state)`.
  postalCode: string;
  city: string;
  province: string;
  // "auto": la rellenó la app y puede volver a rellenarla al cambiar el código.
  // "manual": la escribió (o borró) el usuario y la app no la toca nunca.
  provinceSource: Source;
  citySource: Source;
};

export type AddressAction =
  | { type: "fieldEdited"; field: "street" | "number" | "floorDoor"; value: string }
  | { type: "postalCodeChanged"; value: string }
  | { type: "provinceEdited"; value: string }
  | { type: "cityEdited"; value: string }
  | { type: "citiesLoaded"; postalCode: string | null; cities: readonly string[] }
  | { type: "useExpectedProvince" };

export function currentNormalizedPostalCode(state: Pick<AddressState, "postalCode">) {
  return normalizePostalCode(state.postalCode);
}

export function initialAddressState(address?: Doc<"clients">["address"]): AddressState {
  const postalCode = address?.postalCode ?? "";
  const city = address?.city ?? "";
  const province = address?.province ?? "";
  const expected = provinceFromPostalCode(postalCode);
  // Alta: todo "auto". Edición: la provincia es "auto" solo si coincide con la
  // del código; si no (o hay provincia sin código), es una elección manual. La
  // población guardada es "manual" (no se pisa); vacía, "auto".
  const provinceSource: Source =
    province === "" || (expected !== null && sameProvince(province, expected)) ? "auto" : "manual";
  return {
    street: address?.street ?? "",
    number: address?.number ?? "",
    floorDoor: address?.floorDoor ?? "",
    postalCode,
    city,
    province,
    provinceSource,
    citySource: city === "" ? "auto" : "manual",
  };
}

export function addressReducer(state: AddressState, action: AddressAction): AddressState {
  switch (action.type) {
    case "fieldEdited":
      return { ...state, [action.field]: action.value };

    case "postalCodeChanged": {
      const before = currentNormalizedPostalCode(state);
      const after = normalizePostalCode(action.value);
      const next = { ...state, postalCode: action.value };
      if (state.provinceSource === "auto") {
        next.province = after === null ? "" : (PROVINCES[after.slice(0, 2)] ?? "");
      }
      // Una población puesta por la app pertenecía al código anterior: se vacía
      // si el código (normalizado) cambia. Una manual no se toca.
      if (state.citySource === "auto" && before !== after) {
        next.city = "";
      }
      return next;
    }

    case "provinceEdited":
      // También al borrarla: un borrado es una elección del usuario.
      return { ...state, province: action.value, provinceSource: "manual" };

    case "cityEdited":
      return { ...state, city: action.value, citySource: "manual" };

    case "citiesLoaded": {
      // Idempotente: en cualquier caso que no cambie nada se devuelve el MISMO
      // objeto, para que React no vuelva a pintar.
      const current = currentNormalizedPostalCode(state);
      if (current === null || action.postalCode !== current) return state; // respuesta antigua
      if (state.citySource === "manual") return state;
      if (state.city !== "") return state;
      if (action.cities.length !== 1) return state;
      return { ...state, city: action.cities[0] };
    }

    case "useExpectedProvince": {
      const expected = provinceFromPostalCode(state.postalCode);
      if (expected === null) return state;
      if (state.province === expected && state.provinceSource === "auto") return state;
      return { ...state, province: expected, provinceSource: "auto" };
    }
  }
}

// Provincia que correspondería al código, si la escrita a mano no coincide.
// Solo para mostrar el aviso «sería X»; null si no hay nada que avisar.
export function provinceMismatch(state: AddressState): string | null {
  if (state.provinceSource !== "manual") return null;
  const expected = provinceFromPostalCode(state.postalCode);
  if (expected === null) return null;
  return sameProvince(state.province, expected) ? null : expected;
}

// ---------------------------------------------------------------------------
// Resto del formulario

export const CHANNELS = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "web", label: "Web" },
  { value: "redes", label: "Redes sociales" },
  { value: "presencial", label: "Presencial" },
] as const;
export type Channel = (typeof CHANNELS)[number]["value"];

export const SEX_OPTIONS = [
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "otro", label: "Otro" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "castellano", label: "Castellano" },
  { value: "valenciano", label: "Valenciano" },
] as const;
export type Language = (typeof LANGUAGE_OPTIONS)[number]["value"];

export type ClientFormFields = {
  name: string;
  phone: string;
  email: string;
  channel: Channel;
  secondPhone: string;
  whatsapp: string;
  dni: string;
  birthDate: string;
  sex: string;
  language: Language | "";
  referredBy: string;
  assignedAgentId: Id<"users"> | "";
};

export function emptyClientForm(): ClientFormFields {
  return {
    name: "",
    phone: "",
    email: "",
    channel: "llamada",
    secondPhone: "",
    whatsapp: "",
    dni: "",
    birthDate: "",
    sex: "",
    language: "",
    referredBy: "",
    assignedAgentId: "",
  };
}

export function clientToForm(client: Doc<"clients">): ClientFormFields {
  return {
    name: client.name,
    phone: client.phone ?? "",
    email: client.email ?? "",
    channel: client.channel,
    secondPhone: client.secondPhone ?? "",
    whatsapp: client.whatsapp ?? "",
    dni: client.dni ?? "",
    birthDate: client.birthDate ?? "",
    sex: client.sex ?? "",
    language: client.language ?? "",
    referredBy: client.referredBy ?? "",
    assignedAgentId: client.assignedAgentId ?? "",
  };
}

// Versión con la que se abre el formulario de edición (control de ediciones
// simultáneas, clients.update).
export function clientVersion(client: Pick<Doc<"clients">, "updatedAt" | "createdAt">) {
  return client.updatedAt ?? client.createdAt;
}

// Cliente fijado en la pantalla de Editar, atado al id de la ruta: si la ruta
// pasa a otro cliente sin recargar la página, lo fijado del anterior se
// descarta y se espera al documento del nuevo id. Nunca se usa un documento
// cuyo `_id` no sea el de la ruta (evita guardar datos de A sobre B).
export type PinnedClient = { routeId: string; client: Doc<"clients"> } | null;

export function pinnedForRoute(
  pinned: PinnedClient,
  routeId: string,
  live: Doc<"clients"> | null | undefined,
): PinnedClient {
  if (pinned !== null && pinned.routeId === routeId && pinned.client._id === routeId) {
    return pinned;
  }
  if (live && live._id === routeId) {
    return { routeId, client: live };
  }
  return null;
}

const optional = (value: string) => value.trim() || undefined;

// Datos que se envían a clients.create / clients.update. Lo vacío va como
// `undefined` (en update, eso borra el campo). La dirección se omite si todos
// sus subcampos están vacíos. El código postal válido se envía normalizado;
// uno inválido se envía tal cual para que el servidor devuelva su mensaje.
export function formToPayload(fields: ClientFormFields, address: AddressState) {
  const rawPostalCode = address.postalCode.trim();
  const addressPayload = {
    street: optional(address.street),
    number: optional(address.number),
    floorDoor: optional(address.floorDoor),
    postalCode: rawPostalCode ? (normalizePostalCode(rawPostalCode) ?? rawPostalCode) : undefined,
    city: optional(address.city),
    province: optional(address.province),
  };
  const hasAddress = Object.values(addressPayload).some((v) => v !== undefined);
  return {
    name: fields.name.trim(),
    phone: optional(fields.phone),
    email: optional(fields.email),
    channel: fields.channel,
    secondPhone: optional(fields.secondPhone),
    whatsapp: optional(fields.whatsapp),
    dni: optional(fields.dni),
    birthDate: optional(fields.birthDate),
    sex: optional(fields.sex),
    language: fields.language || undefined,
    address: hasAddress ? addressPayload : undefined,
    referredBy: optional(fields.referredBy),
    assignedAgentId: fields.assignedAgentId || undefined,
  };
}

export type ClientPayload = ReturnType<typeof formToPayload>;

// ---------------------------------------------------------------------------
// Errores del servidor que se muestran tal cual (copia de CLIENT_ERRORS de
// convex/lib/clientInput.ts y NOT_AUTHENTICATED de convex/lib/team.ts; la
// prueba comprueba que coinciden). Cualquier otro error → mensaje genérico.
export const EDIT_CONFLICT_ERROR =
  "Otra persona ha modificado este cliente mientras lo editabas. Recarga para ver sus cambios antes de guardar.";

export const KNOWN_SERVER_ERRORS: ReadonlySet<string> = new Set([
  "El nombre completo es obligatorio",
  "Introduce al menos un teléfono o un correo electrónico",
  "El teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  "El correo electrónico no tiene un formato válido.",
  "El segundo teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  "El WhatsApp no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
  "El DNI/NIE no es válido.",
  "Ya existe un cliente con este DNI/NIE",
  "La fecha de nacimiento no es válida.",
  "El sexo no es válido.",
  "El código postal no es válido (5 cifras de un código español).",
  "Algún texto es demasiado largo (máximo 200 caracteres).",
  "No se encontró este cliente",
  EDIT_CONFLICT_ERROR,
  "El agente asignado no es válido",
  "No autenticado",
]);
