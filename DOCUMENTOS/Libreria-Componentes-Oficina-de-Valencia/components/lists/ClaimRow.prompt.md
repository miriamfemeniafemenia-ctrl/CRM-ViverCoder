Compact 40px table row for P5 — Panel de siniestros: affected client, claim type and current status. Tap/click anywhere to jump to that client's ficha (P3).

```jsx
<ClaimRow clientName="Laura Gómez" claimType="Daño por agua" claimStatus="tramitacion" onClick={() => openClient(id)} />
```

Set `divider={false}` on the last row of a list to drop the trailing hairline. Shares the same hover/press behavior as `ClientRow`.
