// Pruebas de `contacts.create` (ARC-72): anotar una interacción, con cliente
// existente o con alta inline del cliente en la misma mutation.
//
// Las fechas son fijas (no dependen del reloj): la fecha de una interacción no
// se valida contra "hoy". "Sin filas nuevas" se comprueba comparando conteos
// antes/después, no asumiendo tablas vacías.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const base = await t.run(async (ctx) => {
    const mk = (name: string, email: string, role: "owner" | "agent") =>
      ctx.db.insert("users", { name, email, role });
    const miriam = await mk("Miriam", "miriam@test.es", "owner");
    const antonio = await mk("Antonio", "antonio@test.es", "agent");
    const clientId = await ctx.db.insert("clients", {
      name: "Laura Gómez",
      phone: "600123456",
      channel: "llamada",
      saleStatus: "interesado",
      priority: "media",
      createdAt: 0,
    });
    return { miriam, antonio, clientId };
  });
  const as = (userId: Id<"users">) => t.withIdentity({ subject: `${userId}|sesion-test` });
  return { t, as, ...base };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const counts = (s: Ctx) =>
  s.t.run(async (ctx) => ({
    contacts: (await ctx.db.query("contacts").collect()).length,
    clients: (await ctx.db.query("clients").collect()).length,
  }));

const userMessage = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    const data = (e as { data?: unknown }).data;
    return typeof data === "string"
      ? data
      : (data as { userMessage?: string } | undefined)?.userMessage;
  }
  throw new Error("Se esperaba un rechazo");
};

const valid = (s: Ctx) => ({
  target: { clientId: s.clientId },
  type: "llamada" as const,
  date: "2000-01-01",
  note: "Pidió presupuesto",
  performedById: s.antonio,
});

describe("contacts.create", () => {
  test("registra la interacción: quién registra (sesión) distinto de quién la realizó", async () => {
    const s = await setup();
    const { contactId, clientId } = await s.as(s.miriam).mutation(api.contacts.create, {
      ...valid(s),
      note: "  Pidió presupuesto  ",
    });
    expect(clientId).toBe(s.clientId);
    const contact = await s.t.run((ctx) => ctx.db.get(contactId));
    expect(contact).toMatchObject({
      clientId: s.clientId,
      type: "llamada",
      date: "2000-01-01",
      note: "Pidió presupuesto",
      createdById: s.miriam,
      performedById: s.antonio,
    });
    expect(typeof contact!.createdAt).toBe("number");
  });

  test("alta inline: crea el cliente (interesado/media) y el contacto, con canales independientes", async () => {
    const s = await setup();
    const before = await counts(s);
    const { contactId, clientId } = await s.as(s.miriam).mutation(api.contacts.create, {
      ...valid(s),
      type: "correo", // canal de la interacción: solo existe en contacts
      target: {
        newClient: { name: "  Nuevo Cliente ", email: "nuevo@test.es", channel: "presencial" }, // solo en clients
      },
    });
    expect(clientId).not.toBe(s.clientId);
    expect(await s.t.run((ctx) => ctx.db.get(clientId))).toMatchObject({
      name: "Nuevo Cliente",
      email: "nuevo@test.es",
      channel: "presencial",
      saleStatus: "interesado",
      priority: "media",
    });
    expect(await s.t.run((ctx) => ctx.db.get(contactId))).toMatchObject({
      clientId,
      type: "correo",
    });
    expect(await counts(s)).toEqual({
      contacts: before.contacts + 1,
      clients: before.clients + 1,
    });
  });

  test("alta inline atómica: si la interacción es inválida no queda un cliente huérfano", async () => {
    const s = await setup();
    const before = await counts(s);
    const msg = await userMessage(
      s.as(s.miriam).mutation(api.contacts.create, {
        ...valid(s),
        note: "   ",
        target: { newClient: { name: "Huérfano", phone: "600123457", channel: "llamada" } },
      }),
    );
    expect(msg).toBe("La nota es obligatoria");
    expect(await counts(s)).toEqual(before);
  });

  test("alta inline con cliente inválido (sin teléfono ni correo): nada se escribe", async () => {
    const s = await setup();
    const before = await counts(s);
    const msg = await userMessage(
      s.as(s.miriam).mutation(api.contacts.create, {
        ...valid(s),
        target: { newClient: { name: "Sin datos", channel: "llamada" } },
      }),
    );
    expect(msg).toBe("Introduce al menos un teléfono o un correo electrónico");
    expect(await counts(s)).toEqual(before);
  });

  test("alta inline con quien realizó inexistente: nada se escribe (ni el cliente)", async () => {
    const s = await setup();
    const ghost = await s.t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "X", email: "x@test.es", role: "agent" });
      await ctx.db.delete(id);
      return id;
    });
    const before = await counts(s);
    const msg = await userMessage(
      s.as(s.miriam).mutation(api.contacts.create, {
        ...valid(s),
        performedById: ghost,
        target: { newClient: { name: "Huérfano", phone: "600123457", channel: "llamada" } },
      }),
    );
    expect(msg).toBe("El usuario que realizó la interacción no existe");
    expect(await counts(s)).toEqual(before);
  });

  describe("validaciones", () => {
    const reject = async (s: Ctx, patch: Record<string, unknown>) => {
      const before = await counts(s);
      const msg = await userMessage(
        s.as(s.miriam).mutation(api.contacts.create, { ...valid(s), ...patch } as never),
      );
      expect(await counts(s)).toEqual(before);
      return msg;
    };

    test("nota vacía y nota demasiado larga", async () => {
      const s = await setup();
      expect(await reject(s, { note: "  " })).toBe("La nota es obligatoria");
      expect(await reject(s, { note: "a".repeat(501) })).toMatch(/demasiado larga/);
    });

    test("cliente inexistente", async () => {
      const s = await setup();
      const gone = await s.t.run(async (ctx) => {
        const id = await ctx.db.insert("clients", {
          name: "Borrado",
          channel: "web",
          saleStatus: "interesado",
          priority: "baja",
          createdAt: 0,
        });
        await ctx.db.delete(id);
        return id;
      });
      expect(await reject(s, { target: { clientId: gone } })).toBe("El cliente no existe");
    });

    test("quien realizó inexistente", async () => {
      const s = await setup();
      const ghost = await s.t.run(async (ctx) => {
        const id = await ctx.db.insert("users", { name: "X", email: "x@test.es", role: "agent" });
        await ctx.db.delete(id);
        return id;
      });
      expect(await reject(s, { performedById: ghost })).toBe(
        "El usuario que realizó la interacción no existe",
      );
    });

    test.each(["presencial", "fax", ""])("canal de interacción inválido (%s) lo rechaza el validador", async (type) => {
      const s = await setup();
      const before = await counts(s);
      await expect(
        s.as(s.miriam).mutation(api.contacts.create, { ...valid(s), type } as never),
      ).rejects.toThrow();
      expect(await counts(s)).toEqual(before);
    });

    test.each([
      "2000-01-01", // pasada: aceptada
      "2999-12-31", // futura: aceptada
      "2024-02-29", // bisiesto válido
    ])("fecha válida (%s) aceptada, sin restricción respecto a hoy", async (date) => {
      const s = await setup();
      const { contactId } = await s.as(s.miriam).mutation(api.contacts.create, { ...valid(s), date });
      expect((await s.t.run((ctx) => ctx.db.get(contactId)))!.date).toBe(date);
    });

    test.each([
      "2025-02-29", // no bisiesto
      "2024-02-30",
      "2025-13-01", // mes 13
      "2025-00-10", // mes 0
      "2025-01-00", // día 0
      "2025-04-31",
      "2025-1-5", // formato
      "",
    ])("fecha imposible o mal formada (%s) rechazada", async (date) => {
      const s = await setup();
      expect(await reject(s, { date })).toBe("La fecha no es válida");
    });
  });

  test("no autenticado: se rechaza y no se escribe nada", async () => {
    const s = await setup();
    const before = await counts(s);
    await expect(s.t.mutation(api.contacts.create, valid(s))).rejects.toThrow("No autenticado");
    expect(await counts(s)).toEqual(before);
  });
});
