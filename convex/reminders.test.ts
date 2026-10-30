// Pruebas de `reminders.update` (ARC-74).
//
// Limitación: la "edición concurrente" aquí es una simulación secuencial de
// snapshot obsoleto — la segunda sesión manda los `expected*` con los que
// abrió el formulario DESPUÉS de que la primera haya guardado. Valida el
// control optimista, no interleavings ni la atomicidad del backend real
// (convex-test es un simulador con diferencias conocidas respecto a Convex).
//
// Las fechas son fijas y lejanas (2000-01-01 / 2999-12-31) para no depender
// del reloj ni de la zona horaria (la regla compara contra "hoy" en
// Europe/Madrid).
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const PAST = "2000-01-01";
const FUTURE = "2999-12-31";
const FUTURE_2 = "2999-12-30";
const CHANGED = "El recordatorio ha cambiado en otra sesión; vuelve a abrirlo";

async function setup(overrides: { date?: string; status?: "pendiente" | "atendido" } = {}) {
  const t = convexTest(schema, modules);
  const base = await t.run(async (ctx) => {
    const mk = (name: string, email: string, role: "owner" | "agent") =>
      ctx.db.insert("users", { name, email, role });
    const miriam = await mk("Miriam", "miriam@test.es", "owner");
    const monica = await mk("Mónica", "monica@test.es", "agent");
    const antonio = await mk("Antonio", "antonio@test.es", "agent");
    const clientId = await ctx.db.insert("clients", {
      name: "Cliente",
      channel: "llamada",
      saleStatus: "interesado",
      priority: "media",
      createdAt: 0,
    });
    const reminderId = await ctx.db.insert("reminders", {
      clientId,
      date: overrides.date ?? FUTURE,
      note: "Llamar",
      status: overrides.status ?? "pendiente",
      createdById: miriam,
      assignedToId: monica,
    });
    return { miriam, monica, antonio, reminderId };
  });
  // `getAuthUserId` solo lee `subject.split("|")[0]` (formato `userId|sessionId`).
  const as = (userId: Id<"users">) => t.withIdentity({ subject: `${userId}|sesion-test` });
  return { t, as, ...base };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const get = (s: Ctx, id: Id<"reminders"> = s.reminderId) => s.t.run((ctx) => ctx.db.get(id));

// Texto del ConvexError de negocio (`userError`); falla si no hubo rechazo.
const userMessage = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { userMessage?: string } }).data?.userMessage;
  }
  throw new Error("Se esperaba un rechazo");
};

// Edición tal como la manda el cliente: `expected*` = lo que vio al abrir.
function edit(
  s: Ctx,
  who: Id<"users">,
  seen: { date: string; note: string; assignedToId: Id<"users"> },
  next: { date: string; note: string; assignedToId: Id<"users"> },
) {
  return s.as(who).mutation(api.reminders.update, {
    id: s.reminderId,
    expectedDate: seen.date,
    expectedNote: seen.note,
    expectedAssignedToId: seen.assignedToId,
    ...next,
  });
}

describe("reminders.update", () => {
  test("guarda cuando todo coincide, recortando la nota", async () => {
    const s = await setup();
    const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
    await edit(s, s.miriam, seen, { date: FUTURE_2, note: "  Nueva nota  ", assignedToId: s.antonio });
    expect(await get(s)).toMatchObject({
      date: FUTURE_2,
      note: "Nueva nota",
      assignedToId: s.antonio,
    });
  });

  describe("edición concurrente (snapshot obsoleto)", () => {
    test("la 1ª sesión cambia la nota, la 2ª cambia el responsable", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      await edit(s, s.miriam, seen, { ...seen, note: "Nota de la sesión 1" });
      const msg = await userMessage(
        edit(s, s.antonio, seen, { ...seen, assignedToId: s.antonio }),
      );
      expect(msg).toBe(CHANGED);
      // Conserva íntegra la 1ª modificación; nada parcial de la 2ª.
      expect(await get(s)).toMatchObject({
        note: "Nota de la sesión 1",
        assignedToId: s.monica,
        date: FUTURE,
      });
    });

    test("la 1ª sesión cambia el responsable, la 2ª cambia la nota", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      await edit(s, s.miriam, seen, { ...seen, assignedToId: s.antonio });
      const msg = await userMessage(
        edit(s, s.monica, seen, { ...seen, note: "Nota de la sesión 2" }),
      );
      expect(msg).toBe(CHANGED);
      expect(await get(s)).toMatchObject({
        note: "Llamar",
        assignedToId: s.antonio,
        date: FUTURE,
      });
    });

    test("otra sesión cambió la fecha", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      await edit(s, s.miriam, seen, { ...seen, date: FUTURE_2 });
      const msg = await userMessage(edit(s, s.miriam, seen, { ...seen, note: "Otra" }));
      expect(msg).toBe(CHANGED);
      expect(await get(s)).toMatchObject({ date: FUTURE_2, note: "Llamar" });
    });
  });

  test("omitir expectedNote / expectedAssignedToId lo rechaza el validador de Convex", async () => {
    const s = await setup();
    const call = (extra: Record<string, unknown>) =>
      s.as(s.miriam).mutation(api.reminders.update, {
        id: s.reminderId,
        date: FUTURE,
        note: "X",
        assignedToId: s.monica,
        ...extra,
      } as never);
    // Error de validación de argumentos, no un ConvexError de negocio.
    await expect(call({ expectedDate: FUTURE, expectedAssignedToId: s.monica })).rejects.toThrow(
      /expectedNote/,
    );
    await expect(call({ expectedDate: FUTURE, expectedNote: "Llamar" })).rejects.toThrow(
      /expectedAssignedToId/,
    );
    expect(await get(s)).toMatchObject({ note: "Llamar", date: FUTURE, assignedToId: s.monica });
  });

  test("recordatorio eliminado entre carga y guardado", async () => {
    const s = await setup();
    const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
    await s.t.run((ctx) => ctx.db.delete(s.reminderId));
    const msg = await userMessage(edit(s, s.miriam, seen, { ...seen, note: "X" }));
    expect(msg).toBe("El recordatorio no existe");
    expect(await get(s)).toBeNull(); // update no lo recrea
  });

  test("recordatorio ya atendido", async () => {
    const s = await setup({ status: "atendido" });
    const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
    const msg = await userMessage(edit(s, s.miriam, seen, { ...seen, note: "X" }));
    expect(msg).toBe("El recordatorio ya está atendido");
    expect(await get(s)).toMatchObject({ status: "atendido", note: "Llamar" });
  });

  test("no autenticado", async () => {
    const s = await setup();
    await expect(
      s.t.mutation(api.reminders.update, {
        id: s.reminderId,
        expectedDate: FUTURE,
        expectedNote: "Llamar",
        expectedAssignedToId: s.monica,
        date: FUTURE,
        note: "X",
        assignedToId: s.monica,
      }),
    ).rejects.toThrow("No autenticado");
    expect(await get(s)).toMatchObject({ note: "Llamar" });
  });

  describe("validaciones", () => {
    test("nota vacía", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      expect(await userMessage(edit(s, s.miriam, seen, { ...seen, note: "   " }))).toBe(
        "La nota es obligatoria",
      );
      expect(await get(s)).toMatchObject({ note: "Llamar" });
    });

    test("nota de más de 500 caracteres", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      expect(await userMessage(edit(s, s.miriam, seen, { ...seen, note: "a".repeat(501) }))).toMatch(
        /demasiado larga/,
      );
      expect(await get(s)).toMatchObject({ note: "Llamar" });
    });

    test("fecha imposible de calendario", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      expect(await userMessage(edit(s, s.miriam, seen, { ...seen, date: "2999-02-30" }))).toBe(
        "La fecha no es válida",
      );
      expect(await get(s)).toMatchObject({ date: FUTURE });
    });

    test("fecha nueva en el pasado se rechaza", async () => {
      const s = await setup();
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      expect(await userMessage(edit(s, s.miriam, seen, { ...seen, date: PAST }))).toBe(
        "La fecha de seguimiento no puede ser anterior a hoy",
      );
      expect(await get(s)).toMatchObject({ date: FUTURE });
    });

    test("recordatorio vencido se edita sin cambiar su fecha", async () => {
      const s = await setup({ date: PAST });
      const seen = { date: PAST, note: "Llamar", assignedToId: s.monica };
      await edit(s, s.miriam, seen, { ...seen, note: "Editada" });
      expect(await get(s)).toMatchObject({ date: PAST, note: "Editada" });
    });

    test("responsable inexistente", async () => {
      const s = await setup();
      const ghost = await s.t.run(async (ctx) => {
        const id = await ctx.db.insert("users", { name: "X", email: "x@test.es", role: "agent" });
        await ctx.db.delete(id);
        return id;
      });
      const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
      expect(await userMessage(edit(s, s.miriam, seen, { ...seen, assignedToId: ghost }))).toBe(
        "El usuario asignado no existe",
      );
      expect(await get(s)).toMatchObject({ assignedToId: s.monica });
    });
  });

  // EXCEPCIÓN DE SEGURIDAD / DECISIÓN DE PRODUCTO: hay visibilidad total entre
  // las 3 cuentas fijas (ver convex/reminders.ts y convex/auth.ts, que bloquea
  // el registro). Este test FIJA esa invariante. Si algún día se abre el
  // registro o se segmenta por cliente/equipo, hay que sustituirlo por pruebas
  // de autorización de objeto reales (un usuario ajeno NO debe poder editar).
  test("cualquier cuenta autenticada puede editar un recordatorio asignado a otra", async () => {
    const s = await setup(); // asignado a Mónica
    const seen = { date: FUTURE, note: "Llamar", assignedToId: s.monica };
    await edit(s, s.antonio, seen, { ...seen, note: "Editado por Antonio" });
    expect(await get(s)).toMatchObject({ note: "Editado por Antonio", assignedToId: s.monica });
  });
});
