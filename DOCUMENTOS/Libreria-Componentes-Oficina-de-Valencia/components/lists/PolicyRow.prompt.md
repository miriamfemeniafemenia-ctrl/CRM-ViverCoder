New component, added 2026-07-22 to close a gap flagged in the PRD audit: F3/D5 (Pólizas) had `StatusBadge domain="policy"` since Mejora 3 (2026-07-21), but no row to put it in — the only MVP data entity without one, unlike `ClaimRow`/`ClientRow`/`ReminderItem`.

```jsx
<PolicyRow policyType="Seguro de auto" insurer="Mapfre" policyNumber="A-88291" policyStatus="activa" onClick={() => openPolicy(id)} />
```

Lives inside a client's ficha (P3's "Pólizas contratadas" block) — unlike `ClaimRow`, which spans every client in P5's panel, it doesn't take a `clientName` prop, since the client is already the page. Same row family as `ClaimRow`: 40px height, baseline-aligned type + meta text, `StatusBadge` on the right, `divider={false}` on the last row of a list.
