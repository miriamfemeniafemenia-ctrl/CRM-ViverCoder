Selectable pill filter — a single toggleable chip, not a full dropdown. Active state fills with the lightest primary tint and a brand-blue border/text; inactive is a plain neutral outline.

```jsx
{["Todos", "Abierto", "En tramitación", "Resuelto"].map(s => (
  <FilterChip key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
))}
```

Added 2026-07-19 for P5 — Panel de siniestros (ARC-46), whose "filtrar por estado" requirement needs a row of clickable filter pills. Deliberately a new component rather than reusing `StatusBadge`: `StatusBadge` is a fixed-mapping status *display* (its `status` prop only accepts the real sale/claim status values and isn't clickable), while a filter needs an arbitrary, click-toggleable list including a "Todos" option that isn't a status at all. Conflating the two would make `StatusBadge` do two unrelated jobs.
