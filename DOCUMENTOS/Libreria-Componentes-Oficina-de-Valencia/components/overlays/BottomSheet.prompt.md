Mobile counterpart to `Modal` for the same three sub-screens (registrar contacto, nuevo/editar recordatorio, añadir siniestro) — flush to the bottom edge, rounded only on the top corners, respects `--safe-bottom` for notched devices, small drag-handle bar as the dismiss affordance instead of a header × button.

```jsx
<BottomSheet open={isOpen} title="Añadir siniestro" onClose={close}
  footer={<Button onClick={save} style={{width:"100%"}}>Guardar</Button>}>
  <Select label="Tipo de siniestro" value={type} onChange={setType} options={claimTypes} />
</BottomSheet>
```

Same props shape as `Modal` by design, so a screen can pick whichever wrapper matches the current breakpoint without changing its form content.
