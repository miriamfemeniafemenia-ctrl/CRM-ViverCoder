// Comprobaciones del manifiesto de acceso (ARC-49). Lógica pura, sin E/S: la
// usan scripts/check-access-manifest.mjs (línea de comandos) y sus pruebas
// (scripts/access-check.test.mjs).
//
// A) Despliegue frente a manifiesto: la salida JSON de `npx convex
//    function-spec` contra convex/access-manifest.json. Falla si hay una
//    función pública o ruta HTTP sin declarar, si el manifiesto declara algo
//    que no está desplegado, o si un guard no es válido.
// B) Código frente a manifiesto, con el AST de TypeScript (los comentarios y el
//    texto no cuentan): cada función con guard `getTeamUser`/`requireTeamUser`
//    debe empezar su handler EXACTAMENTE con ese guard, antes de cualquier
//    otra sentencia (y por tanto antes de cualquier uso de `ctx`). No sustituye
//    a la revisión humana del diff.
import ts from "typescript";

export const TEAM_GUARDS = new Set(["getTeamUser", "requireTeamUser"]);
export const VALID_GUARDS = new Set([...TEAM_GUARDS, "convex-auth"]);
const PUBLIC_REGISTRARS = new Set(["query", "mutation", "action", "httpAction"]);

// ---------------------------------------------------------------------------
// A) function-spec frente a manifiesto

export function checkSpecAgainstManifest(spec, manifest) {
  const errors = [];
  const declared = manifest.functions ?? {};
  const declaredRoutes = manifest.httpRoutes ?? {};

  for (const [id, guard] of Object.entries(declared)) {
    if (!VALID_GUARDS.has(guard)) errors.push(`${id}: guard no válido «${guard}»`);
  }
  for (const [route, guard] of Object.entries(declaredRoutes)) {
    if (guard !== "convex-auth") errors.push(`${route}: guard de ruta HTTP no válido «${guard}»`);
  }

  const deployedPublic = new Set();
  const deployedRoutes = new Set();
  for (const f of spec.functions ?? []) {
    if (f.functionType === "HttpAction") {
      deployedRoutes.add(`${f.method} ${f.path}`);
    } else if (f.visibility?.kind === "public") {
      deployedPublic.add(f.identifier);
    }
  }

  for (const id of deployedPublic) {
    if (!(id in declared)) errors.push(`${id}: función pública desplegada que no está en el manifiesto`);
  }
  for (const id of Object.keys(declared)) {
    if (!deployedPublic.has(id)) errors.push(`${id}: está en el manifiesto pero no es una función pública desplegada`);
  }
  for (const route of deployedRoutes) {
    if (!(route in declaredRoutes)) errors.push(`${route}: ruta HTTP desplegada que no está en el manifiesto`);
  }
  for (const route of Object.keys(declaredRoutes)) {
    if (!deployedRoutes.has(route)) errors.push(`${route}: está en el manifiesto pero no está desplegada`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// B) Código frente a manifiesto (AST)

function unwrapAwaitCall(expr) {
  if (!expr || !ts.isAwaitExpression(expr)) return null;
  const call = expr.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
  return call;
}

function isGuardCall(call, guard, ctxName) {
  return (
    call !== null &&
    call.expression.text === guard &&
    call.arguments.length === 1 &&
    ts.isIdentifier(call.arguments[0]) &&
    call.arguments[0].text === ctxName
  );
}

// `const x = await guard(ctx);` → nombre de la variable, o null.
function guardDeclaration(stmt, guard, ctxName) {
  if (!ts.isVariableStatement(stmt)) return null;
  const decls = stmt.declarationList.declarations;
  if (decls.length !== 1 || !ts.isIdentifier(decls[0].name)) return null;
  return isGuardCall(unwrapAwaitCall(decls[0].initializer), guard, ctxName) ? decls[0].name.text : null;
}

// `if (x === null) return …;` o `if (!x) return …;`, sin else.
function isNullReturnCheck(stmt, varName) {
  if (!stmt || !ts.isIfStatement(stmt) || stmt.elseStatement) return false;
  const cond = stmt.expression;
  const checksNull =
    (ts.isBinaryExpression(cond) &&
      cond.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isIdentifier(cond.left) &&
      cond.left.text === varName &&
      cond.right.kind === ts.SyntaxKind.NullKeyword) ||
    (ts.isPrefixUnaryExpression(cond) &&
      cond.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isIdentifier(cond.operand) &&
      cond.operand.text === varName);
  if (!checksNull) return false;
  const then = stmt.thenStatement;
  if (ts.isReturnStatement(then)) return true;
  return ts.isBlock(then) && then.statements.length === 1 && ts.isReturnStatement(then.statements[0]);
}

function checkHandler(id, guard, handler) {
  if (!handler || !(ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
    return [`${id}: no se encuentra un handler función`];
  }
  const param = handler.parameters[0];
  if (!param || !ts.isIdentifier(param.name)) return [`${id}: el handler no recibe ctx`];
  const ctxName = param.name.text;
  if (!handler.body || !ts.isBlock(handler.body) || handler.body.statements.length === 0) {
    return [`${id}: el handler no tiene cuerpo`];
  }
  const [first, second] = handler.body.statements;

  if (guard === "requireTeamUser") {
    const ok =
      (ts.isExpressionStatement(first) && isGuardCall(unwrapAwaitCall(first.expression), guard, ctxName)) ||
      guardDeclaration(first, guard, ctxName) !== null;
    return ok ? [] : [`${id}: la primera sentencia del handler debe ser \`await requireTeamUser(${ctxName})\``];
  }
  const varName = guardDeclaration(first, guard, ctxName);
  if (varName === null) {
    return [`${id}: la primera sentencia del handler debe ser \`const x = await getTeamUser(${ctxName})\``];
  }
  return isNullReturnCheck(second, varName)
    ? []
    : [`${id}: tras getTeamUser debe ir inmediatamente \`if (${varName} === null) return …;\``];
}

// Exportaciones `export const X = registrar({...})` de un archivo fuente.
function exportedRegistrations(sourceFile) {
  const out = new Map();
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer || !ts.isCallExpression(decl.initializer)) continue;
      const callee = decl.initializer.expression;
      if (!ts.isIdentifier(callee)) continue;
      out.set(decl.name.text, { registrar: callee.text, call: decl.initializer });
    }
  }
  return out;
}

function handlerOf(call) {
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  for (const prop of arg.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === "handler") {
      return prop.initializer;
    }
    if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name) && prop.name.text === "handler") {
      return prop;
    }
  }
  return null;
}

// files: [{ module: "clients", text: "<código>" }] (módulo = nombre del archivo
// en convex/ sin extensión).
export function checkSourceAgainstManifest(files, manifest) {
  const errors = [];
  const declared = manifest.functions ?? {};
  const byModule = new Map();
  for (const f of files) {
    byModule.set(f.module, exportedRegistrations(ts.createSourceFile(`${f.module}.ts`, f.text, ts.ScriptTarget.Latest, true)));
  }

  for (const [id, guard] of Object.entries(declared)) {
    if (!TEAM_GUARDS.has(guard)) continue;
    const [file, name] = id.split(":");
    const moduleName = file.replace(/\.js$/, "");
    const reg = byModule.get(moduleName)?.get(name);
    if (!reg) {
      errors.push(`${id}: no se encuentra \`export const ${name} = …\` en convex/${moduleName}.ts`);
      continue;
    }
    const handler = handlerOf(reg.call);
    if (handler && ts.isMethodDeclaration(handler)) {
      errors.push(`${id}: el handler debe ser una función flecha o expresión de función`);
      continue;
    }
    errors.push(...checkHandler(id, guard, handler));
  }

  // Funciones públicas en el código que no están en el manifiesto.
  for (const [moduleName, regs] of byModule) {
    for (const [name, reg] of regs) {
      if (PUBLIC_REGISTRARS.has(reg.registrar) && !(`${moduleName}.js:${name}` in declared)) {
        errors.push(`${moduleName}.js:${name}: función pública (${reg.registrar}) en el código que no está en el manifiesto`);
      }
    }
  }
  return errors;
}
