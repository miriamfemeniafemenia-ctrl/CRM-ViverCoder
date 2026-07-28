New component, added 2026-07-22 to close a gap found in the PRD audit: ARC-34 (Done in Linear) asks for client priority to be "visible, filtrable y ordenable" in P2, but nothing in Oficina de Valencia represented a sortable field before this — `FilterChip` already covers *filtrable*, `SortToggle` now covers *ordenable*.

```jsx
const [direction, setDirection] = React.useState(null);
<SortToggle label="Días sin contacto" direction={direction}
  onToggle={() => setDirection(d => d === "desc" ? "asc" : "desc")} />
```

Deliberately a single toggle button, not a full data-grid header — this system's lists are cards/rows, not literal `<table>` columns with something to align a header to. Drop it wherever a screen needs to sort the list below it (see `screens/f9-clientes-frios.html`, sorting by days-without-contact). When P2 itself gets built, reuse this same component for its priority column rather than inventing a second sort control.
