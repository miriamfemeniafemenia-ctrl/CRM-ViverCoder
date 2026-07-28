Self-contained card (not a table row) for P1 — Mis tareas de hoy: client name + date on top, the follow-up note below, a complete-toggle on the left and edit/delete icons on the right. Overdue reminders get a warning-colored left accent and date label — the only component that uses `--color-warning-*`.

```jsx
<ReminderItem clientName="Laura Gómez" date="17 jul" note="Llamar para confirmar el presupuesto."
  overdue onClick={() => openClient(id)} onComplete={markDone} onEdit={openEditForm} onDelete={remove} />
```

The whole card is clickable to jump to the client's ficha (P3); the three icon buttons call `stopPropagation` so they don't also trigger that navigation. `done` renders a muted, struck-through state for a "completadas" view.

**`assignedTo` (added 2026-07-22):** prints after the date ("22 jul · Antonio") — closes a gap found in the PRD audit, where a reminder had no visible owner outside of already being filtered to one person's tab.

```jsx
<ReminderItem clientName="Manuel Ortiz" date="20 jul" assignedTo="Antonio" overdue note="Renovación: seguro de hogar vence en 7 días." />
```

Omit it in a screen that's already scoped to one person (e.g. a single-user "Hoy" tab) — it only earns its place in a combined/all-people view.
