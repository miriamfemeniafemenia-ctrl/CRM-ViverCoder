// Pruebas de la ficha ampliada (ARC-49), la edición con control de ediciones
// simultáneas (ARC-11) y las sugerencias de población por código postal
// (ARC-66). Las de acceso con sesión ajena están en lib/team.test.ts.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { CLIENT_ERRORS, normalizeDni, normalizePostalCode } from "./lib/clientInput";
import { ASSIGNABLE_AGENT_ERROR } from "./lib/team";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const { miriam, antonio } = await t.run(async (ctx) => ({
    miriam: await ctx.db.insert("users", { name: "Miriam", email: "m@test.es", role: "owner" }),
    antonio: await ctx.db.insert("users", { name: "Antonio", email: "a@test.es", role: "agent" }),
  }));
  const as = t.withIdentity({ subject: `${miriam}|sesion-test` });
  return { t, as, miriam, antonio };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const basic = { name: "Ana Ruiz", phone: "600123456", channel: "web" as const };

const errorData = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { data?: unknown }).data;
  }
  throw new Error("Se esperaba un rechazo");
};

const getClient = (s: Ctx, id: Id<"clients">) => s.t.run((ctx) => ctx.db.get(id));
const clientCount = (s: Ctx) => s.t.run(async (ctx) => (await ctx.db.query("clients").collect()).length);

describe("normalizeDni", () => {
  test("acepta variantes con espacios, guiones, puntos y minúsculas", () => {
    for (const raw of ["12345678Z", "12.345.678-z", "12 345 678 z", "1234-5678 z", " 12345678z "]) {
      expect(normalizeDni(raw)).toBe("12345678Z");
    }
    expect(normalizeDni("X-1234.567 l")).toBe("X1234567L");
    expect(normalizeDni("y1234567x")).toBe("Y1234567X");
  });
  test("rechaza letra de control incorrecta y caracteres no admitidos", () => {
    for (const raw of ["12345678A", "12345678Z!", "12_345_678Z", "1234567Z", "X1234567A", "W1234567L", ""]) {
      expect(normalizeDni(raw)).toBeNull();
    }
  });
});

describe("normalizePostalCode", () => {
  test("quita espacios y exige 5 cifras con prefijo 01–52", () => {
    expect(normalizePostalCode("46001")).toBe("46001");
    expect(normalizePostalCode(" 46 001 ")).toBe("46001");
    expect(normalizePostalCode("01001")).toBe("01001");
    expect(normalizePostalCode("52001")).toBe("52001");
    for (const raw of ["00001", "53001", "4600", "460011", "46a01", "46-001", ""]) {
      expect(normalizePostalCode(raw)).toBeNull();
    }
  });
});

describe("clients.create con campos ampliados", () => {
  test("guarda todos los campos normalizados, incluido floorDoor, y updatedAt = createdAt", async () => {
    const s = await setup();
    const id = await s.as.mutation(api.clients.create, {
      ...basic,
      secondPhone: " 611 222 333 ",
      whatsapp: "+34 622333444",
      dni: "12.345.678-z",
      birthDate: "1980-05-17",
      sex: "mujer",
      language: "valenciano",
      address: {
        street: " Calle Colón ",
        number: "10",
        floorDoor: " 3ºB ",
        postalCode: "46 004",
        city: "Valencia",
        province: "Valencia",
      },
      referredBy: " Pepe ",
      assignedAgentId: s.antonio,
    });
    const c = await getClient(s, id);
    expect(c).toMatchObject({
      secondPhone: "611 222 333",
      whatsapp: "+34 622333444",
      dni: "12345678Z",
      birthDate: "1980-05-17",
      sex: "mujer",
      language: "valenciano",
      address: {
        street: "Calle Colón",
        number: "10",
        floorDoor: "3ºB",
        postalCode: "46004",
        city: "Valencia",
        province: "Valencia",
      },
      referredBy: "Pepe",
      assignedAgentId: s.antonio,
      saleStatus: "interesado",
      priority: "media",
    });
    expect(c?.updatedAt).toBe(c?.createdAt);
  });

  test("solo con los campos básicos sigue funcionando y no guarda dirección", async () => {
    const s = await setup();
    const id = await s.as.mutation(api.clients.create, basic);
    const c = await getClient(s, id);
    expect(c?.address).toBeUndefined();
    expect(c?.dni).toBeUndefined();
    expect(c?.updatedAt).toBe(c?.createdAt);
  });

  test("dirección parcial, solo floorDoor, y todo vacío (no se guarda)", async () => {
    const s = await setup();
    const parcial = await s.as.mutation(api.clients.create, {
      ...basic,
      address: { postalCode: "46001", city: " ", floorDoor: "2ª" },
    });
    expect((await getClient(s, parcial))?.address).toEqual({ postalCode: "46001", floorDoor: "2ª" });
    const soloPiso = await s.as.mutation(api.clients.create, {
      ...basic,
      phone: "600000001",
      address: { floorDoor: "Bajo" },
    });
    expect((await getClient(s, soloPiso))?.address).toEqual({ floorDoor: "Bajo" });
    const vacia = await s.as.mutation(api.clients.create, {
      ...basic,
      phone: "600000002",
      address: { street: "", number: " ", floorDoor: "", postalCode: "", city: "", province: "" },
    });
    expect((await getClient(s, vacia))?.address).toBeUndefined();
  });

  test.each([
    [{ dni: "12345678A" }, CLIENT_ERRORS.dni],
    [{ dni: "X1234567A" }, CLIENT_ERRORS.dni],
    [{ birthDate: "2999-01-01" }, CLIENT_ERRORS.birthDate],
    [{ birthDate: "1899-12-31" }, CLIENT_ERRORS.birthDate],
    [{ birthDate: "1980-02-30" }, CLIENT_ERRORS.birthDate],
    [{ sex: "x" }, CLIENT_ERRORS.sex],
    [{ secondPhone: "12345" }, CLIENT_ERRORS.secondPhone],
    [{ whatsapp: "abc" }, CLIENT_ERRORS.whatsapp],
    [{ address: { postalCode: "00001" } }, CLIENT_ERRORS.postalCode],
    [{ address: { postalCode: "53001" } }, CLIENT_ERRORS.postalCode],
    [{ address: { postalCode: "4600" } }, CLIENT_ERRORS.postalCode],
    [{ referredBy: "x".repeat(201) }, CLIENT_ERRORS.textTooLong],
    [{ address: { floorDoor: "x".repeat(201) } }, CLIENT_ERRORS.textTooLong],
  ])("rechaza %o con su mensaje y sin crear nada", async (extra, message) => {
    const s = await setup();
    expect(await errorData(s.as.mutation(api.clients.create, { ...basic, ...extra }))).toBe(message);
    expect(await clientCount(s)).toBe(0);
  });

  test("agente asignado: inexistente se rechaza", async () => {
    const s = await setup();
    const borrado = await s.t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "B", email: "b@test.es", role: "agent" });
      await ctx.db.delete(id);
      return id;
    });
    expect(await errorData(s.as.mutation(api.clients.create, { ...basic, assignedAgentId: borrado }))).toBe(
      ASSIGNABLE_AGENT_ERROR,
    );
    expect(await clientCount(s)).toBe(0);
  });
});

describe("DNI/NIE único", () => {
  test("duplicado secuencial con otra forma de escribirlo", async () => {
    const s = await setup();
    await s.as.mutation(api.clients.create, { ...basic, dni: "12345678Z" });
    for (const variante of ["12345678z", "12.345.678-Z", "1234 5678 z"]) {
      expect(
        await errorData(s.as.mutation(api.clients.create, { ...basic, phone: "600000009", dni: variante })),
      ).toBe(CLIENT_ERRORS.dniDuplicate);
    }
    expect(await clientCount(s)).toBe(1);
  });

  test("dos altas lanzadas a la vez: una crea y la otra falla exactamente por duplicado", async () => {
    const s = await setup();
    const results = await Promise.allSettled([
      s.as.mutation(api.clients.create, { ...basic, dni: "12345678Z" }),
      s.as.mutation(api.clients.create, { ...basic, phone: "600000003", dni: "12.345.678-z" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect((ko[0].reason as { data?: unknown }).data).toBe(CLIENT_ERRORS.dniDuplicate);
    expect(await clientCount(s)).toBe(1);
  });

  test("update del propio cliente sin cambiar el DNI funciona; poner el de otro falla", async () => {
    const s = await setup();
    const a = await s.as.mutation(api.clients.create, { ...basic, dni: "12345678Z" });
    const b = await s.as.mutation(api.clients.create, { ...basic, phone: "600000004", dni: "X1234567L" });
    const va = (await getClient(s, a))!;
    await s.as.mutation(api.clients.update, {
      id: a,
      expectedVersion: va.updatedAt!,
      ...basic,
      name: "Ana Ruiz Pérez",
      dni: "12 345 678 z",
    });
    expect((await getClient(s, a))?.name).toBe("Ana Ruiz Pérez");
    const vb = (await getClient(s, b))!;
    expect(
      await errorData(
        s.as.mutation(api.clients.update, {
          id: b,
          expectedVersion: vb.updatedAt!,
          ...basic,
          phone: "600000004",
          dni: "12345678Z",
        }),
      ),
    ).toBe(CLIENT_ERRORS.dniDuplicate);
    expect((await getClient(s, b))?.dni).toBe("X1234567L");
  });
});

describe("clients.update", () => {
  async function created(s: Ctx) {
    const id = await s.as.mutation(api.clients.create, {
      ...basic,
      email: "ana@test.es",
      secondPhone: "611222333",
      address: { street: "Calle A", floorDoor: "1º", postalCode: "46001", city: "Valencia" },
      referredBy: "Pepe",
      assignedAgentId: s.antonio,
    });
    // Estado que update no debe tocar.
    await s.t.run((ctx) => ctx.db.patch(id, { saleStatus: "presupuesto", priority: "alta" }));
    return (await getClient(s, id))!;
  }

  test("sustituye los campos, borra los vacíos (incluido floorDoor) y conserva saleStatus, priority y createdAt", async () => {
    const s = await setup();
    const before = await created(s);
    await s.as.mutation(api.clients.update, {
      id: before._id,
      expectedVersion: before.updatedAt!,
      name: "Ana R.",
      phone: "",
      email: "ana@test.es",
      channel: "presencial",
      secondPhone: "",
      address: { street: "Calle B", floorDoor: "", postalCode: "28001", city: "Madrid", province: "Madrid" },
      referredBy: "",
    });
    const after = (await getClient(s, before._id))!;
    expect(after).toMatchObject({
      name: "Ana R.",
      email: "ana@test.es",
      channel: "presencial",
      address: { street: "Calle B", postalCode: "28001", city: "Madrid", province: "Madrid" },
      saleStatus: "presupuesto",
      priority: "alta",
      createdAt: before.createdAt,
    });
    expect(after.phone).toBeUndefined();
    expect(after.secondPhone).toBeUndefined();
    expect(after.referredBy).toBeUndefined();
    expect(after.assignedAgentId).toBeUndefined();
    expect(after.address?.floorDoor).toBeUndefined();
    expect(after.updatedAt!).toBeGreaterThan(before.updatedAt!);
  });

  test("conflicto: dos ediciones con la misma versión, la segunda falla y se conservan los datos de la primera", async () => {
    const s = await setup();
    const before = await created(s);
    await s.as.mutation(api.clients.update, {
      id: before._id,
      expectedVersion: before.updatedAt!,
      ...basic,
      name: "Primera",
    });
    expect(
      await errorData(
        s.as.mutation(api.clients.update, {
          id: before._id,
          expectedVersion: before.updatedAt!,
          ...basic,
          name: "Segunda",
        }),
      ),
    ).toBe(CLIENT_ERRORS.editConflict);
    expect((await getClient(s, before._id))?.name).toBe("Primera");
  });

  test("cliente antiguo sin updatedAt: su versión es createdAt", async () => {
    const s = await setup();
    const id = await s.t.run((ctx) =>
      ctx.db.insert("clients", {
        ...basic,
        saleStatus: "interesado",
        priority: "media",
        createdAt: 1234,
      }),
    );
    expect(
      await errorData(s.as.mutation(api.clients.update, { id, expectedVersion: 999, ...basic, name: "X" })),
    ).toBe(CLIENT_ERRORS.editConflict);
    await s.as.mutation(api.clients.update, { id, expectedVersion: 1234, ...basic, name: "Nuevo" });
    const c = (await getClient(s, id))!;
    expect(c.name).toBe("Nuevo");
    expect(c.updatedAt!).toBeGreaterThan(1234);
  });

  test("la versión siempre sube aunque updatedAt esté por delante del reloj", async () => {
    const s = await setup();
    const futuro = Date.now() + 10_000_000;
    const id = await s.t.run((ctx) =>
      ctx.db.insert("clients", {
        ...basic,
        saleStatus: "interesado",
        priority: "media",
        createdAt: 1,
        updatedAt: futuro,
      }),
    );
    await s.as.mutation(api.clients.update, { id, expectedVersion: futuro, ...basic });
    expect((await getClient(s, id))?.updatedAt).toBe(futuro + 1);
  });

  test("alta rápida (contacts.create): updatedAt === createdAt, se edita con esa versión y la antigua da conflicto", async () => {
    const s = await setup();
    const { clientId } = await s.as.mutation(api.contacts.create, {
      target: { newClient: { name: "Rápido", phone: "600999888", channel: "llamada" } },
      type: "llamada",
      date: "2026-01-01",
      note: "nota",
      performedById: s.miriam,
    });
    const c = (await getClient(s, clientId))!;
    expect(c.updatedAt).toBe(c.createdAt);
    await s.as.mutation(api.clients.update, {
      id: clientId,
      expectedVersion: c.createdAt,
      name: "Rápido Editado",
      phone: "600999888",
      channel: "llamada",
    });
    expect(
      await errorData(
        s.as.mutation(api.clients.update, {
          id: clientId,
          expectedVersion: c.createdAt,
          name: "Otra",
          phone: "600999888",
          channel: "llamada",
        }),
      ),
    ).toBe(CLIENT_ERRORS.editConflict);
  });

  test("cliente inexistente", async () => {
    const s = await setup();
    const id = await s.t.run(async (ctx) => {
      const x = await ctx.db.insert("clients", { ...basic, saleStatus: "interesado", priority: "media", createdAt: 1 });
      await ctx.db.delete(x);
      return x;
    });
    expect(await errorData(s.as.mutation(api.clients.update, { id, expectedVersion: 1, ...basic }))).toBe(
      CLIENT_ERRORS.notFound,
    );
  });

  test("valida igual que el alta (error de validación sin modificar el cliente)", async () => {
    const s = await setup();
    const before = await created(s);
    expect(
      await errorData(
        s.as.mutation(api.clients.update, {
          id: before._id,
          expectedVersion: before.updatedAt!,
          ...basic,
          address: { postalCode: "99999" },
        }),
      ),
    ).toBe(CLIENT_ERRORS.postalCode);
    expect(await getClient(s, before._id)).toEqual(before);
  });
});

describe("clients.citiesForPostalCode", () => {
  test("devuelve solo nombres de población distintos y ordenados, con el código normalizado", async () => {
    const s = await setup();
    const mk = (phone: string, postalCode: string, city?: string) =>
      s.as.mutation(api.clients.create, { ...basic, phone, address: { postalCode, city } });
    await mk("600000010", "46001", "Valencia");
    await mk("600000011", "46001", "València");
    await mk("600000012", "46001", "Valencia");
    await mk("600000013", "46001");
    await mk("600000014", "28001", "Madrid");
    const r = await s.as.query(api.clients.citiesForPostalCode, { postalCode: " 46 001" });
    expect(r).toEqual({ postalCode: "46001", cities: ["Valencia", "València"] });
  });

  test("código mal formado: nada y sin leer", async () => {
    const s = await setup();
    for (const postalCode of ["4600", "53001", "46a01", ""]) {
      expect(await s.as.query(api.clients.citiesForPostalCode, { postalCode })).toEqual({
        postalCode: null,
        cities: [],
      });
    }
  });

  test("como mucho 10 poblaciones", async () => {
    const s = await setup();
    for (let i = 0; i < 12; i++) {
      await s.as.mutation(api.clients.create, {
        ...basic,
        phone: `6000001${String(i).padStart(2, "0")}`,
        address: { postalCode: "46100", city: `Pueblo ${String(i).padStart(2, "0")}` },
      });
    }
    const r = await s.as.query(api.clients.citiesForPostalCode, { postalCode: "46100" });
    expect(r.cities).toHaveLength(10);
  });
});
