---
name: oficina-de-valencia-design
description: Use this skill to generate well-branded interfaces and assets for the Arco Seguros CRM's new design line ("Oficina de Valencia"), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, tokens, and UI component primitives for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, copy the token CSS files and components, and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key facts to hold in mind:
- Professional, modern, inspiring tone for a compact, desktop-first insurance CRM (clients, sales pipeline, claims). One single chromatic brand accent — corporate-trust blue — used everywhere an "action" or "interactive" signal is needed. No second brand color.
- One typeface (Inter), disciplined weight ladder (400/500/600/700), slight negative tracking on display/title sizes.
- Sale-status has 4 fixed states (Interesado/Presupuesto enviado/Cerrado/Perdido); claim-status has 3 (Abierto/En tramitación/Resuelto); both plus an overdue-reminder warning color are all mutually distinguishable and sit on hues far from the brand blue — never invent new state colors ad hoc, add them to `tokens/colors.css` first.
- Radius is mixed on purpose: small/precise (`--radius-xs`/`sm`/`md`, 4–8px) on cards, inputs and secondary buttons for an engineered, technical read; full pill (`--radius-pill`) is reserved for status badges and the primary action button only — it must keep meaning "this is the one action."
- Elevation is whisper-soft, layered shadows (2 stacked low-alpha shadows, never one heavy drop shadow) — see `tokens/elevation.css`.
- Every interactive control shares the same press feedback: `transform: scale(var(--scale-press))` (0.97).
- No logo exists — never draw or invent one; use the plain wordmark "Oficina de Valencia" / "Arco Seguros" until a real mark is supplied.
- This is a from-scratch design line, distinct from the existing "Arco Seguros Design System" project (warm terracotta, mobile-first) — do not mix tokens or components between the two systems.

## Design lineage

Built by analyzing three reference systems (Apple, Tesla, Starbucks — see `guidelines/inspiration-sources.md` for the full rationale) and extracting what transfers to a professional B2B CRM, not their marketing-site page structure:
- **From Apple/Tesla:** one disciplined chromatic accent, a tight weight ladder, restraint (no gradients, no decorative chrome), `scale(0.97)` press feedback.
- **From Starbucks:** the component architecture that actually transfers to app UI — pill-shaped status badges, layered whisper-soft shadows for real elevation needs (dropdowns/modals), rounded-but-not-pill cards.
- **Deliberately not copied:** hero/product-tile page structure (this is an app, not a marketing site), Starbucks' warm cream canvas (replaced with cool neutrals to match the blue-forward "corporate trust" direction), Tesla's near-zero elevation (a data-dense CRM needs functional depth cues Tesla's marketing site doesn't).
