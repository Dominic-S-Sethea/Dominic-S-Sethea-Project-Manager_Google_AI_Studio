# PM-P2-04 — Canonical `--pm-*` Design-Token Dictionary & Accessibility Rules

| Field | Value |
|---|---|
| Kanban card | **PM-P2-04** |
| Title | Canonical `--pm-*` design-token dictionary and accessibility rules |
| Status | **PLANNING ARTIFACT — PROPOSED DECISIONS AWAIT OWNER APPROVAL** |
| Date | 2026-11-10 |
| Workspace | `<workspace>` |
| Scope | Read-only planning. **No application source was modified.** |
| Authoritative sources | `frontend/src/index.css`, `frontend/src/theme/ThemeProvider.tsx`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/**` (live code) |
| Related docs | `PHASE1_DISCOVERY_DECISION_PACK.md` §2.4/§5.8, `handoff_future_uiux.md` §2/§4 rule 10, `UI_UX_REDESIGN_PLAN.md`, `design-system.md` §2.1/§30.3/§32 |

**Status legend used throughout**

| Tag | Meaning |
|---|---|
| `[CURRENT]` | Verified in live source at the cited path/line. |
| `[PROPOSED]` | Decision required from the owner; not yet adopted. |
| `[PROPOSED-NEW]` | New token / rule / pattern that does not exist today. |
| `[GAP]` | Verified defect or missing capability in the current implementation. |
| `[DEPRECATED-PLANNED]` | To be removed only after a documented alias period. |

---

## 1. Purpose

This artifact defines:

1. The **verified inventory** of every `--pm-*` token and theme preset, with exact paths and line numbers.
2. A **canonical six-core-token namespace** that reconciles the handoff's "six `--pm-*` tokens" with the 27 working variables that actually exist.
3. **Supporting-token governance** so the system can grow without creating a competing second system.
4. The **six themes** and their token values.
5. Token dictionaries and rules for **typography, spacing, sizing, radius, elevation/z-index, focus, motion, reduced-motion, responsive breakpoints, contrast, keyboard, and screen-reader** behavior.
6. **Migration notes** that preserve all working styles — nothing is deleted in this proposal.
7. **Explicit acceptance criteria** for implementation.

This document is a **planning/decision artifact**, not an implementation authorization. All `[PROPOSED]` items require owner approval before code changes.

---

## 2. Evidence base and method

All findings below were produced by reading the live files directly (Python/`os` + regex line extraction), not from prose documentation. Measured values (contrast ratios) were computed from the actual token values with the WCAG 2.1/2.2 relative-luminance formula; panel backgrounds were composited as `glass rgba` over `canvas`, plus the white sheen gradient midpoint (`rgba(255,255,255,0.055)`) used by `.pm-glass-panel` (`index.css` L206).

| Evidence | Source | Method |
|---|---|---|
| 27 `:root` tokens, lines 7–33 | `frontend/src/index.css` | regex extraction of `--pm-*: value;` |
| 5 theme override blocks | `frontend/src/index.css` | regex extraction per `html[data-pm-theme="…"]` |
| 6 presets, storage keys, aliases | `frontend/src/theme/ThemeProvider.tsx` | full-file read |
| FOUC bootstrap + theme-color | `frontend/index.html` | full-file read |
| Provider order | `frontend/src/main.tsx` | full-file read |
| Token consumption counts | `frontend/src/**` | regex count across `.tsx/.ts/.css` |
| Contrast ratios | computed | WCAG formula on parsed token values |
| A11y pattern inventory | `frontend/src/**` | regex for `aria-*`, `role`, `focus`, `tabIndex`, `prefers-reduced-motion`, `sr-only`, skip links |

---

## 3. Current inventory (verified)

### 3.1 CSS custom properties — `frontend/src/index.css` (490 lines)

`:root` block spans **L5–L44**. `color-scheme: dark` at L6.

| Line | Token | Value | Category |
|---|---|---|---|
| L7 | `--pm-canvas` | `#090b0f` | core (surface) |
| L8 | `--pm-canvas-deep` | `#050609` | supporting (surface) |
| L9 | `--pm-rail` | `rgba(12, 15, 21, 0.74)` | core (surface) |
| L10 | `--pm-glass` | `rgba(21, 27, 37, 0.56)` | core (surface) |
| L11 | `--pm-glass-strong` | `rgba(28, 35, 47, 0.74)` | supporting (surface) |
| L12 | `--pm-glass-soft` | `rgba(255, 255, 255, 0.045)` | supporting (surface) |
| L13 | `--pm-glass-hover` | `rgba(255, 255, 255, 0.082)` | supporting (surface) |
| L14 | `--pm-border` | `rgba(211, 228, 255, 0.13)` | core (edge) |
| L15 | `--pm-border-strong` | `rgba(215, 234, 255, 0.22)` | supporting (edge) |
| L16 | `--pm-text` | `#f4f8ff` | core (ink) |
| L17 | `--pm-text-secondary` | `#aebcd0` | supporting (ink) |
| L18 | `--pm-text-muted` | `#738197` | supporting (ink) |
| L19 | `--pm-accent` | `#54C8FF` | core (brand) |
| L20 | `--pm-accent-rgb` | `84, 200, 255` | supporting (brand; RGB triplet) |
| L21 | `--pm-accent-ink` | `#06131A` | supporting (brand) |
| L22 | `--pm-accent-soft` | `rgba(var(--pm-accent-rgb), 0.13)` | supporting (brand) |
| L23 | `--pm-accent-glow` | `rgba(var(--pm-accent-rgb), 0.26)` | supporting (brand) |
| L24 | `--pm-success` | `#73d6a3` | supporting (status) |
| L25 | `--pm-warning` | `#f2be6e` | supporting (status) |
| L26 | `--pm-danger` | `#f0838c` | supporting (status) |
| L27 | `--pm-info` | `#95b9ff` | supporting (status) |
| L28 | `--pm-radius-sm` | `8px` | supporting (shape) |
| L29 | `--pm-radius` | `14px` | supporting (shape) |
| L30 | `--pm-radius-lg` | `20px` | supporting (shape) |
| L31 | `--pm-shadow` | `0 18px 44px rgba(0,0,0,.28), inset 0 1px rgba(255,255,255,.055)` | supporting (elevation) |
| L32 | `--pm-shadow-float` | `0 26px 70px rgba(0,0,0,.5), inset 0 1px rgba(255,255,255,.07)` | supporting (elevation) |
| L33 | `--pm-spring` | `cubic-bezier(0.22, 1, 0.36, 1)` | supporting (motion) |

**Total: 27 `--pm-*` tokens in `:root`.** This matches the Phase 1 verified count (`PHASE1_DISCOVERY_DECISION_PACK.md` L65/L190).

**Bridge tokens** (defined at L34–L43, consumed nowhere else): `--color-bg`, `--color-surface`, `--color-primary`, `--color-accent`, `--color-text`, `--color-muted`, `--color-border`, `--color-error`, `--color-success`, `--color-warning` — each aliases a `--pm-*` token. `[GAP] F-08` these ten bridges are dead code outside `index.css` (usage count 1 = the definition itself).

### 3.2 Theme override blocks — `frontend/src/index.css`

| Theme | Selector | Lines | Tokens defined | Missing vs `:root` |
|---|---|---|---|---|
| crystal (Obsidian Signal) | `:root` (default; no attribute) | L5–L44 | all 27 | — |
| violet | `html[data-pm-theme="violet"]` | L46–L57 | 10 (canvas, canvas-deep, rail, glass, glass-strong, border, border-strong, text, text-secondary, text-muted) | 17 |
| aurora | `html[data-pm-theme="aurora"]` | L59–L70 | 10 | 17 |
| ember | `html[data-pm-theme="ember"]` | L72–L83 | 10 | 17 |
| emerald | `html[data-pm-theme="emerald"]` | L85–L96 | 10 | 17 |
| porcelain | `html[data-pm-theme="porcelain"]` | L443–L457 | 12 (adds `color-scheme: light` L444, `--pm-shadow` L455, `--pm-shadow-float` L456) | 15 |

`[GAP] F-04` No theme block defines `--pm-accent*`, `--pm-success/warning/danger/info`, radius, or spring. Accent is instead written inline by JS (see 3.3), which has higher specificity than the attribute blocks. Status/radius/motion tokens are shared by all six themes — this is the root cause of the porcelain contrast failures in §8.1.

### 3.3 Theme presets — `frontend/src/theme/ThemeProvider.tsx` (206 lines)

| Line(s) | Item | Value |
|---|---|---|
| L3 | `ThemePreset` type | `"crystal" \| "violet" \| "aurora" \| "ember" \| "emerald" \| "porcelain"` |
| L5–L10 | `ThemeDefinition` | id, name, description, accent |
| L12–L49 | `THEME_PRESETS` (6) | see table below |
| L71 | `STORAGE_KEY` | `"pm-theme-preference-v2"` |
| L72 | `DEFAULT_THEME` | `{ theme: "crystal", accent: "#54C8FF", hasCustomAccent: false }` |
| L75–L83 | hex validation/normalization | `#RRGGBB` only, uppercased |
| L94–L101 | `accentInk()` | luminance > 0.42 → `#06131A`, else `#F7FCFF` |
| L103–L117 | `normalizeThemeId()` | aliases: `obsidian→crystal`, `prism→violet`, `juniper→emerald` |
| L119–L143 | `readStoredTheme()` | v2 JSON, then legacy `pm-ui-theme` / `pm-ui-custom-accent` |
| L148–L162 | effect | sets `documentElement.dataset.pmTheme` (L150), `.dark` class unless porcelain (L151), inline `--pm-accent` (L152), `--pm-accent-rgb` (L153), `--pm-accent-ink` (L154) |
| L164–L197 | context value | `setTheme`, `setPreset`, `setCustomAccent`, `setAccent`, `resetAccent`, `resetTheme` |
| L202–L206 | `useTheme()` | throws outside provider |

| # | id | Name | Accent | Default | Defined in |
|---|---|---|---|---|---|
| 1 | `crystal` | Obsidian Signal | `#54C8FF` | **yes** | `:root` L7–L33 + L14–L18 |
| 2 | `violet` | Carbon Orchid | `#C7A6FF` | no | L46–L57 + L20–L24 |
| 3 | `aurora` | Aurora Mint | `#87E2C0` | no | L59–L70 + L26–L30 |
| 4 | `ember` | Forge Amber | `#FFC47A` | no | L72–L83 + L32–L36 |
| 5 | `emerald` | Emerald Circuit | `#67E7AD` | no | L85–L96 + L38–L42 |
| 6 | `porcelain` | Porcelain Glass | `#4773D8` | no (light) | L443–L457 + L44–L48 |

### 3.4 FOUC bootstrap — `frontend/index.html` (68 lines)

- L2: `<html lang="en" class="dark" data-pm-theme="crystal">`
- L6: `<meta name="theme-color" content="#080B11" />`
- L8–L61: inline IIFE that reads `pm-theme-preference-v2`, maps aliases (L22–L32), sets `data-pm-theme` (L55), `.dark` (L56), `--pm-accent` (L57), `--pm-accent-rgb` (L58), `--pm-accent-ink` (L59) before first paint.
- L64–L67: `#root` + module script.

### 3.5 Provider order — `frontend/src/main.tsx` L54

`QueryClientProvider → BrowserRouter → AuthProvider → ThemeProvider → Root`. ThemeProvider wraps all routes including login, so the glass system applies app-wide. `[CURRENT]`

### 3.6 Consumption evidence (regex counts across `frontend/src/**`)

| Token | Uses | Files | Notes |
|---|---|---|---|
| `--pm-text` | 300 | 28 | heavily used |
| `--pm-border` | 188 | 24 | heavily used |
| `--pm-accent` | 160 | 18 | heavily used |
| `--pm-text-muted` | 131 | 21 | heavily used |
| `--pm-glass` | 76 | 19 | heavily used |
| `--pm-text-secondary` | 68 | 17 | heavily used |
| `--pm-danger` | 41 | 13 | |
| `--pm-radius` | 45 | 4 | |
| `--pm-glass-strong` | 36 | 4 | |
| `--pm-radius-sm` | 35 | 4 | |
| `--pm-success` | 29 | 10 | |
| `--pm-shadow` | 22 | 4 | |
| `--pm-canvas` | 21 | 2 | CSS + CanvasViewport |
| `--pm-accent-rgb` | 20 | 2 | CSS + ThemeProvider |
| `--pm-warning` | 25 | 4 | |
| `--pm-glass-soft` | 14 | 4 | |
| `--pm-spring` | 14 | 1 (index.css) | **only consumed inside CSS** |
| `--pm-shadow-float` | 11 | 4 | |
| `--pm-accent-ink` | 10 | 4 | |
| `--pm-canvas-deep` | 10 | 1 (index.css) | **only consumed inside CSS** |
| `--pm-accent-glow` | 5 | 1 (index.css) | |
| `--pm-radius-lg` | 3 | 3 | |
| `--pm-glass-hover` | 2 | 2 | |
| `--pm-info` | 9 | 2 | |
| `--pm-rail` | 8 | 1 (index.css) | **only consumed inside CSS** |
| `--color-*` (10 bridges) | 1 each | 1 | **dead outside index.css — `[GAP] F-08`** |

---

## 4. Findings and reconciliation

### F-01 — The "six tokens" claim vs. reality `[CURRENT]`

`handoff_future_uiux.md` L39/L66 and `PHASE1_DISCOVERY_DECISION_PACK.md` L69/L125 describe **six** `--pm-*` tokens. The implementation has **27**. This is not an instruction to delete 21 working variables; it is a **governance gap** (Phase 1 risk #8). The canonical namespace in §5 resolves it.

### F-02 — Two conflicting "six token" lists in the docs `[GAP]`

| Source | List |
|---|---|
| `handoff_future_uiux.md` L39 | `--pm-accent`, `--pm-text-muted`, `--pm-border`, `--pm-bg`, `--pm-glass`, `--pm-canvas` |
| `PHASE1_DISCOVERY_DECISION_PACK.md` L65 | `--pm-bg`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, `--pm-text` |

Neither list matches the code. **`--pm-bg` does not exist anywhere** in the repository. The canonical set in §5 is the union that exists in code: `--pm-canvas`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, `--pm-text`.

### F-03 — Documentation references to nonexistent tokens `[GAP]`

`docs/AI_CONTEXT.md` L15–L19 lists `--pm-bg` and `--pm-glass-border` as if they exist. Actual tokens: `--pm-canvas` and `--pm-border`. Proposed fix: add read-only aliases (see §5.4) and correct the doc.

### F-04 — Theme blocks are incomplete `[GAP]`

Only 10–12 of 27 tokens are theme-overridden. `--pm-accent*` is controlled by JS inline styles (higher specificity), so CSS theme blocks cannot change it. Status colors, radius, and motion are never themed. This directly causes the porcelain failures (§8.1).

### F-05 — Doc drift on default color `[GAP]`

`handoff_future_uiux.md` L39 says default `#080B11/#54C8FF`; `index.html` L6 `theme-color` is `#080B11`; actual `--pm-canvas` is `#090b0f` (L7). Minor, but docs must cite the code value.

### F-06 — Theme naming drift `[GAP]`

`handoff_future_uiux.md` L39 uses legacy names "Prism Violet", "Aurora Teal", "Juniper". Current presets are "Carbon Orchid", "Aurora Mint", "Emerald Circuit" (`ThemeProvider.tsx` L20–L42). Aliases `prism`/`juniper` exist in code (L109/L113); names should be updated in docs.

### F-07 — Duplicated media queries `[GAP]`

Breakpoints are declared twice: L300–L307 (`1120px`) and L309–L325 (`780px`), then again at L432 (`1120px`), L433 (`850px`), L434 (`780px`), L485–L490 (`780px`). Values are consistent but the duplication is a maintenance hazard and blocks a single breakpoint token source.

### F-08 — Dead bridge tokens `[GAP]`

The ten `--color-*` aliases (L34–L43) are unused outside `index.css`. They were presumably intended as a migration bridge. Either adopt them as the public component API or remove them; leaving them is ambiguity.

### F-09 — Hardcoded values remain in components and CSS `[GAP]`

Examples: `.pm-topbar` background `rgba(7, 9, 13, .46)` (L183), `.pm-custom-accent` background `rgba(0,0,0,.08)` (L239), `.pm-theme-swatch` background `linear-gradient(145deg, #06070a, #15191f)` (L235), `.pm-theme-preview` background `#090b0e` (L413), inline `outline: "none"` in `ProjectSwitcher.tsx` L264. These bypass the token system and will not theme correctly.

### F-10 — Accessibility patterns exist but are uneven `[CURRENT]`

- `aria-*` attributes: 101; `role`: 47; `aria-label`: 55; `aria-labelledby`: 11; `aria-modal`: 8; `aria-live`: 8; `aria-pressed`: 8.
- `Icon.tsx` sets `aria-hidden: true` on all decorative SVGs — good.
- `TaskCard.tsx` L119–L126/L166–L168 implements Enter/Space activation with `role="button"` + `tabIndex` — good pattern, but not replicated everywhere.
- `UserList.tsx` L140 uses `aria-busy`; `ThemeCustomizer.tsx` L103 uses `role="status"` — good.
- `ProjectSwitcher.tsx` implements Escape + focus management — good.

### F-11 — Missing a11y infrastructure `[GAP]`

- **No skip-to-content link** anywhere (0 matches for skip link patterns).
- **No `.sr-only` / visually-hidden utility** (0 matches).
- **No focus trap** in any dialog (`aria-modal` is declared but Tab is not cycled; only `autoFocus` on `TaskWorkspace.tsx` L1235).
- **Static page `<title>`** (`Project Manager`, index.html L7) — does not change per route.
- **Non-focusable horizontal scroll regions**: `.pm-task-surface { overflow-x: auto }` (L403) with `.pm-task-table { min-width: 700px }` (L403) and no `tabIndex`/`aria-label` — keyboard users cannot scroll the task table horizontally.
- **Inline `outline: "none"`** at `ProjectSwitcher.tsx` L264 removes focus indication without a replacement.

---

## 5. PROPOSED canonical six-core-token namespace

### 5.1 The six core tokens `[PROPOSED]`

These six are the **only** tokens a new component may use for the six foundational roles. They are the minimal set that can re-skin every surface, and they are the set that both handoff lists approximate.

| # | Canonical token | Role | Current definition | Notes |
|---|---|---|---|---|
| 1 | `--pm-canvas` | Workspace background | L7 `#090b0f` | replaces the nonexistent `--pm-bg` in docs |
| 2 | `--pm-rail` | Persistent navigation/sidebar surface | L9 `rgba(12,15,21,.74)` | |
| 3 | `--pm-glass` | Primary panel surface | L10 `rgba(21,27,37,.56)` | |
| 4 | `--pm-border` | Default hairline/edge | L14 `rgba(211,228,255,.13)` | replaces the nonexistent `--pm-glass-border` in docs |
| 5 | `--pm-accent` | Brand/emphasis/interaction | L19 `#54C8FF` (inline from JS) | |
| 6 | `--pm-text` | Primary ink | L16 `#f4f8ff` | |

### 5.2 Supporting tokens (21) and their tiers `[PROPOSED]`

| Tier | Tokens | Rule |
|---|---|---|
| A — Surface/edge/ink supporting | `--pm-canvas-deep`, `--pm-glass-strong`, `--pm-glass-soft`, `--pm-glass-hover`, `--pm-border-strong`, `--pm-text-secondary`, `--pm-text-muted` | May be used when no core token expresses the intent; must be justified in review. |
| B — Accent supporting | `--pm-accent-rgb`, `--pm-accent-ink`, `--pm-accent-soft`, `--pm-accent-glow` | Derived from accent; never set independently by components. |
| C — Status | `--pm-success`, `--pm-warning`, `--pm-danger`, `--pm-info` | Never remapped by custom accent; must have per-theme values (see §8.1). |
| D — Shape/elevation/motion | `--pm-radius-sm`, `--pm-radius`, `--pm-radius-lg`, `--pm-shadow`, `--pm-shadow-float`, `--pm-spring` | Consumed by CSS only; not exposed to component logic. |

### 5.3 Governance rules `[PROPOSED]`

| ID | Rule |
|---|---|
| G-01 | **Six-core rule** — new components use only the six core tokens for background, navigation surface, panel surface, default border, brand emphasis, and primary text. |
| G-02 | **Supporting-token justification** — a supporting token may be used only when no core token fits; the review must name the core token considered and why it was insufficient. |
| G-03 | **No hardcoded values** — no hex, rgba, or px literals in component styles; all values come from tokens. (Exceptions: the swatch/preview chrome inside the theme picker itself, and the legacy Tailwind override layer L248–L282, which is frozen.) |
| G-04 | **Six-theme completeness** — every token must either define a value for all six themes or carry an explicit `/* not themed: reason */` annotation. |
| G-05 | **Accent isolation** — JS writes only `--pm-accent`, `--pm-accent-rgb`, `--pm-accent-ink` (current behavior, `ThemeProvider.tsx` L152–L154). No other token is written at runtime. |
| G-06 | **New-token process** — a new token requires: name, category, six-theme values, contrast evidence, migration note, and an update to this document. No token is added by implementation alone. |
| G-07 | **Deprecation lifecycle** — a token is never deleted silently. It is aliased for ≥ 1 release, marked `[DEPRECATED-PLANNED]`, and removed only with a changelog entry. |
| G-08 | **RGB triplet contract** — `--pm-accent-rgb` remains a bare triplet (`84, 200, 255`) because it feeds `rgba(var(--pm-accent-rgb), α)` compositions (L22–L23). |
| G-09 | **Status immutability** — custom accent changes never alter `--pm-success/warning/danger/info` meanings. |
| G-10 | **Naming** — `--pm-<category>-<role>[-variant]`; categories: `canvas`, `rail`, `glass`, `border`, `text`, `accent`, `success`, `warning`, `danger`, `info`, `radius`, `shadow`, `spring`, `space`, `duration`, `ease`, `z`, `focus`, `font`, `size`. No one-off names. |
| G-11 | **Single source** — this document plus `index.css` `:root` are the token source of truth. Prose docs cite tokens by canonical name only. |
| G-12 | **Dead code** — the ten `--color-*` bridges (L34–L43) are either adopted as the public API or removed in the same change that resolves F-08. |

### 5.4 Proposed aliases for documentation drift `[PROPOSED-NEW]`

```css
/* Read-only aliases for handoff/doc compatibility. Do not consume in components. */
:root {
  --pm-bg: var(--pm-canvas);      /* resolves F-02/F-03 */
  --pm-glass-border: var(--pm-border); /* resolves F-03 */
}
```

These are **aliases, not new tokens**; they add no surface area and keep working styles intact.

---

## 6. Six themes (canonical table) `[CURRENT]`

| # | id | Display name | Accent | Surface family | Defined in CSS | Defined in TS | Default |
|---|---|---|---|---|---|---|---|
| 1 | `crystal` | Obsidian Signal | `#54C8FF` | graphite-black glass | `:root` L5–L44 | L14–L18 | **yes** |
| 2 | `violet` | Carbon Orchid | `#C7A6FF` | smoky graphite glass | L46–L57 | L20–L24 | no |
| 3 | `aurora` | Aurora Mint | `#87E2C0` | deep green-black glass | L59–L70 | L26–L30 | no |
| 4 | `ember` | Forge Amber | `#FFC47A` | warm charcoal glass | L72–L83 | L32–L36 | no |
| 5 | `emerald` | Emerald Circuit | `#67E7AD` | neutral black glass | L85–L96 | L38–L42 | no |
| 6 | `porcelain` | Porcelain Glass | `#4773D8` | daylight frosted glass | L443–L457 | L44–L48 | no |

Legacy aliases (code): `obsidian→crystal`, `prism→violet`, `juniper→emerald` (`ThemeProvider.tsx` L105–L117; `index.html` L22–L32). `[PROPOSED]` Document the canonical names and treat legacy names as aliases only.

**Theme contract `[PROPOSED]`:** each theme must define all six core tokens explicitly (crystal via `:root`, the other five via their attribute block). Supporting tokens may be inherited from `:root` only when annotated.

---

## 7. Proposed token dictionary by domain

All new tokens below are `[PROPOSED-NEW]` unless marked otherwise. Values are proposals; exact values are confirmed during implementation with contrast re-measurement.

### 7.1 Color / semantic tokens

**Current:** 27 tokens (§3.1). **Proposed additions:** none beyond the two aliases in §5.4. **Proposed per-theme overrides:** status tokens must be themed for porcelain (§8.1).

| Token | crystal | violet | aurora | ember | emerald | porcelain | Status |
|---|---|---|---|---|---|---|---|
| `--pm-success` | `#73d6a3` | `#73d6a3` | `#73d6a3` | `#73d6a3` | `#73d6a3` | **`#157347`** | `[PROPOSED]` porcelain override (5.67:1) |
| `--pm-warning` | `#f2be6e` | `#f2be6e` | `#f2be6e` | `#f2be6e` | `#f2be6e` | **`#7d5300`** | `[PROPOSED]` porcelain override (6.52:1) |
| `--pm-danger` | `#f0838c` | `#f0838c` | `#f0838c` | `#f0838c` | `#f0838c` | **`#a41e22`** | `[PROPOSED]` porcelain override (7.28:1) |
| `--pm-info` | `#95b9ff` | `#95b9ff` | `#95b9ff` | `#95b9ff` | `#95b9ff` | **`#0d5aa7`** | `[PROPOSED]` porcelain override (6.68:1) |
| `--pm-accent` | `#54C8FF` | `#C7A6FF` | `#87E2C0` | `#FFC47A` | `#67E7AD` | **`#3F6BD3`** | `[PROPOSED]` porcelain accent adjusted (white text 4.94:1) |
| `--pm-text-muted` | **`#7c899e`** | **`#8f869d`** | `#789787` | **`#a08973`** | `#7a9788` | **`#66758b`** | `[PROPOSED]` ≥4.5:1 on panel |

### 7.2 Typography `[PROPOSED-NEW]`

**Current state:** `body` font-family Inter stack (`index.css` L102); mono stack used inline in dozens of rules; font sizes are ad hoc `7px–25px` (e.g., `.pm-nav-label` 8px L160, `.pm-button` 9px L214, `.pm-task-head` 8px L403, `h1` 25px L202/L361); weights are ad hoc `580/590/610/620/640/650/660/670/720`.

| Proposed token | Value | Maps from |
|---|---|---|
| `--pm-font-sans` | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | L102 |
| `--pm-font-mono` | `ui-monospace, SFMono-Regular, Consolas, monospace` | inline stacks |
| `--pm-text-xs` | `10px` | nav links, buttons |
| `--pm-text-sm` | `12px` | proposed body floor |
| `--pm-text-base` | `14px` | proposed body text |
| `--pm-text-lg` | `16px` | panel headings |
| `--pm-text-xl` | `20px` | |
| `--pm-text-2xl` | `25px` | `h1` L202/L361 |
| `--pm-leading-tight` | `1.08` | h1 line-height |
| `--pm-leading-normal` | `1.5` | body copy |
| `--pm-font-weight-regular` | `560` | |
| `--pm-font-weight-medium` | `600` | |
| `--pm-font-weight-semibold` | `640` | |
| `--pm-font-weight-bold` | `700` | |

**Usability floor `[PROPOSED]`:** body text ≥ 12px; captions/labels ≥ 10px; nothing below 10px. Current 7–8px values (e.g., `.pm-theme-choice small` 7px L234, `.pm-command-footer` 7px L413) are below the floor and must be raised in a dedicated layout card — **not** silently in this one.

### 7.3 Spacing `[PROPOSED-NEW]`

**Current state:** no spacing tokens; ad hoc `2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,23,24,26,28,32,40,42px` values.

| Proposed token | Value | Base unit |
|---|---|---|
| `--pm-space-2xs` | `2px` | 2 |
| `--pm-space-xs` | `4px` | 4 |
| `--pm-space-sm` | `8px` | 8 |
| `--pm-space-md` | `12px` | 12 |
| `--pm-space-lg` | `16px` | 16 |
| `--pm-space-xl` | `24px` | 24 |
| `--pm-space-2xl` | `32px` | 32 |
| `--pm-space-3xl` | `40px` | 40 |

**Migration mapping `[PROPOSED]`:** 9→8, 10→8 or 12, 13→12, 15→16, 17→16, 18→16, 20→16 or 24, 22→24, 23→24, 26→24, 28→24 or 32, 42→40. Pixel-perfect parity is **not** required; visual parity is.

### 7.4 Sizing / touch targets `[PROPOSED-NEW]`

**Current state:** buttons `min-height: 32px` (L214, L352), icon buttons `32×32` (L193), nav links `35px` (L162/L337), filter tabs `27px` (L403), inputs `28–37px` (L189/L243/L245/L403/L440), topbar `58px` (L180) / `52px` mobile (L317).

| Proposed token | Value | Rationale |
|---|---|---|
| `--pm-size-touch` | `44px` | project standard (`design-system.md` §32.1) |
| `--pm-size-control` | `36px` | secondary controls |
| `--pm-size-control-sm` | `30px` | dense tables |
| `--pm-size-icon` | `16px` | default icon |
| `--pm-size-icon-sm` | `14px` | inline icon |

**Rule `[PROPOSED]`:** primary actions 44px; secondary 36px; absolute minimum 24px (WCAG 2.2 AA target size) with ≥4px spacing; current 27–32px controls meet the 24px AA minimum but fail the project's own 44px standard — schedule a layout card.

### 7.5 Radius `[PROPOSED-NEW]`

**Current state:** `--pm-radius-sm: 8px` (L28), `--pm-radius: 14px` (L29), `--pm-radius-lg: 20px` (L30); hardcoded `4,5,6,7,8,9px` and `999px` throughout.

| Proposed token | Value | Maps from |
|---|---|---|
| `--pm-radius-xs` | `4px` | small chips |
| `--pm-radius-sm` | `8px` | current |
| `--pm-radius-md` | `12px` | dialogs (auth card 18px is an exception) |
| `--pm-radius-lg` | `16px` | |
| `--pm-radius-xl` | `20px` | current `--pm-radius-lg` |
| `--pm-radius-pill` | `999px` | pills/avatars |

**Decision `[PROPOSED]`:** keep existing `--pm-radius` (14px) as an alias of `--pm-radius-lg` to avoid breaking 45 usages; add the scale around it.

### 7.6 Elevation / z-index `[PROPOSED-NEW]`

**Current state:** `--pm-shadow` (L31), `--pm-shadow-float` (L32); z-index values are unnamed and scattered: `10` topbar (L182), `20` sidebar (L139), `50` project switcher (L424), `60` dialog backdrop (L404), `80` popover/command backdrop (L413), `9999` canvas dragging (L297), plus `0/2/3/4` inside automation (L430).

| Proposed token | Value | Maps from |
|---|---|---|
| `--pm-z-base` | `0` | |
| `--pm-z-raised` | `10` | topbar |
| `--pm-z-nav` | `20` | sidebar |
| `--pm-z-menu` | `50` | project switcher |
| `--pm-z-dialog` | `60` | dialog backdrop |
| `--pm-z-popover` | `80` | popover/command |
| `--pm-z-canvas-drag` | `9999` | canvas dragging |
| `--pm-shadow-sm` | `0 4px 12px rgba(0,0,0,.18)` | proposed |
| `--pm-shadow` | current | keep |
| `--pm-shadow-float` | current | keep |

**Elevation levels `[PROPOSED]`:** adopt `design-system.md` §30.2 levels 0–3 (workspace/card/raised/floating) as the semantic scale; keep glow-inset dark-theme treatment (§30.1).

### 7.7 Focus `[PROPOSED-NEW]`

**Current state:** `button/input/textarea/select/a:focus-visible { outline: 2px solid var(--pm-accent); outline-offset: 2px }` (L115–L118); canvas selection outline inline (`TaskCard.tsx` L143–L144); one inline `outline: "none"` violation (`ProjectSwitcher.tsx` L264).

| Proposed token | Value |
|---|---|
| `--pm-focus-width` | `2px` |
| `--pm-focus-offset` | `2px` |
| `--pm-focus-color` | `var(--pm-accent)` |
| `--pm-focus-ring` | `0 0 0 2px var(--pm-focus-color)` (equivalent shorthand) |

**Rules `[PROPOSED]`:** never `outline: none` without a replacement; focus indicator ≥ 2px and ≥ 3:1 against adjacent colors (WCAG 2.2 focus appearance). Measured accent vs panel: 7.67–9.69 dark themes, 4.30 porcelain — all pass 3:1.

### 7.8 Motion `[PROPOSED-NEW]`

**Current state:** `--pm-spring: cubic-bezier(0.22, 1, 0.36, 1)` (L33); durations are ad hoc: `140ms`, `150ms`, `160ms`, `200ms`, `.2s`, `.32s`, `1.2s`, `1.4s`, `1.6s`.

| Proposed token | Value | Maps from |
|---|---|---|
| `--pm-ease-spring` | `cubic-bezier(0.22, 1, 0.36, 1)` | current `--pm-spring` |
| `--pm-ease-standard` | `ease` | current `ease` usages |
| `--pm-duration-instant` | `100ms` | button press |
| `--pm-duration-fast` | `150ms` | buttons/nav |
| `--pm-duration-normal` | `200ms` | canvas items |
| `--pm-duration-slow` | `320ms` | canvas pop-in |
| `--pm-duration-emphasis` | `470ms` | success animation (design-system.md §3.2) |

**Rules `[PROPOSED]`:** reserve motion for meaningful state transitions (`design-system.md` §3.3); stagger lists at 100ms; keep `--pm-spring` as an alias of `--pm-ease-spring` for the 14 existing CSS usages.

### 7.9 Reduced motion `[PROPOSED]`

**Current state:** global `@media (prefers-reduced-motion: reduce)` sets `animation-duration: 0.01ms !important`, `animation-iteration-count: 1 !important`, `transition-duration: 0.01ms !important`, `scroll-behavior: auto !important` (L327–L329). This is a compliant blunt instrument.

**Rules `[PROPOSED]`:**

1. Keep the media query but drive it from tokens (`--pm-duration-*: 0.01ms` under reduce).
2. Add a JS `matchMedia('(prefers-reduced-motion: reduce)')` gate for JS-driven canvas animation (pop-in/out, pulse, shimmer, drag momentum) — CSS alone does not cover JS `requestAnimationFrame` effects.
3. Never remove essential state information: color/opacity state changes remain; only movement/animation is suppressed.
4. Provide a user-facing toggle in Appearance as an override (persisted), defaulting to the OS preference.
5. Honor `scroll-behavior: auto` for anchor navigation.

### 7.10 Responsive breakpoints `[PROPOSED-NEW]`

**Current state:** `1120px` (L300, L432), `850px` (L433), `780px` (L309, L434, L485). Duplicated and un-tokened (F-07).

| Proposed token | Value | Maps from |
|---|---|---|
| `--pm-bp-sm` | `640px` | new (small phones) |
| `--pm-bp-md` | `768px` | new |
| `--pm-bp-lg` | `850px` | current |
| `--pm-bp-xl` | `1120px` | current |
| `--pm-bp-2xl` | `1280px` | new |

**Rule `[PROPOSED]`:** CSS custom properties cannot be used in `@media` conditions without container queries or JS, so these tokens are (a) the documented canonical values, (b) used in JS/`matchMedia` logic, and (c) optionally consumed via container queries. Consolidate the duplicated blocks (F-07) into one source.

---

## 8. Accessibility rules

### 8.1 Contrast `[PROPOSED]`

**Measured evidence (WCAG formula on actual token values; panel = glass over canvas + sheen):**

| Theme | text/canvas | secondary/canvas | muted/canvas | accent/canvas | ink/accent | text/panel | muted/panel | accent/panel |
|---|---|---|---|---|---|---|---|---|
| crystal | 18.49 | 10.23 | 4.99 | 10.39 | 9.93 | 15.16 | **4.09 ✗** | 8.52 |
| violet | 18.07 | 10.13 | 5.06 | 9.67 | 9.26 | 14.33 | **4.01 ✗** | 7.67 |
| aurora | 18.65 | 11.63 | 6.04 | 12.55 | 12.25 | 14.17 | 4.59 ✓ | 9.54 |
| ember | 18.36 | 10.72 | 5.17 | 12.46 | 12.04 | 14.11 | **3.97 ✗** | 9.58 |
| emerald | 18.71 | 11.75 | 6.06 | 12.48 | 12.20 | 14.52 | 4.71 ✓ | 9.69 |
| porcelain | 15.82 | 7.06 | **3.78 ✗** | 3.96 | **4.31 ✗** | 17.18 | **4.10 ✗** | 4.30 ✓ |

**Status colors on panel (the critical defect):**

| Theme | success | warning | danger | info |
|---|---|---|---|---|
| crystal | 9.13 | 9.51 | 6.41 | 8.20 |
| violet | 8.82 | 9.18 | 6.19 | 7.92 |
| aurora | 8.28 | 8.63 | 5.81 | 7.44 |
| ember | 8.47 | 8.82 | 5.94 | 7.60 |
| emerald | 8.46 | 8.80 | 5.93 | 7.59 |
| **porcelain** | **1.71 ✗** | **1.64 ✗** | **2.43 ✗** | **1.90 ✗** |

**Rules `[PROPOSED]`:**

| ID | Rule |
|---|---|
| C-01 | Text ≥ 4.5:1 (AA normal) on its actual background (canvas **and** glass panel). |
| C-02 | Large text (≥18px regular / ≥14px bold) ≥ 3:1. |
| C-03 | UI components and focus indicators ≥ 3:1 against adjacent colors (WCAG 2.2). |
| C-04 | Never rely on color alone; pair status colors with text labels/icons. |
| C-05 | Fix porcelain status tokens (§7.1) — **P1 defect**, not optional. |
| C-06 | Fix porcelain accent ink (§7.1) — adjust accent to `#3F6BD3` (white 4.94:1). |
| C-07 | Raise muted text to ≥4.5:1 on panel in crystal/violet/ember/porcelain (§7.1). |
| C-08 | Border contrast 1.30–2.01 is acceptable for decorative dividers only; input boundaries must use `--pm-border-strong` plus a visible focus ring. |
| C-09 | Re-measure all pairs whenever a token value changes; record results in this document. |

### 8.2 Keyboard rules `[PROPOSED]`

| ID | Rule | Current state |
|---|---|---|
| K-01 | All interactive elements reachable via Tab in visual order. | Partial — most are; canvas items are. |
| K-02 | Enter/Space activate; Escape closes menus/dialogs/popovers and returns focus to the invoker. | Partial — Escape in AppShell L588, ProjectSwitcher L175, ContextMenu L39; focus return only in ProjectSwitcher. |
| K-03 | Arrow keys navigate composite widgets (tabs, menus, command palette, theme grid) with roving tabindex or focus movement. | Partial — ProjectSwitcher arrows; command palette partial. |
| K-04 | Modals (`aria-modal="true"`) trap Tab, close on Escape, restore focus to invoker. | **Missing** — no focus trap anywhere. `[GAP] F-11` |
| K-05 | "Skip to main content" link as first focusable element, visible on focus. | **Missing.** `[GAP] F-11` |
| K-06 | Canvas: arrow-key pan, +/- zoom, Delete removes selection, Escape deselects; visible focus on items. | Partial — space-pan exists (CanvasViewport L86–L90); Delete/arrows not verified. |
| K-07 | No global keyboard handler may block default browser behavior (e.g., space scrolling) outside its widget. | Risk in CanvasViewport L88 `preventDefault`. |
| K-08 | Command palette: Ctrl/Cmd+K opens (AppShell L588–L597), Escape closes, arrows navigate. | Partial. |
| K-09 | Focus indicator always visible (2px accent outline, offset 2px); never `outline: none` without replacement. | Violation at ProjectSwitcher L264. |
| K-10 | Mobile nav toggle exposes `aria-expanded`/`aria-controls`; Escape closes; focus moves into the menu. | Partial — toggle exists (AppShell L611–L618) but no `aria-expanded`. |
| K-11 | Horizontally scrollable regions are keyboard-focusable (`tabIndex={0}` + `aria-label`). | **Missing** for `.pm-task-surface` (L403). `[GAP] F-11` |

### 8.3 Screen-reader rules `[PROPOSED]`

| ID | Rule | Current state |
|---|---|---|
| SR-01 | One `<main>` per route; sidebar `<nav aria-label>`; `<aside>` labeled; sections with headings use `aria-labelledby`. | Partial — `main` exists in AppShell L714; `nav` only in AutomationStudio L128. |
| SR-02 | Every icon-only control has an accessible name (`aria-label` or visually hidden text). | Partial — 55 `aria-label`s; no `.sr-only` utility exists. |
| SR-03 | Decorative SVGs are `aria-hidden`; meaningful SVGs have `title`/`aria-label`. | Good — `Icon.tsx` sets `aria-hidden: true`. |
| SR-04 | Async feedback uses `role="status"`/`aria-live="polite"`; errors use `role="alert"`; loading uses `aria-busy`. | Partial — 8 live regions, `aria-busy` in UserList L140. |
| SR-05 | Dialogs: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, focus return. | Partial — labels exist; trap missing. |
| SR-06 | Canvas: text alternative (list view) for the diagram; each item `role="button"` with a full accessible name (title, status, priority); selection changes announced via live region; connections described textually. | **Missing.** `[GAP] F-11` |
| SR-07 | Forms: every input has a programmatic label (`htmlFor`/`id` or wrapping); `aria-required`/`aria-invalid`; errors linked with `aria-describedby`. | Partial — 17 `htmlFor`, 60 `<label>`; no `aria-invalid`/`aria-describedby` found. |
| SR-08 | Theme switcher uses a consistent pattern (radio group with `aria-checked`, or `aria-pressed` toggle group). | Inconsistent — `aria-pressed` in ThemeCustomizer L47, `aria-checked` in ProjectSwitcher. |
| SR-09 | Status is never conveyed by color alone. | Partial — status dots exist; adjacent text labels must be verified per component. |
| SR-10 | Page `<title>` updates per route. | **Missing** — static `Project Manager` (index.html L7). |

### 8.4 Touch targets `[PROPOSED]`

WCAG 2.2 AA minimum 24×24 CSS px; project standard 44px (`design-system.md` §32.1). Current controls are 27–37px. Rule: primary 44px, secondary 36px, minimum 24px with spacing; icon buttons 44px; nav links 44px. Schedule as a layout card.

### 8.5 Motion `[PROPOSED]`

See §7.8–§7.9. Additional rule: animations must be interruptible and must not block input (`design-system.md` §31.2).

### 8.6 Responsive `[PROPOSED]`

See §7.10. Additional rules: no horizontal page scroll at 375px width; tables may scroll inside a focusable region; the sidebar collapses behind the mobile toggle at ≤780px with proper ARIA state.

---

## 9. Migration notes — preserving working styles

**M-01 No deletions.** All 27 `--pm-*` tokens remain defined. Nothing in this proposal removes a working style. `[PROPOSED]`

**M-02 Add, don't replace.** The two aliases (§5.4), the new token families (§7), and the porcelain overrides (§7.1) are additive. Existing consumers continue to resolve the same values. `[PROPOSED]`

**M-03 Keep the cascade.** `:root` remains the crystal default; theme attribute blocks remain the override mechanism; `ThemeProvider` keeps writing only accent/rgb/ink inline (L152–L154). `[CURRENT]`

**M-04 Theme completeness is a separate card.** Adding per-theme status/radius/motion values (F-04) must not land in the same change as the porcelain contrast fix. `[PROPOSED]`

**M-05 Contrast fixes are the only urgent visual change.** Porcelain status colors (§7.1) and muted-text values (§7.1) are the minimal set needed to reach AA; they change appearance slightly but preserve hue families and all working styles. `[PROPOSED]`

**M-06 Font-size and spacing migrations are layout-affecting.** Raising 7–8px text and moving to the 4px spacing scale changes component geometry; these require a dedicated card, visual regression screenshots, and owner review. `[PROPOSED]`

**M-07 Frozen legacy layer.** The Tailwind override block (L248–L282) stays untouched; it exists to keep legacy routes glass-styled and is not part of the token migration. `[CURRENT]`

**M-08 Verification gates before every migration batch:** `npm run typecheck` and `npm run build` in `frontend/`; visual diff of all six themes; axe/Lighthouse audit; manual keyboard pass; screen-reader spot check. `[PROPOSED]`

**M-09 Documentation sync.** Update `docs/AI_CONTEXT.md` L15–L19 to canonical names; update `handoff_future_uiux.md` L39/L66 and `PHASE1_DISCOVERY_DECISION_PACK.md` L65 to cite this document; record the canonical six in `design-system.md` §2.1. `[PROPOSED]`

**M-10 Keep the RGB triplet.** `--pm-accent-rgb` stays a bare triplet (G-08). `[CURRENT]`

**M-11 Order of implementation (recommended):** (1) aliases + doc sync; (2) porcelain contrast fixes; (3) focus/skip-link/focus-trap infrastructure; (4) token families for spacing/typography/sizing/radius/z-index/motion/breakpoints; (5) component migrations in small batches per handoff rule 8. `[PROPOSED]`

---

## 10. Acceptance criteria

Implementation is complete only when **all** of the following are true. Each is testable and independently verifiable.

| ID | Criterion | Verification |
|---|---|---|
| AC-01 | This document exists at the assigned path and is the canonical token reference. | File present; no competing token dictionary. |
| AC-02 | The canonical six core tokens (`--pm-canvas`, `--pm-rail`, `--pm-glass`, `--pm-border`, `--pm-accent`, `--pm-text`) are documented and used for their roles. | Doc + code review. |
| AC-03 | All 27 existing tokens remain defined with unchanged values, except the explicitly proposed porcelain/muted overrides. | Diff of `index.css` `:root` and theme blocks. |
| AC-04 | `--pm-bg` and `--pm-glass-border` aliases exist and resolve to `--pm-canvas` / `--pm-border`. | Computed-style check in browser. |
| AC-05 | No component consumes a `--color-*` bridge token; bridges are either adopted or removed (F-08 resolved). | Regex audit of `frontend/src/**`. |
| AC-06 | Six themes each define all six core tokens; every supporting token is themed or annotated `not themed`. | CSS review. |
| AC-07 | Porcelain status colors meet ≥4.5:1 on panel (targets in §7.1). | Contrast re-measurement. |
| AC-08 | Porcelain accent meets ≥4.5:1 with its ink (target `#3F6BD3`, white 4.94:1). | Contrast re-measurement. |
| AC-09 | Muted text meets ≥4.5:1 on panel in all six themes (targets in §7.1). | Contrast re-measurement. |
| AC-10 | All new token families (§7.2–§7.10) are defined, documented, and consumed where specified. | Code + doc review. |
| AC-11 | No hardcoded hex/rgba/px in component styles outside the frozen legacy layer and the theme picker chrome. | Regex audit. |
| AC-12 | Focus indicator is visible on every interactive element; no `outline: none` without replacement (ProjectSwitcher L264 fixed). | Keyboard pass + code review. |
| AC-13 | Skip-to-content link exists and works. | Keyboard pass. |
| AC-14 | All modals trap focus, close on Escape, and restore focus to the invoker. | Keyboard pass. |
| AC-15 | Mobile nav toggle exposes `aria-expanded`/`aria-controls` and closes on Escape. | DOM + keyboard pass. |
| AC-16 | Horizontally scrollable regions are keyboard-focusable and labeled (task table). | Keyboard pass. |
| AC-17 | Canvas has a text alternative / list view; items have full accessible names; selection changes are announced. | Screen-reader pass. |
| AC-18 | All icon-only controls have accessible names; decorative SVGs remain `aria-hidden`. | DOM audit. |
| AC-19 | Forms use programmatic labels, `aria-invalid`, and `aria-describedby` for errors. | DOM audit. |
| AC-20 | Theme switcher uses one consistent ARIA pattern. | DOM audit. |
| AC-21 | Page `<title>` updates per route. | Route walk. |
| AC-22 | Reduced-motion: global CSS honored **and** JS canvas animations gated; Appearance toggle overrides OS preference. | `prefers-reduced-motion` emulation + toggle test. |
| AC-23 | Target sizes meet the project standard (44px primary) or the documented 24px minimum with spacing. | Measurement pass. |
| AC-24 | `npm run typecheck` and `npm run build` pass in `frontend/`; visual diff of all six themes shows no unintended change. | CI + manual. |
| AC-25 | No application source was modified by this planning artifact itself. | This document is the only file written. |
| AC-26 | All `[PROPOSED]` decisions are approved by the owner before implementation. | Signed decision log. |

---

## 11. Open decisions requiring owner approval

| ID | Decision | Options |
|---|---|---|
| D-01 | Adopt the canonical six-token namespace (§5.1). | Approve / modify / reject. |
| D-02 | Add `--pm-bg` / `--pm-glass-border` aliases (§5.4). | Approve / reject / remove docs instead. |
| D-03 | Adopt or remove the ten `--color-*` bridges (F-08, G-12). | Adopt as public API / remove. |
| D-04 | Approve porcelain accent change `#4773D8 → #3F6BD3` (§7.1). | Approve / keep and accept AA failure / other value. |
| D-05 | Approve the muted-text value changes (§7.1). | Approve / defer. |
| D-06 | Approve the new token families (§7.2–§7.10) and their exact values. | Approve / modify. |
| D-07 | Sequence: contrast fix first (M-11). | Approve / reorder. |
| D-08 | Whether the reduced-motion Appearance toggle is in scope for this phase. | Yes / no (OS preference only). |
| D-09 | Whether font-size/spacing migrations are a separate card (M-06). | Separate card / include here. |
| D-10 | Canonical names vs. legacy names (F-06). | Canonical only / document both. |

---

## Appendix A — Exact line reference index

| File | Lines | Content |
|---|---|---|
| `frontend/src/index.css` | L5–L44 | `:root` block; 27 `--pm-*` (L7–L33); 10 `--color-*` bridges (L34–L43) |
| `frontend/src/index.css` | L46–L57 | `data-pm-theme="violet"` (10 tokens) |
| `frontend/src/index.css` | L59–L70 | `data-pm-theme="aurora"` (10 tokens) |
| `frontend/src/index.css` | L72–L83 | `data-pm-theme="ember"` (10 tokens) |
| `frontend/src/index.css` | L85–L96 | `data-pm-theme="emerald"` (10 tokens) |
| `frontend/src/index.css` | L102 | body font-family (Inter stack) |
| `frontend/src/index.css` | L115–L118 | `:focus-visible` outline |
| `frontend/src/index.css` | L139 / L182 / L297 / L404 / L413 / L424 | z-index values 20 / 10 / 9999 / 60 / 80 / 50 |
| `frontend/src/index.css` | L162 / L193 / L214 / L352 / L403 | control heights 35 / 32 / 32 / 32 / 27 |
| `frontend/src/index.css` | L180 / L317 | topbar height 58 / 52 mobile |
| `frontend/src/index.css` | L202 / L361 | h1 25px |
| `frontend/src/index.css` | L235 / L413 | hardcoded swatch colors (theme picker chrome) |
| `frontend/src/index.css` | L248–L282 | frozen legacy Tailwind override layer |
| `frontend/src/index.css` | L286–L299 | canvas keyframes + `canvas-item-dragging` z-index 9999 |
| `frontend/src/index.css` | L300–L307 / L309–L325 | `@media (max-width: 1120px)` / `780px` (first set) |
| `frontend/src/index.css` | L327–L329 | `@media (prefers-reduced-motion: reduce)` |
| `frontend/src/index.css` | L403 | `.pm-task-table { min-width: 700px }` + `.pm-task-surface { overflow-x: auto }` |
| `frontend/src/index.css` | L432–L434 | `@media` 1120 / 850 / 780 (duplicate set) |
| `frontend/src/index.css` | L443–L457 | `data-pm-theme="porcelain"` (12 tokens) |
| `frontend/src/index.css` | L484–L490 | mobile nav toggle |
| `frontend/src/theme/ThemeProvider.tsx` | L3 | `ThemePreset` type |
| `frontend/src/theme/ThemeProvider.tsx` | L12–L49 | `THEME_PRESETS` (six) |
| `frontend/src/theme/ThemeProvider.tsx` | L71–L72 | storage key, default theme |
| `frontend/src/theme/ThemeProvider.tsx` | L94–L101 | `accentInk()` |
| `frontend/src/theme/ThemeProvider.tsx` | L103–L117 | alias map |
| `frontend/src/theme/ThemeProvider.tsx` | L148–L162 | effect: `dataset.pmTheme`, `.dark`, accent vars |
| `frontend/src/theme/ThemeProvider.tsx` | L164–L197 | context value |
| `frontend/index.html` | L2 / L6 / L8–L61 | html attrs / theme-color / FOUC bootstrap |
| `frontend/src/main.tsx` | L54 | provider order |
| `frontend/src/components/layout/Icon.tsx` | all | `aria-hidden: true` on decorative SVGs |
| `frontend/src/components/canvas/TaskCard.tsx` | L119–L126 / L143–L144 / L166–L168 | keyboard handler, outline, role/tabIndex |
| `frontend/src/components/projects/ProjectSwitcher.tsx` | L174–L175 / L264 | Escape handling / `outline: "none"` violation |
| `frontend/src/components/layout/AppShell.tsx` | L134–L138 / L455–L459 / L588–L597 / L602–L618 / L675–L714 | dialogs, shortcut, sidebar/main landmarks, mobile toggle |
| `frontend/src/pages/TaskWorkspace.tsx` | L1191–L1242 | task dialog (`aria-modal`, `autoFocus`) |
| `frontend/src/pages/Appearance.tsx` | L38–L69 | theme preset cards |
| `frontend/src/components/theme/ThemeCustomizer.tsx` | L36–L58 / L103 | `aria-pressed` grid, `role="status"` |

## Appendix B — Measured contrast tables

Reproduce with: parse token values from `index.css`, compute WCAG relative luminance, composite glass over canvas plus `rgba(255,255,255,0.055)` sheen.

**Text on canvas:** crystal 18.49 · violet 18.07 · aurora 18.65 · ember 18.36 · emerald 18.71 · porcelain 15.82 (all pass AA).

**Secondary on canvas:** 10.23 / 10.13 / 11.63 / 10.72 / 11.75 / 7.06 (all pass).

**Muted on canvas:** 4.99 / 5.06 / 6.04 / 5.17 / 6.06 / **3.78 ✗** (porcelain fails).

**Accent on canvas:** 10.39 / 9.67 / 12.55 / 12.46 / 12.48 / 3.96 (passes 3:1 large/UI; porcelain is 3.96).

**Accent ink on accent:** 9.93 / 9.26 / 12.25 / 12.04 / 12.20 / **4.31 ✗** (porcelain fails AA normal text).

**Text on panel:** 15.16 / 14.33 / 14.17 / 14.11 / 14.52 / 17.18 (all pass).

**Muted on panel:** **4.09 ✗ / 4.01 ✗** / 4.59 / **3.97 ✗** / 4.71 / **4.10 ✗** (four fail; targets in §7.1).

**Accent on panel (focus ring):** 8.52 / 7.67 / 9.54 / 9.58 / 9.69 / 4.30 (all pass 3:1).

**Status on panel:** dark themes 5.81–9.51 (pass); porcelain **1.64–2.43 ✗** (fails; targets in §7.1).

**Border on canvas:** 1.30–2.01 (decorative only; see C-08).

---

*Prepared as a Phase 2 read-only planning artifact for Kanban card PM-P2-04. No application source was modified. All `[PROPOSED]` decisions require explicit owner approval before implementation.*
