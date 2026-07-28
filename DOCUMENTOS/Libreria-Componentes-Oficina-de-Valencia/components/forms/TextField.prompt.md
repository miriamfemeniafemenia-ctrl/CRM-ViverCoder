Labeled text input, 40px tall, 4px radius (precise/technical, not pill — inputs are containers, not actions). Focus state draws the brand-blue ring; error state overrides to the warning color.

```jsx
<TextField label="Nombre del cliente" value={name} onChange={setName} placeholder="Escribe un nombre…" />
<TextField label="Email" value={email} onChange={setEmail} error="Formato de email no válido" />
<TextField label="Contraseña" type="password" value={pw} onChange={setPw} />
```

**Password (added 2026-07-19):** `type="password"` automatically renders a show/hide eye toggle inside the field (right-aligned) — no extra prop needed. Toggling swaps the native input's `type` between `password`/`text` locally; the value passed to `onChange` is always the plain string either way.
