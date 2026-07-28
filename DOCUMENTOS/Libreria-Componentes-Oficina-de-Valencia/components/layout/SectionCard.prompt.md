White card, 8px radius, hairline border + whisper-soft shadow (`--shadow-sm`) — the default content container for the whole app (client detail blocks, claim summaries, dashboard tiles).

```jsx
<SectionCard title="Datos de contacto" action={<Button variant="text" size="compact">Editar</Button>}>
  <p>…</p>
</SectionCard>
```

Header is divided from body by a hairline, not a colored band — the card stays quiet so table/list content inside it carries the visual weight.
