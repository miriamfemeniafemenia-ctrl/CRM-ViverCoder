Checkbox — a real native `<input type="checkbox">` visually hidden (so keyboard/screen-reader behavior is free), paired with a custom 20px box that shows a check mark and the brand-blue fill when checked, plus a focus ring when tabbed to.

```jsx
<Checkbox label="Crear recordatorio de seguimiento" checked={createReminder} onChange={setCreateReminder} />
```

Added 2026-07-19 for the "Registrar contacto" sub-screen (ARC-43), whose optional "crear recordatorio" toggle reveals the reminder fields inline when checked — this was the only screen in the CRM-PRD that needed a checkbox. The clickable `<label>` has `minHeight: var(--tap-target-min)` even though the visual box stays small, so the touch target still meets the same responsive 44px/36px rule as every other control.
