New component, added 2026-07-22 for F12 — Resumen del negocio (Miriam's dashboard). Per the dataviz skill's form heuristic, "a handful of headline numbers" is a KPI row of stat tiles, not a chart — F12's five metrics (clientes activos, ventas cerradas, clientes nuevos, leads en proceso, tareas pendientes) are all single current values with no trend/comparison data in the PRD, so this ships as the plain value+label contract with no delta or sparkline (no data to back either yet — add them if F12 ever gains historical tracking).

```jsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)" }}>
  <StatTile label="Clientes activos" value={128} />
  <StatTile label="Ventas cerradas" value={9} caption="este mes" />
</div>
```

Text-only by design (no icon, no color-coded tone) — these are neutral business counts, not status; coloring them would borrow the sale/claim/priority semantic palette for something that isn't a state. Lay tiles out in a CSS grid directly in the screen, same pattern as `SectionCard` composition — no dedicated "KPI row" wrapper component since the grid is one line of inline style and doesn't earn a primitive of its own.
