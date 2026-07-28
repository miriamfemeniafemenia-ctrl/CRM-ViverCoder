Multi-line sibling of `TextField` — identical label/focus/error/disabled treatment, vertically resizable only (never horizontal, to keep form-column widths intact).

```jsx
<TextArea label="Nota" value={note} onChange={setNote} rows={3}
  placeholder="¿Qué se habló o acordó?" />
```

Used for D2's contact note, D3's reminder note, and D4's claim description — anywhere the PRD calls for a longer free-text note rather than `TextField`'s single line.
