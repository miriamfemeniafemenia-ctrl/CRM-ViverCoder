Read-only timeline entry for the "Historial de contactos" block on P3 — Ficha de cliente. One entry per D2 record: channel icon + label, timestamp, note, and who logged it. Not clickable — there's no edit/delete on past contacts in the MVP.

```jsx
<ContactHistoryItem type="whatsapp" datetime="17 jul, 10:24" author="Antonio"
  note="Envié el presupuesto del seguro de hogar, queda a la espera de confirmar." />
```

Lives inside a `SectionCard` — usually rendered as a plain stacked list (`display:flex;flexDirection:column`), no outer border of its own. Set `divider={false}` on the last item to drop the trailing hairline. `type` covers the five channels from D2: llamada, whatsapp, correo, redes, web.
