Icon + message for any list with nothing to show. Three icons cover the MVP's empty-list moments: `check` (no pending reminders), `search` (no matching clients), `claim` (no open siniestros).

```jsx
<EmptyState icon="check" message="No tienes recordatorios pendientes hoy" />
<EmptyState icon="search" message="No se han encontrado clientes" />
```

Used directly in P1 when there are no reminders for today/vencidos ("la pantalla lo indica claramente" per the PRD), and in P2/P5 when a search or filter returns nothing. `action` is optional — pass a `Button` if the empty state should also offer a way out (e.g. "Nuevo cliente").
