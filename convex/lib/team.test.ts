// Pruebas de la política de acceso (ARC-49, convex/lib/team.ts): CADA función
// pública de convex/access-manifest.json con guard `getTeamUser` o
// `requireTeamUser`, llamada con una sesión ajena al equipo (su usuario ya no
// existe), devuelve vacío (queries) o lanza «No autenticado» (mutations) sin
// leer ni escribir datos. Con un usuario del equipo funcionan como siempre (lo
// cubren las pruebas de cada módulo).
//
// La lista de casos se compara con el manifiesto para que una función pública
// nueva no pueda quedar sin prueba de acceso.
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import manifest from "../access-manifest.json";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { NOT_AUTHENTICATED } from "./team";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const miriam = await ctx.db.insert("users", { name: "Miriam", email: "m@test.es", role: "owner" });
    const fantasma = await ctx.db.insert("users", { name: "Borrado", email: "b@test.es", role: "agent" });
    await ctx.db.delete(fantasma);
    const clientId = await ctx.db.insert("clients", {
      name: "Cliente",
      phone: "600123456",
      channel: "web",
      saleStatus: "interesado",
      priority: "media",
      createdAt: 1,
      updatedAt: 1,
      address: { postalCode: "46001", city: "Valencia" },
    });
    const reminderId = await ctx.db.insert("reminders", {
      clientId,
      date: "2099-01-01",
      note: "nota",
      status: "pendiente",
      createdById: miriam,
      assignedToId: miriam,
    });
    return { miriam, fantasma, clientId, reminderId };
  });
  // Sesión válida en apariencia, pero su usuario no existe: no es del equipo.
  const ajena = t.withIdentity({ subject: `${ids.fantasma}|sesion-ajena` });
  return { t, ajena, ...ids };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const snapshot = (s: Ctx) =>
  s.t.run(async (ctx) => ({
    clients: await ctx.db.query("clients").collect(),
    contacts: await ctx.db.query("contacts").collect(),
    reminders: await ctx.db.query("reminders").collect(),
  }));

type Case = { kind: "query"; expected: unknown; run: (s: Ctx) => Promise<unknown> } | {
  kind: "mutation";
  run: (s: Ctx) => Promise<unknown>;
};

const cases: Record<string, Case> = {
  "clients.js:create": {
    kind: "mutation",
    run: (s) => s.ajena.mutation(api.clients.create, { name: "X", phone: "600000000", channel: "web" }),
  },
  "clients.js:update": {
    kind: "mutation",
    run: (s) =>
      s.ajena.mutation(api.clients.update, {
        id: s.clientId,
        expectedVersion: 1,
        name: "X",
        phone: "600000000",
        channel: "web",
      }),
  },
  "clients.js:setPriority": {
    kind: "mutation",
    run: (s) => s.ajena.mutation(api.clients.setPriority, { id: s.clientId, priority: "alta" }),
  },
  "clients.js:list": { kind: "query", expected: [], run: (s) => s.ajena.query(api.clients.list, {}) },
  "clients.js:get": { kind: "query", expected: null, run: (s) => s.ajena.query(api.clients.get, { id: s.clientId }) },
  "clients.js:searchForPicker": {
    kind: "query",
    expected: [],
    run: (s) => s.ajena.query(api.clients.searchForPicker, { term: "Cliente" }),
  },
  "clients.js:lookup": { kind: "query", expected: null, run: (s) => s.ajena.query(api.clients.lookup, { id: s.clientId }) },
  "clients.js:citiesForPostalCode": {
    kind: "query",
    expected: { postalCode: null, cities: [] },
    run: (s) => s.ajena.query(api.clients.citiesForPostalCode, { postalCode: "46001" }),
  },
  "contacts.js:create": {
    kind: "mutation",
    run: (s) =>
      s.ajena.mutation(api.contacts.create, {
        target: { clientId: s.clientId },
        type: "llamada",
        date: "2026-01-01",
        note: "nota",
        performedById: s.miriam,
      }),
  },
  "reminders.js:create": {
    kind: "mutation",
    run: (s) =>
      s.ajena.mutation(api.reminders.create, {
        clientId: s.clientId,
        date: "2099-01-02",
        note: "nota",
        assignedToId: s.miriam,
      }),
  },
  "reminders.js:get": { kind: "query", expected: null, run: (s) => s.ajena.query(api.reminders.get, { id: s.reminderId }) },
  "reminders.js:update": {
    kind: "mutation",
    run: (s) =>
      s.ajena.mutation(api.reminders.update, {
        id: s.reminderId,
        expectedDate: "2099-01-01",
        expectedNote: "nota",
        expectedAssignedToId: s.miriam,
        date: "2099-01-03",
        note: "otra",
        assignedToId: s.miriam,
      }),
  },
  "reminders.js:remove": {
    kind: "mutation",
    run: (s) => s.ajena.mutation(api.reminders.remove, { id: s.reminderId }),
  },
  "reminders.js:listPendingByAssignee": {
    kind: "query",
    expected: [],
    run: (s) => s.ajena.query(api.reminders.listPendingByAssignee, {}),
  },
  "reminders.js:countDueByAssignee": {
    kind: "query",
    expected: 0,
    run: (s) => s.ajena.query(api.reminders.countDueByAssignee, { today: "2099-12-31" }),
  },
  "reminders.js:listPendingByClient": {
    kind: "query",
    expected: [],
    run: (s) => s.ajena.query(api.reminders.listPendingByClient, { clientId: s.clientId }),
  },
  "users.js:list": { kind: "query", expected: [], run: (s) => s.ajena.query(api.users.list, {}) },
  "users.js:current": { kind: "query", expected: null, run: (s) => s.ajena.query(api.users.current, {}) },
};

describe("política de acceso: sesión ajena al equipo", () => {
  test("hay un caso de prueba por cada función del manifiesto con guard del equipo", () => {
    const guarded = Object.entries(manifest.functions)
      .filter(([, guard]) => guard === "getTeamUser" || guard === "requireTeamUser")
      .map(([id]) => id)
      .sort();
    expect(Object.keys(cases).sort()).toEqual(guarded);
  });

  for (const [id, c] of Object.entries(cases)) {
    test(`${id}: ${c.kind === "query" ? "devuelve vacío" : "lanza «No autenticado»"} sin tocar datos`, async () => {
      const s = await setup();
      const before = await snapshot(s);
      if (c.kind === "query") {
        expect(await c.run(s)).toEqual(c.expected);
      } else {
        // Contrato con el cliente: ConvexError con data «No autenticado» (un
        // Error normal se redactaría en producción como «Server Error»).
        const err = await c.run(s).then(
          () => null,
          (e: unknown) => e,
        );
        expect(err).toBeInstanceOf(ConvexError);
        expect((err as ConvexError<string>).data).toBe(NOT_AUTHENTICATED);
      }
      expect(await snapshot(s)).toEqual(before);
    });
  }

  test("sin ninguna sesión, las queries también devuelven vacío", async () => {
    const s = await setup();
    expect(await s.t.query(api.clients.list, {})).toEqual([]);
    expect(await s.t.query(api.users.current, {})).toBeNull();
    expect(await s.t.query(api.clients.citiesForPostalCode, { postalCode: "46001" })).toEqual({
      postalCode: null,
      cities: [],
    });
  });

  test("con un usuario del equipo, users.current y users.list responden", async () => {
    const s = await setup();
    const as = s.t.withIdentity({ subject: `${s.miriam}|sesion-test` });
    expect((await as.query(api.users.current, {}))?._id).toBe(s.miriam);
    expect(await as.query(api.users.list, {})).toEqual([{ _id: s.miriam as Id<"users">, name: "Miriam" }]);
  });
});
