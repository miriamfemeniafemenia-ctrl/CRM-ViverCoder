Standalone search input for P2 — Lista de clientes: leading magnifying-glass icon, no label (it's a page-level search, not a form field), trailing clear button appears once there's a value.

```jsx
<SearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre, teléfono o correo…" />
```

Same 40px height / 4px radius / focus-ring language as `TextField`, but unlabeled and icon-led since it always sits directly under the P2 page header rather than inside a form.
