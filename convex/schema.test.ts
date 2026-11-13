// Pruebas del esquema ampliado de `clients` (ARC-49, PR A): dirección parcial
// con los 6 subcampos opcionales (lib/addressFields.ts), `updatedAt` opcional y
// los índices nuevos `by_postalCode` y `by_dni`. Escriben directamente con
// `ctx.db` porque esta PR solo cambia el esquema, no las mutations.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";

const base = {
  channel: "web" as const,
  saleStatus: "interesado" as const,
  priority: "media" as const,
  createdAt: 1_700_000_000_000,
};

describe("esquema de clients (ARC-49)", () => {
  test("acepta clientes sin dirección, con dirección parcial y con dirección completa", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const sin = await ctx.db.insert("clients", { ...base, name: "Sin dirección" });
      const parcial = await ctx.db.insert("clients", {
        ...base,
        name: "Parcial",
        address: { postalCode: "46001", floorDoor: "3ºB" },
      });
      const completa = await ctx.db.insert("clients", {
        ...base,
        name: "Completa",
        address: {
          street: "Calle Colón",
          number: "10",
          floorDoor: "2ª",
          postalCode: "46004",
          city: "Valencia",
          province: "Valencia",
        },
        updatedAt: base.createdAt,
      });
      expect((await ctx.db.get(sin))?.address).toBeUndefined();
      expect((await ctx.db.get(parcial))?.address).toEqual({ postalCode: "46001", floorDoor: "3ºB" });
      expect((await ctx.db.get(completa))?.updatedAt).toBe(base.createdAt);
    });
  });

  test("by_postalCode encuentra solo los clientes con ese código y no los que no tienen dirección", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("clients", { ...base, name: "A", address: { postalCode: "46001", city: "Valencia" } });
      await ctx.db.insert("clients", { ...base, name: "B", address: { postalCode: "46001" } });
      await ctx.db.insert("clients", { ...base, name: "C", address: { postalCode: "28001" } });
      await ctx.db.insert("clients", { ...base, name: "D" });
      await ctx.db.insert("clients", { ...base, name: "E", address: { city: "Sin código" } });

      const en46001 = await ctx.db
        .query("clients")
        .withIndex("by_postalCode", (q) => q.eq("address.postalCode", "46001"))
        .collect();
      expect(en46001.map((c) => c.name).sort()).toEqual(["A", "B"]);
    });
  });

  test("by_dni encuentra el cliente por su DNI", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("clients", { ...base, name: "Con DNI", dni: "12345678Z" });
      await ctx.db.insert("clients", { ...base, name: "Sin DNI" });
      const found = await ctx.db
        .query("clients")
        .withIndex("by_dni", (q) => q.eq("dni", "12345678Z"))
        .collect();
      expect(found.map((c) => c.name)).toEqual(["Con DNI"]);
    });
  });
});
