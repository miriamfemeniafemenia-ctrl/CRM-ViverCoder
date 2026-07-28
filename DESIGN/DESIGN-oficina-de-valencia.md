# Design System — Oficina de Valencia

## 1. Visual Theme & Atmosphere

Oficina de Valencia is the design system behind the Arco Seguros CRM — a daily-use sales-and-claims tool for an insurance brokerage (correduría de seguros), not a marketing site. Where Apple, Tesla and Starbucks spend their whole system selling a product through photography, Oficina de Valencia has no photography at all: the entire visual weight sits on one confident chromatic accent, a disciplined type scale, and a small set of color-coded status badges that let an agent read the state of a client, a claim or a policy at a glance. The canvas is a flat, cool off-white (`--surface-app`) — never warm, never textured — and the one accent, a corporate-trust blue, is reserved exclusively for the single primary action per screen, the active nav state, links and focus rings. Nothing else on the page is allowed to compete with it.

Density is the opposite of a marketing site's generous whitespace: this is a desktop-first productivity tool used by the same two-to-three people all day, so rows-per-screen was explicitly prioritized over air — a 40px table row, a 40px standard button, a compact 14px body size. The one deliberate softening of that density is on mobile, where the two field agents (Mónica, Antonio) use the tool one-handed while out of the office — touch targets grow from 36px to 44px below the desktop breakpoint, the system's only responsive token. Elevation is the other place this system diverges from all three of its references: Apple and Tesla use almost no shadow at all, and Starbucks reserves real shadow for one floating button — but a CRM has real overlapping surfaces (dropdowns, modals, sticky nav, popovers), so whisper-soft layered shadows (2 stacked low-alpha shadows, never one heavy drop) do real structural work here that they don't need to do on a product page.

**Key Characteristics:**
- One single chromatic brand accent (corporate-trust blue) for every interactive/brand signal — no second brand hue, converging independently with Apple's and Tesla's "one accent only" rule.
- A near-neutral graphite-ink "secondary" color exists in tokens but is used narrowly (channel icons on a contact-history row) and is never a competing accent — same restraint principle as Apple's single-blue system.
- Four independent semantic color families — sale-pipeline status (4), claim status (3), client priority (3), policy status (3) — plus one warning color, all defined in OKLCH for perceptual evenness and picked to sit on hues far from the brand blue.
- Compact, desktop-first density (40px rows/buttons, 14px body) with a responsive touch-target exception (44px mobile → 36px desktop) — the one place mobile gets *more* room than desktop, not less.
- `transform: scale(0.97)` universal press feedback on every interactive control — the same signature micro-interaction Apple (`0.95`) and Starbucks (`0.95`) independently converge on.
- Whisper-soft, layered shadows (2 stacked low-alpha shadows) on cards/dropdowns/modals — adopted from Starbucks' elevation cue rather than Apple/Tesla's near-zero-shadow approach, because this system has real overlapping surfaces a marketing site doesn't.
- Mixed border-radius grammar: small/precise (4–8px) by default on cards and inputs for a "technical, engineered" read (the Tesla cue), full pill reserved only for status badges and the one primary action button (the Starbucks/Apple cue) — never used indiscriminately.
- No photography, no illustration, no gradients anywhere — visual interest comes entirely from the accent and the color-coded status badges.
- One typeface (Inter) with a disciplined 400/500/600/700 weight ladder and slight negative tracking on display/title sizes — the open-source substitute recommended across all three reference analyses.

## 2. Color Palette & Roles

> All colors are authored natively in **OKLCH**, not hex — a deliberate choice for perceptual evenness across the sale/claim/priority/policy families, so that no two semantic hues are ever accidentally closer together than intended. Defined in `tokens/colors.css`.

### Primary

- **`--color-primary-500`** `oklch(50% 0.125 251)` — the base brand color. The single chromatic accent: primary-action buttons, active nav state, links, focus rings.
- **`--color-primary-600`** `oklch(43% 0.12 252)` — hover/pressed state for the primary button; active nav text/icon color.
- **`--color-primary-700`** `oklch(35% 0.105 253)` — pressed-deeper state; active side-nav label color.
- Full ramp: `50` `oklch(97% 0.012 255)` · `100` `oklch(92.5% 0.028 254)` · `200` `oklch(85% 0.052 253)` · `300` `oklch(74% 0.078 252)` · `400` `oklch(62% 0.105 251)` · `800` `oklch(27% 0.085 254)` · `900` `oklch(17% 0.06 255)`.

### Secondary & Accent

- **`--color-secondary-600`** `oklch(34% 0.026 255)` (base) — a near-neutral graphite-ink family, *not* a second brand hue. Reserved, and today used only to tint the channel icon (call/WhatsApp/email/social/web) on `ContactHistoryItem` — added specifically to satisfy a brief requirement for "a secondary color" without diluting the single-accent principle.
- Ramp: `50` `oklch(97% 0.006 255)` · `100` `oklch(92% 0.01 255)` · `300` `oklch(76% 0.016 255)` · `500` `oklch(42% 0.028 255)` · `700` `oklch(27% 0.022 255)` · `900` `oklch(14% 0.014 255)`.

### Surface & Background

- **`--surface-app`** = neutral-50 `oklch(98% 0.003 255)` — the page canvas. Flat and cool, never warm, never textured.
- **`--surface-card`** = neutral-0 `oklch(100% 0 0)` — card/row/modal fill.
- **`--surface-sunken`** = neutral-100 `oklch(95.5% 0.004 255)` — hover state on rows, dropdown menu fill.
- **`--surface-overlay`** `oklch(15% 0.01 255 / 0.5)` — modal/bottom-sheet backdrop; the only place transparency/blur is used.
- **`--surface-brand`** = primary-500, **`--surface-brand-strong`** = primary-700 — solid brand fills where a whole surface (not just text) needs to read as "brand."

### Neutrals & Text

- **`--text-primary`** = neutral-900 `oklch(15% 0.008 255)` — headings, primary body, table strong text.
- **`--text-secondary`** = neutral-600 `oklch(45% 0.012 255)` — form labels, secondary body.
- **`--text-tertiary`** = neutral-500 `oklch(56% 0.012 255)` — timestamps, helper text, placeholders, meta captions.
- **`--text-on-brand`** = neutral-0 — text/icons sitting on a primary-colored fill.
- **`--text-link`** = primary-600.
- **`--border-default`** = neutral-200, **`--border-strong`** = neutral-300, **`--border-focus`** = primary-500.
- Full neutral ramp is cool gray throughout (near-zero chroma, hue ~255) — never warm — to stay consistent with the blue-forward brand direction.

### Semantic & Accent

Four independent status families, each mutually distinguishable and picked to sit on hues far from the brand blue (~251–255):

| Family | States | Notes |
|---|---|---|
| **Sale pipeline** (4) | `interesado` (teal, hue 190) · `presupuesto` (amber, hue 75–78) · `cerrado` (green, hue 150) · `perdido` (warm gray, hue 25, near-zero chroma) | Drives `StatusBadge domain="sale"` and every client-row pipeline badge. |
| **Claim status** (3) | `abierto` (orange, hue 35–38) · `tramitacion` (violet, hue 300) · `resuelto` (teal-green, hue 165) | Drives `StatusBadge domain="claim"` on `ClaimRow`. |
| **Client priority** (3) | `alta` (red, hue 25) · `media` (amber, hue 95) · `baja` (green, hue 145) | Drives `StatusBadge domain="priority"`; `alta` intentionally shares the same hue family as `--color-warning-*` ("needs attention" reads the same way in both places). |
| **Policy status** (3) | `activa` (fresh teal-green, hue 168) · `reemplazada` (plain neutral — "superseded" isn't a warning or a success, so it gets no hue at all, just `--color-neutral-600`/`100`) · `anulada` (warm red, hue 15, shares the "stop" family with `perdido`/`alta`) | Drives `StatusBadge domain="policy"` on `PolicyRow`. |
| **Warning** (1) | `--color-warning-fg` (hue 22) / `-bg` / `-border` | Overdue reminders (`ReminderItem`), form errors. The only state color reused across two different domains (priority `alta` and warning) on purpose. |

Every badge is text + color together, never color alone — `StatusBadge` always renders a label.

### Gradient System

No gradients anywhere in the system — same discipline as all three reference sites. Every surface is solid color-block; depth comes from the layered-shadow system (§6), not from gradients.

## 3. Typography Rules

### Font Family

- **`--font-sans`**: `"Inter", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` — one family for everything, headings through captions. Chosen as the open-source substitute recommended across *all three* reference analyses (Apple → SF Pro, Tesla → Universal Sans, Starbucks → SoDoSans) for a geometric, engineered sans without licensing a proprietary family.
- **`--font-mono`**: `"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — reserved for tabular/code-like reads (not yet consumed by a shipped component).
- Loaded via Google Fonts (`tokens/fonts.css`): weights 400/500/600/700 upright + 400 italic.

### Hierarchy

| Token | Size / Line-height | Weight | Use |
|---|---|---|---|
| `--text-display` | 28px / 1.2 | 600 | Rare — dashboard page title (e.g. "Resumen del negocio") |
| `--text-title` | 20px / 1.3 | 600 | Screen/section titles |
| `--text-subtitle` | 15px / 1.4 | 600 | Card/block headers (`SectionCard` title) |
| `--text-body-strong` | 14px / 1.5 | 600 | Emphasized body — row primary text |
| `--text-body` | 14px / 1.5 | 400 | Default body/paragraph |
| `--text-label` | 13px / 1.4 | 500 | Form labels, button text, table-adjacent labels |
| `--text-meta` | 12px / 1.4 | 400 | Timestamps, helper text |
| `--text-micro` | 11px / 1.3 | 600 | Badges, tags, uppercase kickers (nav bottom-labels) |

`--letter-spacing-tight` = `-0.01em` (display, title). `--letter-spacing-wide` = `0.04em` (uppercase micro labels only, e.g. `StatusBadge`).

### Principles

- **Nothing above 28px.** This is a tool, not a marketing surface — there is no "hero" tier at all. Compare Apple's 56px hero or Starbucks' 80px display.
- **Weight, not size, carries most emphasis at the small end** — `body` and `body-strong` share the same 14px/1.5, differing only by 400 vs 600 (the same principle Starbucks uses for its H1/H2 pair).
- **Compact, desktop-first sizing.** 14px default body versus a typical mobile-first system's 15–16px — because this is a data-dense tool read at a desk all day, not scanned on the move.
- **Sentence case throughout**, never ALL CAPS, except tiny uppercase micro-labels (status badges) — where letter-spacing signals "this is a tag, not a sentence," the same restrained-emphasis logic Tesla applies by *avoiding* text-transform entirely.
- **One family, no context-specific swaps.** Unlike Starbucks (serif for Rewards, script for Careers), Oficina de Valencia never switches typeface by context — a CRM has no "moments" that call for a different voice.

### Note on Font Substitutes

Inter is already the *intended* production font (no substitution needed) — chosen deliberately, at design time, as the shared open-source answer that all three reference systems point to for their respective proprietary faces. If Arco Seguros licenses a brand typeface later, swap `tokens/fonts.css` only; no component references a font family directly.

## 4. Component Stylings

19 components across 8 concern folders (`components/`), each shipped as `.jsx` + `.d.ts` + `.prompt.md` + a folder-level `.card.html` demo. Every interactive control shares the same `scale(var(--scale-press))` press feedback and the same `--duration-fast`/`--ease-standard` transition.

### Buttons

**`Button`** — the only button component; three variants share one shape grammar:
- `primary`: `--color-primary-500` fill, pill radius (`--radius-pill`) — the one place full-pill is used outside badges, reserving its meaning as "the one action."
- `secondary`: white fill, `--border-strong` outline, `--radius-md` (8px) — outlined, not filled, echoing the Apple/Starbucks "ghost pill" pattern but at technical radius, not pill.
- `text`: no fill/border, link-blue text.
- Sizes: `standard` (40px) / `compact` (32px). Optional `icon` prop (`edit`/`save`/`back`/`add`/`search`, inline SVG, `currentColor`). Optional `loading` prop swaps the icon for a spinner (`ov-spin` keyframe), sets `aria-busy`, keeps the variant's normal color (unlike `disabled`, which grays out) — "in progress" reads differently from "unavailable."

### Cards & Containers

**`SectionCard`** — the one generic container: white surface, `--radius-md`, `--border-default` hairline, `--shadow-sm`, optional `title` + trailing `action` slot in a bordered header. Wraps every list (`ClientRow`/`ClaimRow`/`PolicyRow`/`ReminderItem` groups) and every form section.

### Lists

The largest concern folder — this system is fundamentally a set of rows, not marketing tiles:

- **`ClientRow`** — 40px single-line row by default; name (strong) + optional `priority` badge + `saleStatus` badge. Optional `subtitle` (second line, e.g. "23 días sin contacto") grows the row to an auto height, and optional `action` slot (e.g. a compact `Button`) swallows its own clicks so it never also triggers the row's navigation `onClick`.
- **`ClaimRow`** — same 40px shape; `clientName` + `claimType` on one baseline, `claim` badge trailing (spans every client, hence needs `clientName`).
- **`PolicyRow`** — same row family as `ClaimRow`; `policyType` + `insurer`/`policyNumber` on one baseline, `policy` badge trailing. Lives *inside* a client's own ficha, so — unlike `ClaimRow` — it carries no `clientName`.
- **`ReminderItem`** — a self-contained card, not a table row: complete-toggle icon left, client name + date (+ optional `assignedTo`, "22 jul · Antonio") + note, edit/delete icons right. `overdue` swaps to the warning treatment (left accent + warning-colored date, the only component using `--color-warning-*`); `done` mutes and strikes the name.
- **`ContactHistoryItem`** — channel icon (call/WhatsApp/email/social/web, tinted `--color-secondary-600`) + type label + datetime, note paragraph, author line.
- **`AffectedPartyRow`** — name + phone/email on a second line, edit/remove icon-buttons trailing. No `onClick` — it's a leaf edit target inside a siniestro's detail view, not a link.
- **`SortToggle`** — a single click-to-toggle asc/desc label + rotating chevron; deliberately not a full data-grid header, since rows here are cards, not literal `<table>` columns.

### Inputs & Forms

- **`TextField`** — `--radius-xs` (4px), focus ring on `--border-focus`. `type="password"` auto-adds a show/hide eye toggle with no extra prop.
- **`TextArea`**, **`Select`** (native `<select>` + chevron, same border/focus treatment), **`SearchBar`** (search icon + clear-×, no visible label), **`DatePicker`** (custom monthly calendar popover built on `Popover` — zero external date-picker dependency, `min`/`max` respected, today ringed, selected filled), **`Checkbox`** (visually-hidden real input + 20px visual box + check icon, `minHeight: --tap-target-min` on the label even though the box itself is small).

### Navigation

**`MainNav`** — one component, two layouts (232px side-nav desktop / bottom tab-bar mobile), same active-state logic. **6 sections**: Tareas de hoy, Clientes, Posibles clientes, Siniestros, Resumen, Sin seguimiento — each with its own zero-dependency inline SVG glyph. Optional `counts` renders a brand-blue pill badge ("9+" past 9) per item, in both layouts. Bottom-nav labels truncate with an ellipsis rather than wrap, since six tabs leave less width per label than the founding four did.

**`Tabs`** — generic `items`/`active`/`onChange`, optional count badge reusing `MainNav`'s pill style; scrolls horizontally on overflow rather than wrapping.

### Filters

**`FilterChip`** — pill-shaped, toggleable, `active` state fills `--color-primary-50`/border/text-700. Deliberately separate from `StatusBadge`: a badge shows one real state value and isn't clickable; a chip is a clickable filter and needs an "all" option a badge's fixed value-set can't represent.

### Overlays

**`Modal`** (desktop, centered, `--radius-lg`, `--shadow-lg`, Escape-to-close) and **`BottomSheet`** (mobile, bottom-anchored, rounded top corners only, drag-handle affordance) share an identical prop shape (`title`/`onClose`/`children`/`footer`) so a screen can swap one for the other by breakpoint without changing its call site. **`Popover`** is the generic anchored panel underneath both `DatePicker` and any menu/filter popover — click-outside and Escape both close it.

### Feedback

**`EmptyState`** — centered icon-in-a-circle + message + optional action, for no-content list states. **`Toast`** — bottom-anchored, `neutral` (dark) or `error` (warning-tinted) only; no invented "success" color, since a completed action here is usually shown by the row itself changing state, not a toast.

### Metrics

**`StatTile`** — label + headline number + optional caption, no icon, no color-coding (these are neutral counts, not statuses). Per the project's own data-viz guidance: "a handful of headline numbers" is a KPI row of stat tiles, not a chart — so this ships text-only, with no delta/sparkline until there's historical data to back one.

## 5. Layout Principles

### Spacing System

- **Base unit: 4px**, `--space-1` (4px) through `--space-16` (64px): `1`=4 · `2`=8 · `3`=12 · `4`=16 · `5`=20 · `6`=24 · `8`=32 · `10`=40 · `12`=48 · `16`=64.
- **Row/control heights are fixed, not derived**: `--table-row-height` 40px, `--bottom-nav-height` 60px, `--side-nav-width` 232px, `--header-height` 52px — compact by design, to keep more rows visible per screen than a more spacious system would.
- **Page margins**: `--page-margin-mobile` = `--space-4` (16px), `--page-margin-desktop` = `--space-6` (24px).
- **`--content-max-width`**: 1360px.

### Grid & Container

No multi-column marketing grid exists — the system is single-column lists inside `SectionCard`, plus a two-region app shell (side-nav + content on desktop, content + bottom-nav on mobile). The only "grid" component is the ad-hoc `auto-fit, minmax(160px, 1fr)` CSS grid used for `StatTile` KPI rows — deliberately not a named component, since it's one line of inline style.

### Whitespace Philosophy

The inverse of Apple/Tesla/Starbucks: whitespace here is a cost, not a luxury signal. Every spacing decision trades against "how many rows fit on screen" — the explicit brief was rows-per-screen over airy whitespace, since this is a daily-use tool for a small team, not a browsing experience.

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Inputs |
| `--radius-sm` | 6px | Secondary buttons, icon-buttons |
| `--radius-md` | 8px | Cards, primary-container radius |
| `--radius-lg` | 12px | Modals, bottom sheets |
| `--radius-pill` | 999px | Status badges and the primary action button *only* |

Mixed on purpose, same logic Tesla applies with its 4px "precision over playfulness" — small/precise by default, pill reserved so it keeps meaning "this is the one action / this is a tag."

## 6. Depth & Elevation

| Token | Value | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 2px oklch(20% 0.01 255 / 0.05)` | `ReminderItem` card |
| `--shadow-sm` | `0 1px 2px .../0.06, 0 1px 1px .../0.04` | `SectionCard`, `PolicyRow`/`StatTile` containers |
| `--shadow-md` | `0 2px 6px .../0.08, 0 1px 2px .../0.05` | Dropdowns, `Popover` |
| `--shadow-lg` | `0 8px 20px .../0.12, 0 2px 6px .../0.06` | `Modal`, `BottomSheet` |
| `--shadow-nav` | `0 1px 3px .../0.08` | `MainNav` bottom bar |

**Shadow philosophy:** whisper-soft and layered (2 stacked low-alpha shadows), never one heavy drop — the Starbucks cue, cooled down. This is the system's one deliberate departure from Apple/Tesla's near-zero-shadow marketing-site approach: a CRM has real overlapping surfaces (dropdowns, modals, sticky nav) that need a functional depth cue those sites simply don't have to solve.

### Decorative Depth

None. `--surface-overlay` (modal/sheet backdrop) is the only place any transparency is used at all — no frosted-glass blur, no gradients, no atmospheric imagery (there is no imagery).

## 7. Do's and Don'ts

### Do
- Use `--color-primary-500` for every interactive/brand signal — the one primary action, active nav, links, focus rings — and nothing else.
- Show status with a badge (color + label), never color alone.
- Keep rows at 40px and buttons at 40px/32px — density is a feature here, not a compromise.
- Apply `scale(var(--scale-press))` as the universal press feedback on every interactive control.
- Reserve `--radius-pill` for status badges and the one primary button; use `--radius-xs/sm/md/lg` for everything else.
- Layer 2 low-alpha shadows for elevation, never one heavy drop shadow.
- Grow `--tap-target-min` to 44px below the desktop breakpoint — mobile agents work one-handed, in the field.
- Add a new component only when an existing row/badge/primitive genuinely can't represent the new data shape (see `PolicyRow`/`AffectedPartyRow`, added specifically to close that gap) — don't invent a variant when composing existing primitives already works.

### Don't
- Don't introduce a second chromatic brand color — `--color-secondary-*` stays a near-neutral utility tint, never a competing accent.
- Don't use pure black or pure white-adjacent warm tones — neutrals are cool grays throughout.
- Don't add a shadow to a status badge or a button — shadow is reserved for cards/overlays/nav, not for flat action/tag elements.
- Don't wrap bottom-nav labels — truncate with an ellipsis instead, now that six tabs leave less room per label.
- Don't invent a new "success" toast color — a completed action is shown by the row's own state changing, not a toast; `Toast` stays `neutral`/`error` only.
- Don't build a literal `<table>` header for sorting — use `SortToggle`, since this system's lists are rows/cards, not spreadsheet columns.
- Don't set body copy below 14px or above 28px anywhere — the scale has no "hero" tier and no sub-11px micro tier.

## 8. Responsive Behavior

### Breakpoints

Unlike the three reference marketing sites (5–8 breakpoints each), Oficina de Valencia has exactly **one**: `--breakpoint-desktop` = 768px. This is a two-mode app (mobile bottom-nav ↔ desktop side-nav), not a page that needs to reflow across five viewport tiers — the simplicity is intentional, not an oversight.

| Mode | Width | Key Changes |
|---|---|---|
| Mobile/touch | < 768px | `MainNav` renders as a bottom tab bar; `--tap-target-min` = 44px |
| Desktop | ≥ 768px | `MainNav` renders as a 232px side rail; `--tap-target-min` tightens to 36px (compact-density mouse/trackpad use) |

`MainNav` also accepts an explicit `mode="mobile"|"desktop"` override for isolated previews; `mode="auto"` (the real-app default) renders both and lets the media query pick one.

### Touch Targets

- `--tap-target-min` is the only responsive token in the system: 44px by default (mobile/touch — ARC-36's one-handed, in-the-field usage), tightening to 36px at ≥768px where the compact-density decision takes over. Primary actions (40px) clear both thresholds regardless.
- `Checkbox`'s clickable `<label>` enforces `--tap-target-min` even though its visual box is only 20px.

### Collapsing Strategy

- **`MainNav`**: side-rail (labels always visible) ↔ bottom bar (icon + micro-label, now with ellipsis truncation at 6 items).
- **`Modal` ↔ `BottomSheet`**: identical prop shape lets a screen swap the desktop centered dialog for the mobile bottom-anchored sheet by breakpoint alone.
- No grid ever needs to collapse — there are no multi-column marketing grids in this system, only single-column lists.

## 9. Agent Prompt Guide

### Quick Color Reference

- Primary accent / primary button: `--color-primary-500` (`oklch(50% 0.125 251)`)
- Primary hover/active nav: `--color-primary-600` (`oklch(43% 0.12 252)`)
- Page canvas: `--surface-app` (`oklch(98% 0.003 255)`)
- Card/row surface: `--surface-card` (`oklch(100% 0 0)`)
- Primary text: `--text-primary` (`oklch(15% 0.008 255)`)
- Secondary text: `--text-secondary` (`oklch(45% 0.012 255)`)
- Tertiary/meta text: `--text-tertiary` (`oklch(56% 0.012 255)`)
- Border: `--border-default` (`oklch(91% 0.006 255)`)
- Warning/overdue: `--color-warning-fg` / `-bg` / `-border` (hue 22)

### Example Component Prompts

1. "Create a `ClientRow` for 'Laura Gómez', `saleStatus=\"presupuesto\"`, `priority=\"alta\"`, with a `subtitle` of '23 días sin contacto' and a secondary compact `Button` action reading 'Registrar contacto' — 56px auto-height row, name in `--text-body-strong`, subtitle in `--text-meta`/tertiary, priority and sale badges trailing right."
2. "Build a `ReminderItem` for an overdue renewal reminder: client 'Manuel Ortiz', date '20 jul', `assignedTo=\"Antonio\"`, note 'Renovación: seguro de hogar vence en 7 días', `overdue` — warning-colored left accent and date, check/edit/delete icon buttons, `scale(0.97)` press feedback."
3. "Design a `SectionCard` titled 'Pólizas contratadas' containing two `PolicyRow`s — 'Seguro de auto' / Mapfre / A-88291 / `activa`, and 'Seguro de hogar' / Allianz / H-10432 / `anulada` — 40px rows, `StatusBadge domain=\"policy\"` trailing each."
4. "Create a KPI row of four `StatTile`s — 'Clientes activos' 128, 'Ventas cerradas' 9 (caption 'este mes'), 'Clientes nuevos' 14 (caption 'este mes'), 'Leads en proceso' 22 — in a CSS grid `repeat(auto-fit, minmax(160px, 1fr))`, no icons, no color-coding."
5. "Build the `MainNav` bottom bar with all 6 sections (Tareas de hoy, Clientes, Posibles clientes, Siniestros, Resumen, Sin seguimiento), `active=\"clients\"`, `counts={{tasks: 3}}` showing a brand-blue pill badge on the Tareas icon, labels truncating with an ellipsis."

### Iteration Guide

1. Focus on one component at a time; reference its token/prop names directly (`ClientRow.subtitle`, `StatusBadge domain=\"policy\"`).
2. Every new state color goes in `tokens/colors.css` first — never invent an ad-hoc hex/oklch value inline in a component.
3. Check whether an existing row/primitive can represent the new data shape before adding a new component — this system adds a component only when composition genuinely fails (see `PolicyRow`/`AffectedPartyRow`).
4. Preserve `scale(var(--scale-press))` on every new interactive control — it's the one universal micro-interaction.
5. Keep `--radius-pill` meaning "the one action / a tag" — never apply it to a new container just because it looks nice.
6. Any change to `MainNav`'s section set is a navigation-shape decision, not a visual one — confirm it with the product owner before shipping, the same way "Posibles clientes," then "Resumen"/"Sin seguimiento," were each confirmed explicitly rather than assumed.

## Known Gaps

- No dark-mode token set exists yet — every token above is the single (light) theme this CRM ships today.
- No data-visualization chart tokens (categorical/sequential/diverging ramps) exist — `StatTile` covers "a handful of headline numbers," but a real chart hasn't been needed yet.
- Screens (Login, P1–P5 proper, sub-screens) exist only as components today, not as assembled `.html` screens in this project, aside from four exceptions (`p6-posibles-clientes`, `f6-alertas-renovacion`, `f9-clientes-frios`, `f12-resumen-del-negocio`/`f13-alertas-sin-seguimiento`) built on explicit request — this document describes the component/token system, not a full screen inventory.
- `--font-mono` is defined but not yet consumed by any shipped component.
- `--color-secondary-*` is defined and lightly connected (one icon tint) but most of its ramp remains reserved/unused, pending a real dark-surface need.
