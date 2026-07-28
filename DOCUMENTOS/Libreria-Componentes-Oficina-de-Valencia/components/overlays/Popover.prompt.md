Generic anchored panel — the primitive behind any "click a trigger, get a small floating panel" pattern: a row's "…" action menu, or P1's "Fecha de vencimiento" filter. Closes on outside click or Escape. Uses `--shadow-md` (the elevation tier reserved for dropdowns/popovers) and `--radius-md`.

```jsx
<Popover trigger={<Button variant="text" size="compact">Fecha de vencimiento ▾</Button>} align="start">
  <Button variant="text" size="compact" onClick={() => { setFilter("todas"); }} style={{width:"100%",justifyContent:"flex-start"}}>Todas</Button>
  <Button variant="text" size="compact" onClick={() => { setFilter("vencidas"); }} style={{width:"100%",justifyContent:"flex-start"}}>Vencidas</Button>
</Popover>
```

Unopinionated about content — it doesn't render menu items itself, just the positioned/dismissible panel. Compose it with `Button variant="text"` rows for a menu, or any other controls for a filter panel. Pass `open`/`onOpenChange` only if the trigger needs to be controlled from outside (e.g. closing after a selection); otherwise it manages its own state.
