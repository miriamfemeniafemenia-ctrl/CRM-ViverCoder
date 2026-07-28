Primary navigation, one component with two layouts: a 232px side nav for desktop, a bottom tab bar for mobile. Active item gets the brand-blue tint background (side) or blue icon/label (bottom).

```jsx
<MainNav active="clients" onNavigate={(key) => router.push(key)} mode="desktop" />
```

**Six sections (updated 2026-07-22):** Tareas de hoy, Clientes, Posibles clientes, Siniestros, Resumen, Sin seguimiento. The last two (`summary`, `unfollowed`) were added to close the open nav-placement question from the PRD audit — F12/F13 are Miriam-only screens (PRD Grupo 5, "Panel de control"), but Miriam chose to add them as equal-weight tabs for everyone rather than a role-aware nav, so Mónica and Antonio see all 6 too. Labels now truncate with an ellipsis instead of wrapping/overflowing, since six items leaves less room per tab than the original four did. Use `mode="auto"` in the real app (renders both, CSS media query picks one); pass an explicit `mode` only when previewing a single layout in isolation.

**Pending-count badges (added 2026-07-19):** pass `counts={{ tasks: 3 }}` to render the PRD's numeric badge (brand-blue pill, "9+" past 9) on a nav item, in both side and bottom layouts — works for any key, including the new `summary`/`unfollowed`.

```jsx
<MainNav active="tasks" mode="auto" counts={{ tasks: pendingReminders.length }} />
```
