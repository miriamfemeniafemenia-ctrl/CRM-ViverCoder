Desktop dialog for the three sub-screens that open from a client's ficha: registrar contacto, nuevo/editar recordatorio, añadir siniestro. Centered panel, `--shadow-lg` + `--radius-lg` (the only place `--radius-lg` is used — reserved for the largest overlay surface), dark `--surface-overlay` backdrop. Closes on backdrop click, Escape, or the header × button.

```jsx
<Modal open={isOpen} title="Registrar contacto" onClose={close}
  footer={<><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
  <TextArea label="Nota" value={note} onChange={setNote} />
</Modal>
```

Use `Modal` at desktop breakpoints and `BottomSheet` at mobile ones for the same sub-screen — same title/children/footer props, swap the wrapper based on viewport.
