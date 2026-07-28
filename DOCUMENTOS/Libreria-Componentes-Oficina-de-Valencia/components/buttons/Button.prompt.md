Primary/secondary/text button, standard or compact size, with hover/active/disabled states baked in.

```jsx
<Button variant="primary" onClick={() => save()}>Guardar</Button>
<Button variant="secondary" size="compact">Cancelar</Button>
<Button variant="text">Ver histórico</Button>
```

Variants: `primary` (filled brand blue, full pill radius — the pill shape IS the "this is an action" signal, reserve it for the one main action per screen), `secondary` (outlined, 8px radius, for secondary actions), `text` (link-style, lowest emphasis). Sizes: `standard` (40px, default) and `compact` (32px, for toolbars/dense table rows). Press feedback is `scale(0.97)` on every variant — the shared micro-interaction across this whole system. Pass `disabled` to block clicks.

**Icon (added 2026-07-19):** optional leading icon via `icon="edit" | "save" | "back" | "add" | "search"`, drawn in `currentColor` so it always matches the variant's text color automatically — no extra color prop needed.

```jsx
<Button variant="primary" icon="save" onClick={() => save()}>Guardar</Button>
<Button variant="text" icon="add">Nuevo cliente</Button>
```

**Loading (added 2026-07-19):** `loading` replaces the icon with a spinning indicator, blocks `onClick`, and sets `aria-busy` — but keeps the variant's normal background (unlike `disabled`, which grays it out), so the button still reads as "this is happening", not "this is unavailable". Takes priority over `icon` while true.

```jsx
<Button variant="primary" loading={isSubmitting} onClick={login}>Iniciar sesión</Button>
```
