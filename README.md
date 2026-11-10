# Arco Seguros CRM

CRM de clientes, ventas y siniestros para una correduría de seguros. Implementa
el MVP descrito en el PRD de Notion ("CRM-PRD") y planificado en Linear
(equipo **ARC**).

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Convex** como base de datos / backend (`convex/schema.ts`)
- Despliegue en **Railway**, repositorio en **GitHub**

> `AGENTS.md`/`CLAUDE.md` en la raíz avisan de que esta versión de Next.js
> puede diferir de lo que un asistente conoce por defecto — antes de escribir
> código nuevo, revisa `node_modules/next/dist/docs/`.

## Estructura de carpetas

```
convex/
  schema.ts              — D1-D5 del PRD (clients, contacts, reminders, claims, policies) + users + authTables
  auth.ts                — configuración de Convex Auth (provider Password, guard anti-signup)
  auth.config.ts         — config del proveedor JWT de Convex Auth
  seed.ts                — internalAction: aprovisiona las 3 cuentas fijas
  users.ts               — query `current`: usuario autenticado
  http.ts                — rutas HTTP de Convex Auth
src/
  app/                   — rutas (App Router), ver mapa de rutas abajo
  components/            — componentes de UI, a portar desde el design system
                            "Oficina de Valencia" (Claude Design)
  lib/
    convex-client-provider.tsx
    utils.ts             — helper cn() (clsx + tailwind-merge)
  proxy.ts               — protege todas las rutas salvo /login (Next.js 16: proxy.ts, no middleware.ts)
  types/
    index.ts             — tipos de dominio compartidos
  hooks/                 — hooks compartidos (vacío por ahora)
```

## Mapa de rutas (ARC-8)

| Ruta                    | Pantalla                     | Función(es)             |
| ------------------------ | ----------------------------- | ------------------------- |
| `/`                     | P1 — Mis tareas de hoy        | F5                        |
| `/login`                | Login — Acceso                | Mejora 6                  |
| `/clientes`             | P2 — Lista de clientes        | F2                        |
| `/clientes/nuevo`        | P4 — Nuevo cliente            | F1                        |
| `/clientes/[id]`         | P3 — Ficha de cliente         | F1, F3, F4, F7, F8, F10   |
| `/clientes/[id]/editar`  | P4 — Editar cliente           | F1                        |
| `/posibles-clientes`     | P6 — Posibles clientes        | F14 (Mejora 5)            |
| `/siniestros`            | P5 — Panel de siniestros      | F11                       |
| `/siniestros/[id]`       | Ficha de siniestro (detalle)  | F10 (Mejora 4)            |

Las sub-pantallas (Registrar contacto, Nuevo/editar recordatorio, Añadir
siniestro, Añadir póliza) son overlays (`Modal`/`BottomSheet`) que se abren
desde P3 — no tienen ruta propia, según el PRD.

Cada `page.tsx` es ahora mismo un `ScreenPlaceholder`
(`src/components/screen-placeholder.tsx`) — quítalo en cuanto se porte la
pantalla real. `/login` ya es una pantalla real (ARC-7); el resto sigue
pendiente y ahora está protegido por `src/proxy.ts` (redirige a `/login` si
no hay sesión).

## Diseño

Los tokens de `src/app/globals.css` están portados 1:1 del design system
**Oficina de Valencia** (proyecto Claude Design
`a871c705-9284-40a7-a6c0-014faf584070`): colores (OKLCH), tipografía (Inter),
espaciado, radios y sombras. Úsalos vía las clases de Tailwind que genera
`@theme` (`bg-primary-500`, `text-body`, `rounded-md`, `shadow-md`, …) o
directamente como `var(--color-...)` si necesitas algo que Tailwind no cubre.

Al portar un componente desde Claude Design (`components/*.jsx` en ese
proyecto), su prop shape y su lógica deberían trasladarse casi sin cambios —
solo cambia de JSX-en-HTML-con-Babel a un componente React/TSX normal.

## Empezar a desarrollar

```bash
npm install
npm run dev
```

### Conectar Convex

1. `npx convex dev` — pide login (abre el navegador) la primera vez, crea el
   proyecto en Convex y escribe `NEXT_PUBLIC_CONVEX_URL`/`CONVEX_DEPLOYMENT`
   directamente en `.env.local` (cópialo antes desde `.env.example` si no
   existe). Déjalo corriendo en una terminal aparte mientras desarrollas: sube
   el schema y las funciones a medida que las guardas.
2. El schema ya está en `convex/schema.ts` — `npx convex dev` lo desplegará
   en cuanto lo detecte.

### Autenticación (ARC-7) — implementada y verificada en vivo (2026-08-04)

Implementada con **Convex Auth** (`@convex-dev/auth`), provider `Password`
(email + contraseña), sin registro público: son 3 cuentas fijas (Miriam,
Mónica, Antonio). El auto-registro se bloquea en el `profile` callback del
provider (`convex/auth.ts`), no en un callback global — así el seed de las 3
cuentas (que usa `createAccount` directamente) no se autobloquea. Detalle
completo verificado contra el código fuente de la librería en el plan
`ARC-7 — Sistema de autenticación real`.

**Estado actual**: el deployment dev (`wary-stork-704`) ya tiene el schema
desplegado, las claves JWT configuradas (`JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL`)
y las 3 cuentas sembradas. Verificado end-to-end en el navegador y por HTTP
directo: login/logout reales, redirección de rutas protegidas sin sesión,
bloqueo de auto-registro contra el backend real, y banner de error con
credenciales incorrectas.

**⚠️ Higiene pendiente antes de manejar datos reales de clientes:**
- Las 3 contraseñas iniciales se escribieron en un chat para poder
  sembrarlas — trátalas como comprometidas. Rótalas (ver procedimiento de
  reseteo abajo) tras el primer login de cada persona, o al menos antes de
  que este deployment maneje datos reales de clientes.
- `JWT_PRIVATE_KEY` quedó expuesto una vez en texto plano al listar
  variables de entorno con `npx convex env list` — ya se regeneró y rotó
  (la clave expuesta no está en uso), pero evita `env list` para variables
  sensibles en el futuro; usa `env get NOMBRE` una a una, o revisa solo los
  nombres.

**Restablecer la contraseña de una cuenta (ARC-75)** — no hay recuperación
automática ni pantalla en la app. Existe una función interna permanente,
`adminAuth:resetPassword` (`convex/adminAuth.ts`), que solo se puede lanzar con
`npx convex run` (acceso administrativo a Convex), nunca desde la app. Solo
acepta las 3 cuentas fijas (los emails de `SEED_MIRIAM_EMAIL`,
`SEED_MONICA_EMAIL` y `SEED_ANTONIO_EMAIL`).

**Qué garantiza y qué no.** Tras el reset, la contraseña antigua deja de valer y
se borran las sesiones y los refresh tokens de la cuenta: no se pueden abrir ni
renovar sesiones con la credencial anterior. Las sesiones invalidadas **no se
cierran al instante**: una pestaña ya autenticada puede seguir funcionando
hasta que caduque su token de acceso (1 hora por defecto en
`@convex-dev/auth` 0.0.94). Es un riesgo aceptado para este ticket.

**La contraseña nueva jamás se copia en el chat, en argumentos de comandos, en
el historial del terminal, en logs ni en capturas.** Va en la variable de
entorno `RESET_PASSWORD` de Convex, cargada de forma interactiva, y se borra al
terminar. Procedimiento (en el deployment que toque; añade `--prod` para
producción):
1. Carga la variable **sin escribir el valor en la línea de comandos**:
   `npx convex env set RESET_PASSWORD` (sin valor: la CLI lo pide de forma
   interactiva y no queda en el historial), o desde el panel web de Convex
   (Settings → Environment Variables). Mínimo 8 caracteres.
2. Ejecuta (solo el email va en el comando):
   `npx convex run adminAuth:resetPassword "{\"email\":\"<correo de la cuenta>\"}"`.
   Guarda el `requestId` de la respuesta.
3. **Anota en Linear, en el ARC-75, justo ahora** (no de memoria después): fecha,
   hora, `requestId` y resultado (A, B o C, ver abajo). Sin correo, contraseña,
   hash, token ni valores de entorno.
4. Borra la variable: `npx convex env remove RESET_PASSWORD`, y comprueba que ya
   no está sin enumerar valores (no uses `env list` ni `env get`):
   `npx convex run adminAuth:estadoRestablecimiento` debe devolver
   `contrasenaConfigurada: false`.
5. Comunica la contraseña a la persona por un canal que no sea un chat o historial
   persistente, y guárdala en un gestor de contraseñas.

**Resultados.** La respuesta distingue siempre tres casos:
- **A. Completado**: `{ ok: true, requestId }`. Contraseña cambiada, sesiones y
  refresh tokens a 0, auditoría `completado`. Si la respuesta trae
  `registrosSupersedidos`, se han marcado como inconclusos los registros previos
  sin resolver.
  - Si trae `historialPrevioPendiente: true` (el reset sí está completado, pero no
    se pudo marcar el historial previo): ejecuta
    `npx convex run adminAuth:supersederPrevios "{\"requestId\":\"<requestId>\"}"`
    con **el `requestId` de la respuesta** (nunca de memoria) y repítelo con el
    mismo `requestId` si falla; es idempotente.
- **B. Restablecimiento seguro completado, auditoría pendiente**:
  `{ ok: true, auditoriaPendiente: true, requestId }`. La contraseña ya cambió y
  las sesiones están a 0, pero el registro no pudo cerrarse. Anótalo en Linear
  con su `requestId` y **repite el procedimiento completo** (pasos 1-4): el nuevo
  reset deja el registro anterior como `inconcluso_supersedido`. No hay ningún
  «reparar»: la auditoría no afirma lo que no puede demostrar.
- **C. Sesiones NO invalidadas**: la función lanza «CONTRASEÑA CAMBIADA pero las
  sesiones NO se han invalidado». Vuelve a ejecutar `resetPassword` (idempotente)
  y comprueba que acaba en A. Hasta entonces, no declares la operación terminada.

**Auditoría.** Cada reset deja un registro en la tabla `passwordResetAudit`
(sin contraseña, hash, token, valor de entorno ni email; solo `userId`,
`requestId`, estado y recuentos). `npx convex run` no identifica a la persona
que lo lanza, así que el campo `executor` es fijo: la atribución personal se
cubre con la anotación en Linear del paso 3.

**Copia de seguridad antes de tocar producción.** Antes del primer reset en
producción, exporta los datos (`npx convex export --prod --path <ubicación>`) a
una ubicación cifrada y controlada, fuera del repositorio y de carpetas
sincronizadas. El export es **recuperación ante desastre**, no un «deshacer» de
una contraseña: restaurarlo revertiría también clientes, recordatorios y
cualquier cambio posterior.

**Regla de seguridad para todo lo que se construya a partir de aquí
(ARC-8 y P1–P6)**: proteger rutas con `src/proxy.ts` protege la
**navegación**, no sustituye la autorización dentro de Convex. Ninguna
query/mutation pública sobre `clients`/`contacts`/`reminders`/`claims`/
`policies` debe publicarse sin validar `getAuthUserId(ctx)` al principio
(devolviendo `null`/lanzando si no hay sesión), más cualquier chequeo de rol
u ownership que aplique. `convex/users.ts` (`current`) ya sigue este patrón
— úsalo como referencia.

**Para ARC-8 (shell de navegación)**: `useAuthActions().signOut()` (de
`@convex-dev/auth/react`) ya está disponible — reutilízalo en el botón de
cerrar sesión en vez de reimplementar nada.

## Subir a GitHub

Este repo está inicializado localmente pero **no tiene remoto todavía**.
Cuando quieras subirlo:

```bash
git add -A && git commit -m "..."
gh repo create <nombre> --private --source=. --remote=origin
git push -u origin main
```

## Desplegar en Railway

`railway.toml` ya está configurado (build con Nixpacks, `npm run build` /
`npm run start`). En el dashboard de Railway, conecta el repo de GitHub y
define `NEXT_PUBLIC_CONVEX_URL` (el de la Convex **deployment de producción**,
vía `npx convex deploy`) como variable de entorno — no se guarda en el repo.
