# PM-P2-04 — Canonical Design Tokens & Accessibility Contract

**Status:** Owner-review draft; the design direction is approved, but the exact palette/token dictionary is **not yet ratified**.  
**Scope:** Design-token reconciliation and accessibility/responsive rules only.  
**Implementation boundary:** No Project Manager application files, settings, database, or runtime were changed.

## 1. Decision summary

This document provides one coherent **candidate canonical dictionary** for the shared UI system. It uses the currently implemented theme IDs and values as the compatibility baseline, while making the conflict with the redesign plan explicit. It must not be described as owner-approved until the Phase 2 approval card (`t_7ac0e3a2`) resolves the palette conflict and accepts the supporting rules.

**Recommendation for the owner gate:** preserve the existing six theme IDs, names, and accent values in `UI_UX_PROGRESS.md` and `ThemeProvider.tsx` because those values are recorded as locked decisions and theme IDs are persisted. Treat the alternate palette in `UI_UX_REDESIGN_PLAN.md` as a conflicting source—not as an automatic implementation mandate—until the owner confirms the authority. The token dictionary below is therefore a review-ready candidate, not an authorization to change code.

## 2. Evidence and reconciliation

| Source | Verified fact | Consequence |
|---|---|---|
| `PHASE1_DISCOVERY_DECISION_PACK.md` | Marks `UI_UX_REDESIGN_PLAN.md` as current design authority and `UI_UX_PROGRESS.md` as current for the glass migration. It also records six live themes and `#54C8FF`. | Both documents are active evidence; neither palette may be silently substituted for the other. |
| `UI_UX_PROGRESS.md` | “Locked Owner Decisions” specifies graphite-black `#080B11` / `#090B0F`, accent `#54C8FF`, blur `22px` / saturation `142%`, six preset IDs/names, and `pm-theme-preference-v2`. | Candidate values below preserve this stable contract. |
| `frontend/src/theme/ThemeProvider.tsx` | Implements IDs `crystal`, `violet`, `aurora`, `ember`, `emerald`, `porcelain`; custom accents update accent, RGB and ink; porcelain is the light theme. | Keep IDs stable; custom accent remains a user preference, not a semantic status color. |
| `frontend/src/index.css` | Defines current surface, text, accent, status, radius and shadow values; has a 2px accent `:focus-visible` outline, reduced-motion media query, and 1120/850/780px responsive rules across the stylesheet. | Preserve existing behavior as compatibility input; formalize missing typographic, spacing, focus, sizing, and stacking contracts. |
| `UI_UX_REDESIGN_PLAN.md` | Specifies `#63C6FF` and alternate names/accents: Prism Violet, Aurora Teal and Juniper; its other glass values also differ. | **DECISION-REQUIRED:** owner must choose which palette source is canonical before implementation. |

### Palette conflict — one owner decision

The current tracker/provider contract is `#54C8FF` with Carbon Orchid / Aurora Mint / Emerald Circuit; the redesign plan is `#63C6FF` with Prism Violet / Aurora Teal / Juniper. The plan also differs in glass/text values: rail `rgba(10,14,22,.82)` vs current `rgba(12,15,21,.74)`; glass `rgba(19,27,41,.66)` vs current `rgba(21,27,37,.56)`; raised glass `rgba(30,42,63,.76)` vs current `rgba(28,35,47,.74)`; border `rgba(182,211,255,.15)` vs current `rgba(211,228,255,.13)`; primary text `#F3F8FF` vs current `#F4F8FF`; secondary text `#A7B8CE` vs current `#AEBCD0`; accent ink `#061018` vs current `#06131A`; and plan blur/saturation `20px / 135%` vs the tracker’s locked `22px / 142%`. The graphite-black style direction is shared, but these values are not reconciled by the source record. The Phase 2 owner gate must approve one dictionary. This draft recommends the live/tracker values for compatibility and records the new `--pm-bg` mapping separately; it does **not** claim that recommendation has already been approved.

## 3. Canonical token hierarchy

Components should consume semantic roles, not raw palette values. The six foundation roles are:

| Canonical role | Meaning | Compatibility mapping |
|---|---|---|
| `--pm-bg` | Application/background field | New semantic alias/value; retain `--pm-canvas` as the existing content-surface token. |
| `--pm-rail` | Persistent navigation surface | Existing `--pm-rail`. |
| `--pm-glass` | Default frosted panel/surface | Existing `--pm-glass`. |
| `--pm-border` | Standard translucent separator | Existing `--pm-border`. |
| `--pm-accent` | User-selected interaction signal | Existing dynamically set `--pm-accent`. |
| `--pm-text` | Primary readable foreground | Existing `--pm-text`. |

Supporting semantic tokens below are part of the same dictionary; the six roles are not a reason to delete needed status, focus, motion, typography, or layout tokens. Existing names remain aliases during any future migration. Theme color maps must override only the theme-dependent roles. Status colors stay independent of the custom accent.

## 4. Candidate canonical token dictionary

Values sourced from the current stylesheet are marked **current baseline**. Newly named scales/rules are **proposed targets** and need owner approval. For the default palette, the candidate uses the progress tracker’s graphite-black pair; the `#54C8FF` accent remains explicitly subject to the owner decision in §2.

### 4.1 Color, surfaces and elevation

| Token | Candidate value | Status / usage |
|---|---|---|
| `--pm-bg` | `#080B11` | Proposed semantic app field; approved direction. |
| `--pm-canvas` | `#090B0F` | Current baseline; retain as the working canvas surface. |
| `--pm-canvas-deep` | `#050609` | Current baseline; darkest gradient stop. |
| `--pm-rail` | `rgba(12, 15, 21, 0.74)` | Current baseline; theme-overridden. |
| `--pm-glass` | `rgba(21, 27, 37, 0.56)` | Current baseline; theme-overridden. |
| `--pm-glass-strong` | `rgba(28, 35, 47, 0.74)` | Current baseline; raised surface. |
| `--pm-glass-soft` | `rgba(255, 255, 255, 0.045)` | Current baseline; low-emphasis surface. |
| `--pm-glass-hover` | `rgba(255, 255, 255, 0.082)` | Current baseline; hover/active surface. |
| `--pm-glass-blur` | `22px` | Proposed canonical glass blur; matches locked progress decision. |
| `--pm-glass-saturation` | `142%` | Proposed canonical glass saturation; matches locked progress decision. |
| `--pm-glass-highlight` | `rgba(255, 255, 255, 0.055)` | Current inset highlight component from `--pm-shadow`. |
| `--pm-border` | `rgba(211, 228, 255, 0.13)` | Current baseline; theme-overridden. |
| `--pm-border-strong` | `rgba(215, 234, 255, 0.22)` | Current baseline; emphasis/separation. |
| `--pm-text` | `#F4F8FF` | Current baseline; theme-overridden. |
| `--pm-text-secondary` | `#AEBCD0` | Current baseline; supporting text. |
| `--pm-text-muted` | `#738197` | Current baseline; non-essential metadata only after contrast validation. |
| `--pm-accent` | `#54C8FF` | Candidate default; palette owner decision pending. |
| `--pm-accent-rgb` | `84, 200, 255` | Current baseline; derived from selected accent. |
| `--pm-accent-ink` | `#06131A` | Current baseline; contrast-aware text/icon on accent fill. |
| `--pm-accent-soft` | `rgba(var(--pm-accent-rgb), 0.13)` | Current baseline; subtle selection tint. |
| `--pm-accent-glow` | `rgba(var(--pm-accent-rgb), 0.26)` | Current baseline; restrained decorative halo only. |
| `--pm-success` | `#73D6A3` | Current baseline; semantic success, never replaced by accent. |
| `--pm-warning` | `#F2BE6E` | Current baseline; semantic warning, never replaced by accent. |
| `--pm-danger` | `#F0838C` | Current baseline; semantic destructive/error, never replaced by accent. |
| `--pm-info` | `#95B9FF` | Current baseline; semantic information, never replaced by accent. |
| `--pm-shadow` | `0 18px 44px rgba(0,0,0,.28), inset 0 1px rgba(255,255,255,.055)` | Current baseline; panel depth. |
| `--pm-shadow-float` | `0 26px 70px rgba(0,0,0,.50), inset 0 1px rgba(255,255,255,.07)` | Current baseline; floating overlays. |

Apply blur/saturation only to genuine layered surfaces (rail, panel, inspector, menu, dialog). Keep dense data rows legible and comparatively opaque. Avoid stronger blur/glow on every component; the direction is structural glass, not visual fog.

### 4.2 Six theme maps

The following is the single candidate theme bundle taken from the live provider and progress tracker. Canvas/deep, surface and text values are current CSS values; `--pm-bg` is a proposed page-field mapping (default `#080B11`, other themes use their current canvas value); accent names/values remain part of the unresolved palette decision.

| ID / display name | App bg / canvas / deep | Rail / glass / raised | Border / strong border | Text / secondary / muted | Accent |
|---|---|---|---|---|---|
| `crystal` — Obsidian Signal (default) | `#080B11` (proposed) / `#090B0F` / `#050609` | `rgba(12,15,21,.74)` / `rgba(21,27,37,.56)` / `rgba(28,35,47,.74)` | `rgba(211,228,255,.13)` / `rgba(215,234,255,.22)` | `#F4F8FF` / `#AEBCD0` / `#738197` | `#54C8FF` **pending owner choice** |
| `violet` — Carbon Orchid | `#0C0A12` (proposed) / `#0C0A12` / `#07050A` | `rgba(17,12,25,.76)` / `rgba(37,27,49,.57)` / `rgba(45,33,60,.75)` | `rgba(232,217,255,.14)` / `rgba(232,217,255,.24)` | `#F9F3FF` / `#C2B5D0` / `#877D96` | `#C7A6FF` **pending palette bundle** |
| `aurora` — Aurora Mint | `#07100E` (proposed) / `#07100E` / `#040806` | `rgba(9,23,18,.78)` / `rgba(18,44,35,.58)` / `rgba(24,56,44,.76)` | `rgba(208,255,229,.14)` / `rgba(208,255,229,.24)` | `#EFFFF7` / `#B2D0BF` / `#789787` | `#87E2C0` **pending palette bundle** |
| `ember` — Forge Amber | `#100C08` (proposed) / `#100C08` / `#080604` | `rgba(26,17,10,.78)` / `rgba(50,34,21,.56)` / `rgba(62,42,27,.75)` | `rgba(255,232,207,.14)` / `rgba(255,232,207,.23)` | `#FFF7EE` / `#D1BDA8` / `#987F68` | `#FFC47A` **pending palette bundle** |
| `emerald` — Emerald Circuit | `#08100D` (proposed) / `#08100D` / `#050806` | `rgba(9,19,15,.77)` / `rgba(19,41,32,.58)` / `rgba(25,51,39,.75)` | `rgba(214,255,235,.14)` / `rgba(214,255,235,.23)` | `#F1FFF8` / `#B7D0C2` / `#7A9788` | `#67E7AD` **pending palette bundle** |
| `porcelain` — Porcelain Glass (light) | `#EEF2F7` (proposed) / `#EEF2F7` / `#E3E9F2` | `rgba(244,247,252,.82)` / `rgba(255,255,255,.72)` / `rgba(255,255,255,.88)` | `rgba(25,42,70,.14)` / `rgba(25,42,70,.24)` | `#101826` / `#435268` / `#6C7C93` | `#4773D8` **pending palette bundle** |

`porcelain` is the only light color scheme. Keep stable IDs (not display labels) in persistence and selectors. The custom `#RRGGBB` picker is permitted to change only `--pm-accent`, `--pm-accent-rgb`, `--pm-accent-ink`, and the accent-derived soft/glow colors; it must not alter status, layout, typography, or access state. Persist only in the existing UI preference key `pm-theme-preference-v2`; do not treat it as user/project data.

### 4.3 Typography

| Token | Candidate value |
|---|---|
| `--pm-font-sans` | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (current family) |
| `--pm-font-mono` | `ui-monospace, SFMono-Regular, Consolas, monospace` |
| `--pm-font-size-2xs` | `0.75rem` / 12px; non-critical metadata floor |
| `--pm-font-size-xs` | `0.8125rem` / 13px |
| `--pm-font-size-sm` | `0.875rem` / 14px; compact body/control labels |
| `--pm-font-size-md` | `1rem` / 16px; default body |
| `--pm-font-size-lg` | `1.125rem` / 18px |
| `--pm-font-size-xl` | `1.25rem` / 20px |
| `--pm-font-size-2xl` | `1.5rem` / 24px |
| `--pm-font-size-3xl` | `1.875rem` / 30px |
| `--pm-font-size-4xl` | `2.25rem` / 36px |
| `--pm-line-height-tight` / `--pm-line-height-heading` / `--pm-line-height-body` | `1.15` / `1.25–1.35` / `1.5` |
| `--pm-font-weight-regular` / `medium` / `semibold` / `bold` | `400` / `500` / `600` / `700` |

Use 16px body text by default and 14px only for compact controls or dense table cells. Do not use text below 12px for meaningful content, instructions, labels, errors, dates, or status. Keep long-form line length near 65–75 characters; use tabular numerals for aligned counts/timestamps. Do not encode hierarchy through letter-spacing or weight alone. Existing 7–10px text styles in the stylesheet are migration drift, not the accessibility target.

### 4.4 Spacing, sizing and shapes

| Token | Candidate value |
|---|---|
| `--pm-space-0` | `0` |
| `--pm-space-1` through `--pm-space-6` | `4px`, `8px`, `12px`, `16px`, `20px`, `24px` |
| `--pm-space-8` / `--pm-space-10` / `--pm-space-12` / `--pm-space-16` | `32px` / `40px` / `48px` / `64px` |
| `--pm-content-max-width` | `1480px` (current page max-width) |
| `--pm-control-height-sm` / `md` / `lg` | `32px` / `40px` / `44px` |
| `--pm-field-min-height` | `40px` on pointer layouts; `44px` on touch layouts |
| `--pm-target-min` | `44px` × `44px` minimum for touch targets; allow at least 8px separation where practical |
| `--pm-radius-sm` / `--pm-radius-md` / `--pm-radius-lg` / `--pm-radius-pill` | `8px` / `14px` / `20px` / `999px` |

Use the 4px base scale consistently. Existing `--pm-radius` is a compatibility alias for `--pm-radius-md`; do not remove it in the planning phase. Compact 32px controls are pointer-only density exceptions, not touch targets. Keep layouts `min-width: 0`; only inherently wide tables and spatial canvases may scroll internally, with a usable alternative for keyboard and small-screen users.

### 4.5 Focus and keyboard interaction

| Token | Candidate value |
|---|---|
| `--pm-focus-width` | `2px` |
| `--pm-focus-offset` | `2px` |
| `--pm-focus-color` | `var(--pm-accent)` when it meets the 3:1 non-text contrast requirement against the adjacent surface |
| `--pm-focus-keyline` | `var(--pm-canvas)`; use a contrasting text/canvas double-keyline fallback when custom accent fails contrast |

Show focus for keyboard users on every actionable control; do not remove outlines without an equivalent. Focus must not be clipped by scroll containers or obscured by sticky headers/overlays. Tab order follows visual and semantic order. Dialogs trap focus only while modal, have an accessible name/description, close by Escape when safe, and return focus to the opener. Menus and listboxes use their standard arrow-key behavior. Shortcuts must not steal keystrokes while focus is in an input, textarea, or content-editable region. Drag actions require keyboard alternatives.

### 4.6 Motion and reduced motion

| Token | Candidate value |
|---|---|
| `--pm-motion-fast` / `--pm-motion-base` / `--pm-motion-slow` | `140ms` / `180ms` / `240ms` |
| `--pm-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--pm-ease-emphasis` | `cubic-bezier(0.22, 1, 0.36, 1)` (existing `--pm-spring`) |

Animate only meaningful state changes; favor opacity/transform, avoid animating layout dimensions, and keep non-essential loops/decorative orbs out of the interaction path. Under `prefers-reduced-motion: reduce`, stop looping and parallax/spring motion, disable smooth scrolling, and reduce non-essential transitions/animations to immediate state changes (the existing `0.01ms` override is acceptable). Never remove status feedback merely because motion is disabled. Do not make motion the sole carrier of information.

### 4.7 Responsive rules

Use the breakpoints already in `index.css` as the candidate standard; do not create extra competing breakpoints in this planning phase. CSS custom properties are not used for media-query breakpoints.

| Viewport | Rule |
|---|---|
| `>1120px` | Full shell and multi-column workspace; content remains capped at `1480px`. |
| `≤1120px` | Compact rail/gutters; reduce secondary-column widths without shrinking readable content below the defined type scale. |
| `≤850px` | Stack secondary panels/inspectors; preserve content order and keyboard sequence. Canvas/Automation panels may move below the work surface. |
| `≤780px` | Mobile navigation disclosure/drawer; single-column forms and page headings; touch targets ≥44px; no page-level horizontal overflow. |
| `320–390px` and 400% zoom | WCAG reflow check; only inherently wide data or spatial content can scroll within its own region and must retain an accessible non-drag/list alternative. |

Validate at 1440, 1120, 850, 780, 390 and 320 CSS px, plus 400% zoom. Ensure dialogs and theme menus fit within the visual viewport, content can be enlarged, and focus is not hidden behind sticky shell elements.

### 4.8 Z-index and overlay stack

| Token | Value | Layer |
|---|---:|---|
| `--pm-z-base` | `0` | Content/normal flow |
| `--pm-z-shell` | `10` | Sticky shell/navigation |
| `--pm-z-menu` | `20` | Context menu/popover |
| `--pm-z-inspector` | `30` | Inspector or sheet |
| `--pm-z-scrim` | `40` | Modal scrim/backdrop |
| `--pm-z-dialog` | `50` | Dialog |
| `--pm-z-command` | `60` | Command palette |
| `--pm-z-toast` | `70` | Toast/urgent transient feedback |
| `--pm-z-canvas-drag` | `4` (local stacking context only) | Dragging item within its canvas, never a global `9999` |

Use one overlay root/manager and the same scale across routes. Keep a nested menu inside the owning overlay’s local stacking context. Do not use ad hoc `z-index: 80` or global `9999`; current stylesheet values at those levels are known conflicts to normalize in a later code task. The order and focus behavior of nested dialogs/menus must be tested before implementation.

## 5. Accessibility acceptance criteria

These are future verification gates, not a claim that the current UI has passed them.

1. **Contrast (WCAG 2.2 AA):** normal text ≥4.5:1; large text ≥3:1; meaningful controls, icons, boundaries and focus indicators ≥3:1 against adjacent colors. Validate rendered alpha-composited surfaces for all six themes, selected/disabled/error states, and custom accents. Do not infer contrast from hex values alone.
2. **Meaning:** status, priority, selection, error and progress are never represented by color alone; pair color with a text label/icon/pattern. Every icon-only button has an accessible name.
3. **Keyboard:** all actions are reachable and usable without pointer/drag; logical focus order, visible focus, safe Escape, no keyboard traps except modal dialogs, and focus return on close.
4. **Forms and feedback:** persistent labels, associated help/error text, errors announced and placed by the relevant field; async updates use an appropriate live region; busy controls prevent duplicate submit and expose progress.
5. **Reflow/zoom:** no page-level horizontal scroll at 320 CSS px or 400% zoom; only table/spatial regions may scroll internally, with alternatives where applicable.
6. **Motion:** respect `prefers-reduced-motion`; no essential content appears only during animation.
7. **Touch:** primary touch targets at least 44×44px with practical spacing; no hover-only information or controls.
8. **Validation matrix:** test each preset plus at least one custom accent that exercises the contrast fallback; keyboard-only, screen-reader labels, 1440/1120/850/780/390/320 widths, zoom/reflow, reduced motion, focus layering, empty/loading/error states. Typecheck/build alone do not prove accessibility.

## 6. Current reconciliation gaps (not implementation instructions)

- The live provider and progress tracker agree on current theme IDs/names and `#54C8FF`; the redesign plan lists the conflicting `#63C6FF` palette. P2-06 must ratify a single palette bundle.
- `index.css` has semantic colors but no complete canonical typography/spacing/sizing/focus/motion/z-index token set. Many local text declarations are 7–10px; the target floor is 12px for non-critical metadata and 14–16px for ordinary UI/body.
- Focus currently uses a 2px accent outline; the canonical rule must include a contrast-safe fallback for arbitrary custom hex colors.
- Reduced-motion support already exists; preserve it and extend behavior to new transitions, animation loops, scroll behavior, and motion-only canvas interactions.
- Breakpoints exist at 1120/850/780px. The shared contract should consolidate around those values and add explicit 320px/400%-zoom acceptance testing.
- The current CSS has inconsistent global overlay levels (`20`, `50`, `60`, `80`) and a canvas drag value of `9999`; use the tokenized local/global stack in §4.8 when a separately authorized implementation card is opened.

## 7. Approval boundary and next gate

**Single owner question for `t_7ac0e3a2`:** approve the live/tracker palette bundle (`#54C8FF`, Carbon Orchid, Aurora Mint, Emerald Circuit) as canonical, or replace it with the alternate bundle in `UI_UX_REDESIGN_PLAN.md` (`#63C6FF`, Prism Violet, Aurora Teal, Juniper)? The rest of the candidate dictionary should be approved/edited in the same Phase 2 foundation gate before any token implementation starts.

Until that gate records approval, this file is a review draft only. No implementation, source edit, CSS rename, local-storage migration, contrast claim, or Automation runtime authorization is implied.

## 8. Source references

- `PHASE1_DISCOVERY_DECISION_PACK.md` — document authority, verified baseline and palette conflict.
- `UI_UX_PROGRESS.md` — recorded locked decisions, glass values, theme names/IDs, storage key.
- `UI_UX_REDESIGN_PLAN.md` — approved graphite-glass direction, conflicting palette, reduced-motion principle and base overlay sequence.
- `frontend/src/theme/ThemeProvider.tsx` — live theme IDs, names, accent values and custom-accent behavior.
- `frontend/src/index.css` — live color/surface values, focus treatment, responsive breakpoints, reduced-motion rule, and z-index conflicts.
