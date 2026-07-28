New component, added 2026-07-22 to close a gap flagged in the PRD audit: D4's "partes afectadas" (Mejora 4, ARC-54/55 — Done in Linear) had no row component here. The Reconciliación 2026-07-21 note assumed this would be assembled from loose `TextField`/`SectionCard` primitives, but a repeating list of people is exactly the shape every other list entity in this system already gets its own row for (`ClientRow`, `ClaimRow`, `ReminderItem`, `PolicyRow`) — this closes that one inconsistency rather than leaving affected parties as the exception.

```jsx
<AffectedPartyRow name="Manuel Ortiz" phone="600 123 456" email="manuel@correo.com"
  onEdit={() => editParty(id)} onRemove={() => removeParty(id)} />
```

Lives inside "Ficha de siniestro" (the sub-screen detail view, not yet built) alongside the siniestro's own follow-up notes. No `onClick` on the row itself — it's a leaf edit target, not a link to another screen. `divider={false}` on the last row, same convention as every other list row here.
