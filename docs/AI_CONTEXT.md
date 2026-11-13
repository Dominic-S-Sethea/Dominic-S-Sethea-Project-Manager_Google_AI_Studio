# AI Context & Reference — Project Manager (PM) UI/UX Glass Redesign

> Curated knowledge base for composing **ChatGPT regular-chat hand-offs**.
> Keep each file small; ChatGPT only sees what is pasted into its prompt.

---

## 1. Product
- **Project Manager (PM)** — modern glassmorphism redesign of the PM app (React 19 + TS + Vite + Tailwind).
- Workspace root: `<workspace>`

## 2. Glass theme tokens (do NOT hardcode colors)
| Token | Value / purpose |
|---|---|
| `--pm-glass` | base glass panel background |
| `--pm-glass-border` | translucent 1px border |
| `--pm-accent` | crystal-bright blue emphasis (`#54C8FF`) |
| `--pm-text` / `--pm-text-muted` | ink / secondary ink |
| `--pm-accent-soft` | accent hover/active background |
- Default theme: **Obsidian Signal** (graphite-black glass `#080B11` / `#090B0F`). Never navy.

## 3. Design rules (for ChatGPT)
1. Use existing CSS custom properties above. Never invent a color variable.
2. Reuse existing components/hooks; do not invent new ones unless you show the exact existing API.
3. Add `key`s to list items. Keep `aria`/`role` attributes intact.
4. Do NOT rewrite untouched modules — add/modify only the requested sections.
5. Keep TypeScript strict; no `any` without a written reason.
6. Respect existing imports (see `frontend/src/components/layout/Icon.tsx` + `components/ui/Icon.tsx` for the unified icon set).

## 4. What ChatGPT is allowed to change per hand-off
- One file only. Targeted add/modify of the requested section(s).
- CSS/JSX/React component code. No DB schema, no backend routes, no git/history changes.
- Must run `npm run typecheck` (`tsc --noEmit`) → exit 0.

## 5. Quick commands
- typecheck: `npm run typecheck` (from `frontend/`)
- dev: `npm run dev` (from `frontend/`)

## 6. Known gotchas
- ChatGPT tends to (a) hardcode accent colors, (b) invent exports/imports that don't exist, (c) rewrite untouched modules. Each is fixed & logged in `docs/FailureModeLog.md`.
