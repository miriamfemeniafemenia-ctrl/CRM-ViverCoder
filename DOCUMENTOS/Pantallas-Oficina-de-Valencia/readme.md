# Pantallas — Oficina de Valencia (export 2026-07-23)

Export de las 5 pantallas construidas hasta ahora sobre el design system Oficina de Valencia:

- `screens/f6-alertas-renovacion.html` — F6, Alertas de renovación (ARC-27)
- `screens/f9-clientes-frios.html` — F9, Clientes fríos (ARC-28)
- `screens/f12-resumen-del-negocio.html` — F12, Resumen del negocio (ARC-29)
- `screens/f13-alertas-sin-seguimiento.html` — F13, Alertas de sin seguimiento (ARC-30)
- `screens/p6-posibles-clientes.html` — P6, Posibles clientes (F14 / Mejora 5)

Incluye `styles.css` y `tokens/` para que las pantallas tengan los colores/tipografía correctos.

## ⚠️ Aviso importante: estas pantallas NO se ejecutarán solas en un navegador

Cada pantalla carga `../_ds_bundle.js` — el bundle compilado con el código de todos los componentes — que **no está incluido** en este export, por dos motivos:

1. Es un artefacto autogenerado por Claude Design (~74 KB), no código fuente; copiarlo a mano a este tamaño arriesga corrupciones (ya me pasó una vez con un hash de integridad más corto, y lo corregí, pero este archivo es mucho más largo).
2. **Más importante: el bundle del proyecto está desactualizado.** Su manifiesto interno solo registra 21 componentes — no incluye `StatTile`, `PolicyRow`, `AffectedPartyRow` ni `SortToggle`, los cuatro que se añadieron en la sesión del 22 de julio. Eso significa que **F9 (usa `SortToggle`) y F12 (usa `StatTile`) probablemente tampoco se estén renderizando bien ahora mismo dentro del propio proyecto de Claude Design** — no es solo un problema de este export, sino del proyecto en sí, hasta que Claude Design recompile el bundle.

**Qué hacer:** abre el proyecto directamente en claude.ai/design (no a través de estos archivos sueltos) — eso normalmente dispara la recompilación automática del bundle. Si después de abrirlo las pantallas F9/F12 se siguen viendo mal, dímelo y lo investigamos con más detalle.

Estos 5 archivos `.html` sí son útiles para **leer el código** (marcado, props, estructura) tal y como están, incluso sin poder ejecutarlos — cada uno es HTML+JSX legible y comentado con el ticket/función que cubre.
