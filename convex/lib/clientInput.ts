import { ConvexError, Infer, v } from "convex/values";
import { MutationCtx } from "../_generated/server";

// Alta de cliente compartida por `clients.create` (P4) y por el alta inline de
// `contacts.create` (ARC-72). Solo helpers: no exporta funciones Convex y no
// comprueba sesión — la autorización es responsabilidad de la mutation que
// llama.

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

export const newClientValidator = v.object({
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  channel: clientChannelValidator,
});

export type NewClientInput = Infer<typeof newClientValidator>;

export async function insertClient(ctx: MutationCtx, input: NewClientInput) {
  const name = input.name.trim();
  const phone = input.phone?.trim() || undefined;
  const email = input.email?.trim() || undefined;
  if (!name) {
    throw new ConvexError("El nombre completo es obligatorio");
  }
  if (!phone && !email) {
    throw new ConvexError("Introduce al menos un teléfono o un correo electrónico");
  }
  if (phone && !isValidPhone(phone)) {
    throw new ConvexError(
      "El teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
    );
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new ConvexError("El correo electrónico no tiene un formato válido.");
  }
  return await ctx.db.insert("clients", {
    name,
    phone,
    email,
    channel: input.channel,
    saleStatus: "interesado",
    priority: "media",
    createdAt: Date.now(),
  });
}
