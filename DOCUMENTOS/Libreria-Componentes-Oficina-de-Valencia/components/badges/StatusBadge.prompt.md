Uppercase pill badge for pipeline/claim/priority/policy status. One component, four domains — never invent a new status color ad hoc, add it to `tokens/colors.css` first.

```jsx
<StatusBadge domain="sale" status="presupuesto" />
<StatusBadge domain="claim" status="tramitacion" />
<StatusBadge domain="priority" status="alta" />
<StatusBadge domain="policy" status="activa" />
```

`domain="sale"` → `interesado | presupuesto | cerrado | perdido` (4 states). `domain="claim"` → `abierto | tramitacion | resuelto` (3 states). `domain="priority"` → `alta | media | baja` (3 states, Mejora 1). `domain="policy"` → `activa | reemplazada | anulada` (3 states, Mejora 3). Every color pair sits on a hue far from the brand blue and from every other status, so a user can tell states apart by color alone at a glance across a table of rows. `priority` badges commonly appear next to a `sale` badge on the same row (e.g. `ClientRow`) — their hues were chosen to stay distinguishable from all four sale hues too.
