Compact 40px table row for P2 — Lista de clientes: client name and current sale-pipeline status, nothing else. Tap/click anywhere to open the client's ficha (P3).

```jsx
<ClientRow name="Laura Gómez" saleStatus="presupuesto" priority="alta" onClick={() => openClient(id)} />
```

Set `divider={false}` on the last row of a list to drop the trailing hairline. Hover tints the row with `--surface-sunken`; press applies the shared `scale(0.97)` feedback.

**Priority (added 2026-07-19):** `priority` renders a small 8px dot before the name — `"alta"` reuses `--color-warning-border` (same "needs attention" semantic already used for overdue reminders, just a different context), `"media"` is a plain neutral-400 dot, and `"baja"`/omitted renders nothing at all. Deliberately not a full `StatusBadge`: per the CRM changelog (Mejora 1, 2026-06-30) only "alta" needs to stand out — giving all three equal visual weight would compete with the sale-status badge that's the row's actual focal point.

**`subtitle` / `action` (added 2026-07-22, for F9 — Clientes fríos and F13 — Alertas de sin seguimiento):** both are opt-in and leave the default P2 row untouched.

```jsx
<ClientRow
  name="Laura Gómez"
  saleStatus="interesado"
  subtitle="23 días sin contacto"
  action={<Button variant="secondary" size="compact">Registrar contacto</Button>}
  onClick={() => openClient(id)}
/>
```

`subtitle` prints as a small tertiary-color second line under the name and grows the row to an auto height (56px+) instead of the fixed 40px — only when passed, so plain P2 rows are unaffected. `action` renders after the badges and swallows its own clicks (`stopPropagation`) so a button inside it never also fires the row's `onClick` navigation. Not reused for P2 itself: F9/F13 are the only two screens that need a per-row action or a metadata line — if a third screen wants this shape, keep using these two props rather than inventing new ones.
