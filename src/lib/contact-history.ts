import type { Id } from "../../convex/_generated/dataModel";
import type { ContactChannel } from "../types";

// Historial de interacciones de la ficha P3 (ARC-14) y etiquetas de canal que
// comparte con «Anotar interacción» (ARC-72). Funciones puras: los componentes
// solo las aplican.

// Canal de la INTERACCIÓN (`contacts.type`), en el orden del selector. No
// confundir con el canal de captación del cliente (`clients.channel`).
export const CONTACT_TYPE_OPTIONS: readonly { value: ContactChannel; label: string }[] = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "correo", label: "Correo" },
  { value: "redes", label: "Redes sociales" },
  { value: "web", label: "Web" },
];

export function contactTypeLabel(type: ContactChannel): string {
  return CONTACT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

// «23 nov 2026» a partir de `YYYY-MM-DD` (la fecha elegida al anotar; no hay
// hora). En UTC, como `formatLongDate` de reminders.ts, para que la zona horaria
// del navegador no mueva el día. Sin el punto de abreviatura que añaden algunos
// motores («nov.»).
export function formatContactDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(".", "");
}

export const AUTHOR_LOADING = "…";
export const AUTHOR_UNKNOWN = "usuario no disponible";

// Autor de una interacción (decisión de Miriam, 24/11/2026): quien la realizó y,
// si la registró otra persona, «(anotada por X)». Mientras cargan los usuarios,
// «…»; un usuario que ya no existe, «usuario no disponible».
export function contactAuthor(
  performedById: Id<"users">,
  createdById: Id<"users">,
  users: readonly { _id: Id<"users">; name?: string }[] | undefined,
): string {
  if (users === undefined) return AUTHOR_LOADING;
  const nameOf = (id: Id<"users">) =>
    users.find((u) => u._id === id)?.name?.trim() || AUTHOR_UNKNOWN;
  const performer = nameOf(performedById);
  return createdById === performedById
    ? performer
    : `${performer} (anotada por ${nameOf(createdById)})`;
}
