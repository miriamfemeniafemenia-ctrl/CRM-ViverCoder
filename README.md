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

**Reseteo manual de contraseña** (no hay recuperación automática con solo 3
cuentas — pasos para quien tenga acceso al deployment de Convex, p. ej.
Miriam):
1. Entra al [dashboard de Convex](https://dashboard.convex.dev) → el
   proyecto `oficina-valencia` → pestaña **Functions**.
2. Ejecuta manualmente una función que llame a
   `modifyAccountCredentials(ctx, { provider: "password", account: { id: emailNormalizado, secret: nuevaContraseña } })`
   (de `@convex-dev/auth/server`) — hoy no existe como función lista para
   ejecutar desde el dashboard; lo más simple es pedir a quien tenga el
   repo que añada temporalmente una `internalMutation`/`internalAction` con
   esa llamada (igual que `convex/seed.ts`), ejecutarla una vez vía
   `npx convex run`, y borrarla después. No hay UI para esto — está fuera
   de alcance de ARC-7 a propósito (sin panel de administración).
3. Comunica la nueva contraseña a la persona por un canal que no sea este
   tipo de chat/historial persistente.

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
