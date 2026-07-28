Native `<select>` restyled to match `TextField` exactly (40px, 4px radius, same focus ring/error states) with a custom chevron. Domain-agnostic — pass whatever `options` the screen needs (canal de entrada, estado de venta, tipo de contacto…); it doesn't bake in any CRM-specific list itself.

```jsx
<Select label="Canal de entrada" value={channel} onChange={setChannel} placeholder="Selecciona un canal…"
  options={[
    { value: "llamada", label: "Llamada" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "web", label: "Web" },
    { value: "redes", label: "Redes sociales" },
    { value: "presencial", label: "Presencial" },
  ]} />
```

Used in P4 (canal de entrada), P3 (cambiar estado de venta) and the "Registrar contacto" sub-screen (tipo de contacto). Not used for tipo de siniestro — per the PRD that field is free text (`TextArea`/`TextField`), not a fixed list.
