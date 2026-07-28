Bottom-centered snackbar for action confirmations ("Cliente guardado", "Recordatorio eliminado") and background errors. Only two variants — `neutral` (dark, default) and `error` (reuses the same `--color-warning-*` tokens `TextField`/`Select`/`TextArea`/`DatePicker` already use for validation errors, so "warning" keeps one consistent meaning app-wide). No dedicated "success" green: this system has no confirmed success color, so neutral-dark + a check icon carries that meaning instead of inventing a new token ad hoc.

```jsx
<Toast open={toast.open} message="Cliente guardado" duration={3000} onClose={closeToast} />
<Toast open={toast.open} message="No se pudo guardar el recordatorio" variant="error" onClose={closeToast} />
```

Pass `duration` (ms) for auto-dismiss; omit it to require the user to close it via the × button.
