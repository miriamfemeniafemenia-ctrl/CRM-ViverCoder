// @vitest-environment node
// Pruebas de scripts/access-check.mjs (ARC-49): el control de acceso por
// manifiesto tiene que FALLAR ante handlers inválidos (guard tras ctx.db, en
// una rama, helper irrelevante, guard solo en un comentario…) y ante
// diferencias entre el manifiesto y lo desplegado.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkSourceAgainstManifest, checkSpecAgainstManifest } from "./access-check.mjs";

const manifest = (functions, httpRoutes = {}) => ({ version: 1, functions, httpRoutes });
const fn = (identifier, functionType = "Query", kind = "public") => ({
  identifier,
  functionType,
  visibility: { kind },
});

describe("A) function-spec frente a manifiesto", () => {
  const m = manifest(
    { "clients.js:list": "getTeamUser", "auth.js:signIn": "convex-auth" },
    { "GET /.well-known/jwks.json": "convex-auth" },
  );
  const spec = {
    functions: [
      fn("clients.js:list"),
      fn("auth.js:signIn", "Action"),
      fn("seed.js:default", "Action", "internal"),
      { functionType: "HttpAction", method: "GET", path: "/.well-known/jwks.json" },
    ],
  };

  test("coincide: sin errores (las internas se ignoran)", () => {
    expect(checkSpecAgainstManifest(spec, m)).toEqual([]);
  });

  test("función pública desplegada sin declarar", () => {
    const errors = checkSpecAgainstManifest({ functions: [...spec.functions, fn("clients.js:nueva")] }, m);
    expect(errors.join("\n")).toMatch(/clients\.js:nueva: función pública desplegada que no está/);
  });

  test("declarada pero no desplegada (manifiesto de una versión aún no desplegada)", () => {
    const errors = checkSpecAgainstManifest(spec, manifest({ ...m.functions, "clients.js:update": "requireTeamUser" }, m.httpRoutes));
    expect(errors.join("\n")).toMatch(/clients\.js:update: está en el manifiesto pero no es una función pública desplegada/);
  });

  test("guard no válido", () => {
    const errors = checkSpecAgainstManifest(spec, manifest({ ...m.functions, "clients.js:list": "ninguno" }, m.httpRoutes));
    expect(errors.join("\n")).toMatch(/guard no válido/);
  });

  test("rutas HTTP en los dos sentidos", () => {
    const extra = { functions: [...spec.functions, { functionType: "HttpAction", method: "POST", path: "/x" }] };
    expect(checkSpecAgainstManifest(extra, m).join("\n")).toMatch(/POST \/x: ruta HTTP desplegada/);
    const sinRuta = { functions: spec.functions.filter((f) => f.functionType !== "HttpAction") };
    expect(checkSpecAgainstManifest(sinRuta, m).join("\n")).toMatch(/jwks\.json: está en el manifiesto pero no está desplegada/);
  });
});

describe("B) código frente a manifiesto (AST)", () => {
  const check = (text, functions) => checkSourceAgainstManifest([{ module: "m", text }], manifest(functions));
  const q = { "m.js:f": "getTeamUser" };
  const mu = { "m.js:f": "requireTeamUser" };

  test("formas válidas", () => {
    expect(
      check(
        `export const f = query({ args: {}, handler: async (ctx) => {
          const user = await getTeamUser(ctx);
          if (user === null) { return []; }
          return ctx.db.query("clients").collect();
        } });`,
        q,
      ),
    ).toEqual([]);
    expect(
      check(`export const f = query({ handler: async (ctx) => { const u = await getTeamUser(ctx); if (!u) return null; return u; } });`, q),
    ).toEqual([]);
    expect(check(`export const f = mutation({ handler: async (ctx, args) => { await requireTeamUser(ctx); } });`, mu)).toEqual([]);
    expect(
      check(`export const f = mutation({ handler: async (c) => { const user = await requireTeamUser(c); return user._id; } });`, mu),
    ).toEqual([]);
  });

  test("guard después de leer ctx.db", () => {
    const errors = check(
      `export const f = mutation({ handler: async (ctx) => { const x = await ctx.db.get("a"); await requireTeamUser(ctx); return x; } });`,
      mu,
    );
    expect(errors).toHaveLength(1);
  });

  test("guard dentro de una rama (no es la primera sentencia)", () => {
    const errors = check(
      `export const f = mutation({ handler: async (ctx, args) => { if (args.x) { await requireTeamUser(ctx); } return ctx.db.query("c").collect(); } });`,
      mu,
    );
    expect(errors).toHaveLength(1);
  });

  test("helper irrelevante o guard antiguo en lugar del guard del equipo", () => {
    expect(
      check(`export const f = mutation({ handler: async (ctx) => { await getAuthUserId(ctx); } });`, mu),
    ).toHaveLength(1);
    expect(
      check(`export const f = query({ handler: async (ctx) => { const u = await otroHelper(ctx); if (u === null) return []; } });`, q),
    ).toHaveLength(1);
    // Guard de query en una mutation declarada con requireTeamUser.
    expect(
      check(`export const f = mutation({ handler: async (ctx) => { const u = await getTeamUser(ctx); if (!u) return; } });`, mu),
    ).toHaveLength(1);
  });

  test("el guard solo aparece en un comentario o en un texto", () => {
    expect(
      check(
        `export const f = mutation({ handler: async (ctx) => {
          // await requireTeamUser(ctx);
          return ctx.db.query("c").collect();
        } });`,
        mu,
      ),
    ).toHaveLength(1);
    expect(
      check(`export const f = mutation({ handler: async (ctx) => { "await requireTeamUser(ctx)"; } });`, mu),
    ).toHaveLength(1);
  });

  test("guard llamado con otro argumento que no es el ctx del handler", () => {
    expect(
      check(`export const f = mutation({ handler: async (ctx) => { await requireTeamUser(otroCtx); } });`, mu),
    ).toHaveLength(1);
  });

  test("getTeamUser sin la comprobación de null inmediatamente después", () => {
    expect(
      check(
        `export const f = query({ handler: async (ctx) => { const u = await getTeamUser(ctx); const all = await ctx.db.query("c").collect(); if (u === null) return []; return all; } });`,
        q,
      ),
    ).toHaveLength(1);
    expect(
      check(`export const f = query({ handler: async (ctx) => { const u = await getTeamUser(ctx); if (u === null) { log(); return []; } } });`, q),
    ).toHaveLength(1);
    expect(
      check(`export const f = query({ handler: async (ctx) => { const u = await getTeamUser(ctx); if (u === null) return []; else return 1; } });`, q),
    ).toHaveLength(1);
  });

  test("función del manifiesto que no está en el código", () => {
    expect(check(`export const g = query({ handler: async (ctx) => {} });`, { ...q }).join("\n")).toMatch(
      /m\.js:f: no se encuentra/,
    );
  });

  test("función pública en el código que no está en el manifiesto", () => {
    const errors = check(
      `export const f = query({ handler: async (ctx) => { const u = await getTeamUser(ctx); if (u === null) return []; } });
       export const nueva = mutation({ handler: async (ctx) => {} });
       export const interna = internalMutation({ handler: async (ctx) => {} });`,
      q,
    );
    expect(errors).toEqual(["m.js:nueva: función pública (mutation) en el código que no está en el manifiesto"]);
  });

  test("el código real de convex/ cumple el manifiesto real", () => {
    const real = JSON.parse(readFileSync("convex/access-manifest.json", "utf8"));
    const files = readdirSync("convex")
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts") && f !== "schema.ts")
      .map((f) => ({ module: f.replace(/\.ts$/, ""), text: readFileSync(join("convex", f), "utf8") }));
    expect(checkSourceAgainstManifest(files, real)).toEqual([]);
  });
});
