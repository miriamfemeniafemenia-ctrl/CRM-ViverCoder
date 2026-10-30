// Pruebas de `clients.create` (regresión tras extraer lib/clientInput.ts) y de
// las queries del selector de "Anotar interacción" (ARC-72): `searchForPicker`
// y `lookup`.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const miriam = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Miriam", email: "miriam@test.es", role: "owner" }),
  );
  const as = t.withIdentity({ subject: `${miriam}|sesion-test` });
  return { t, as };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const clientCount = (s: Ctx) => s.t.run(async (ctx) => (await ctx.db.query("clients").collect()).length);

const errorData = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { data?: unknown }).data;
  }
  throw new Error("Se esperaba un rechazo");
};

describe("clients.create", () => {
  test("alta válida: recorta campos y aplica los valores por defecto", async () => {
    const s = await setup();
    const id = await s.as.mutation(api.clients.create, {
      name: "  Ana Ruiz  ",
      phone: "  600123456 ",
      email: "   ",
      channel: "web",
    });
    const doc = await s.t.run((ctx) => ctx.db.get(id));
    expect(doc).toMatchObject({
      name: "Ana Ruiz",
      phone: "600123456",
      channel: "web",
      saleStatus: "interesado",
      priority: "media",
    });
    expect(doc!.email).toBeUndefined();
    expect(typeof doc!.createdAt).toBe("number");
  });

  test.each([
    [{ name: "   ", phone: "600123456" }, "El nombre completo es obligatorio"],
    [{ name: "Ana" }, "Introduce al menos un teléfono o un correo electrónico"],
    [{ name: "Ana", phone: " ", email: " " }, "Introduce al menos un teléfono o un correo electrónico"],
    [
      { name: "Ana", phone: "12345" },
      "El teléfono no tiene un formato válido (9 dígitos, prefijo +34 opcional).",
    ],
    [{ name: "Ana", email: "no-es-correo" }, "El correo electrónico no tiene un formato válido."],
  ])("rechaza %j con el mismo mensaje y sin escribir", async (input, message) => {
    const s = await setup();
    const before = await clientCount(s);
    const data = await errorData(
      s.as.mutation(api.clients.create, { channel: "llamada", ...input }),
    );
    expect(data).toBe(message);
    expect(await clientCount(s)).toBe(before);
  });

  test("no autenticado", async () => {
    const s = await setup();
    await expect(
      s.t.mutation(api.clients.create, { name: "Ana", phone: "600123456", channel: "llamada" }),
    ).rejects.toThrow("No autenticado");
    expect(await clientCount(s)).toBe(0);
  });
});

async function seedClients(s: Ctx, n: number, prefix = "Cliente") {
  for (let i = 0; i < n; i++) {
    await s.t.run((ctx) =>
      ctx.db.insert("clients", {
        name: `${prefix} ${i}`,
        phone: "600000000",
        email: `${prefix.toLowerCase()}${i}@test.es`,
        channel: "llamada",
        saleStatus: "presupuesto",
        priority: "alta",
        createdAt: i,
      }),
    );
  }
}

describe("clients.searchForPicker", () => {
  test("menos de 2 caracteres devuelve vacío", async () => {
    const s = await setup();
    await seedClients(s, 3);
    expect(await s.as.query(api.clients.searchForPicker, { term: "c" })).toEqual([]);
    expect(await s.as.query(api.clients.searchForPicker, { term: "  " })).toEqual([]);
  });

  test("tope de 10 resultados", async () => {
    const s = await setup();
    await seedClients(s, 15);
    expect(await s.as.query(api.clients.searchForPicker, { term: "cliente" })).toHaveLength(10);
  });

  test("proyecta solo _id, name, phone y saleStatus", async () => {
    const s = await setup();
    await seedClients(s, 1);
    const [row] = await s.as.query(api.clients.searchForPicker, { term: "cliente" });
    expect(Object.keys(row).sort()).toEqual(["_id", "name", "phone", "saleStatus"]);
  });

  test("busca por nombre, correo y teléfono ignorando espacios y guiones", async () => {
    const s = await setup();
    await s.t.run((ctx) =>
      ctx.db.insert("clients", {
        name: "Laura Gómez",
        phone: "600 123 456",
        email: "laura@test.es",
        channel: "llamada",
        saleStatus: "interesado",
        priority: "media",
        createdAt: 1,
      }),
    );
    const find = (term: string) => s.as.query(api.clients.searchForPicker, { term });
    expect(await find("gómez")).toHaveLength(1);
    expect(await find("LAURA@")).toHaveLength(1);
    expect(await find("600-123")).toHaveLength(1);
    expect(await find("123456")).toHaveLength(1);
    expect(await find("zzz")).toHaveLength(0);
  });

  test("sin sesión devuelve vacío sin filtrar datos", async () => {
    const s = await setup();
    await seedClients(s, 3);
    expect(await s.t.query(api.clients.searchForPicker, { term: "cliente" })).toEqual([]);
  });
});

describe("clients.lookup", () => {
  test("cliente existente: devuelve la proyección", async () => {
    const s = await setup();
    await seedClients(s, 1);
    const id = (await s.t.run((ctx) => ctx.db.query("clients").first()))!._id;
    const row = await s.as.query(api.clients.lookup, { id });
    expect(row).toEqual({ _id: id, name: "Cliente 0", phone: "600000000", saleStatus: "presupuesto" });
  });

  test("id malformado, de otra tabla o inexistente devuelve null (sin lanzar)", async () => {
    const s = await setup();
    const userId = (await s.t.run((ctx) => ctx.db.query("users").first()))!._id as Id<"users">;
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
    for (const id of ["no-es-un-id", "", userId as string, gone as string]) {
      expect(await s.as.query(api.clients.lookup, { id })).toBeNull();
    }
  });

  test("sin sesión devuelve null", async () => {
    const s = await setup();
    await seedClients(s, 1);
    const id = (await s.t.run((ctx) => ctx.db.query("clients").first()))!._id;
    expect(await s.t.query(api.clients.lookup, { id })).toBeNull();
  });
});
