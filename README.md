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
  schema.ts              — D1-D5 del PRD (clients, contacts, reminders, claims, policies) + users
src/
  app/                   — rutas (App Router), ver mapa de rutas abajo
  components/            — componentes de UI, a portar desde el design system
                            "Oficina de Valencia" (Claude Design)
  lib/
    convex-client-provider.tsx
    utils.ts             — helper cn() (clsx + tailwind-merge)
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
pantalla real.

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

### Autenticación (ARC-7, reabierto)

Pendiente de decidir el enfoque concreto (Convex Auth, o un login propio
contra la tabla `users`) antes de construir `/login` de verdad — de momento
solo hay un placeholder. Son 3 cuentas fijas (Miriam, Mónica, Antonio), sin
auto-registro.

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
