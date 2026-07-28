Underline tabs — active tab gets brand-blue text and a 2px bottom border; inactive tabs are neutral. Optional numeric count badge per tab, using the same pill styling as `MainNav`'s count badges for visual consistency.

```jsx
<Tabs
  items={[
    { key: "monica", label: "Mónica", count: 3 },
    { key: "antonio", label: "Antonio", count: 0 },
    { key: "miriam", label: "Miriam" },
  ]}
  active={activeUser}
  onChange={setActiveUser}
/>
```

Added 2026-07-19 for P1 — Mis tareas de hoy (ARC-39 / CRM-PRD update 2026-07-16), which needs two tab groups: per-user tabs (Mónica/Antonio/Miriam) and a "Hoy" vs "Próximas" split. Same component covers both — it's a generic `items`/`active`/`onChange` list, not user-specific. Scrolls horizontally on overflow rather than wrapping, so it stays usable on narrow mobile widths with three-plus tabs.
