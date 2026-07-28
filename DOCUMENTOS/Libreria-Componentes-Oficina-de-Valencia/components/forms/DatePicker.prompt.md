Custom on-brand calendar popover — month/year header with prev/next navigation, a Monday-first day grid, today marked with a focus-color ring, the selected day filled solid brand blue. Built on the existing `Popover` component, so it stays zero-runtime-dependency (only native `Date`, no calendar library).

```jsx
<DatePicker label="Fecha del recordatorio" value={date} onChange={setDate} min={today} />
```

Used in the "Nuevo recordatorio" sub-screen (D3's fecha field). External API (`label`, `value`, `onChange`, `error`, `disabled`, `min`, `max`) is unchanged from the previous native-input version, so existing call sites don't need updating.

**History:** originally wrapped the native `<input type="date">` for free keyboard/locale/accessibility support, at the cost of an OS-rendered (off-brand) popover. Replaced 2026-07-19 with this custom calendar once that trade-off stopped being acceptable — see readme.md's "Reconciliación con ARC-36/ARC-37" follow-up §6.
