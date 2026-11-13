# Project Manager — UI/UX Glass Redesign (Hand-Over Prompt)

Paste this into a new Hermes chat box to take over or continue the UI/UX glass-redesign work.
Do NOT paste this into a codebase or commit.

---

## 1. Active project
- **Project:** Project Manager (PM)
- Stack: React 19 + TS + Vite + Tailwind frontend; Express + TS backend; SQLite (node:sqlite); Gemini AI.
- Workspace root: `<workspace>`
- Frontend entry: `frontend/index.html` + `frontend/src/`
- For the complete, self-contained hand-off prompt, read this file and continue from the active task.

---

## 2. Scope guardrail
Maintain **Project Manager** scope. If any file, doc, or artifact from a different legacy project is encountered, do NOT edit it — flag it to the owner first.

---

## 3. Locked decisions
1. Default theme: `Obsidian Signal` — graphite-black glass `#080B11` / `#090B0F` (never navy); crystal-bright-blue emphasis `#54C8FF`.
2. Glass tokens: frosted panels `backdrop-filter: blur(22px) saturate(142%)`; 1px translucent borders `rgba(211, 228, 255, 0.13)`; inset specular highlights; ambient light orbs.
3. Theme presets: `Obsidian Signal` (default), `Carbon Orchid`, `Aurora Mint`, `Forge Amber`, `Emerald Circuit`, `Porcelain Glass`.
4. Custom accent: clickable `#RRGGBB` hex picker + text input, persisted in `localStorage` key `pm-theme-preference-v2`.
5. Design Mode excluded from main workspace; free placement only in `/canvas` and `/automation`.

---

## 4. Roadmap & status
| Order | Task | Hermes ID | Status |
|---:|---|---|---|---|
| 1 | Unify Glass Theme Engine + Storage Keys + UI_UX_PROGRESS.md | `t_fb54efb0` | ✅ DONE |
| 2 | Refine Glass AppShell, Command Palette & Unified Icon System | `t_6ceec43f` | ✅ DONE |
| 3 | Restore Project Switcher & Project CRUD in Glass Workspace | `t_a85060b2` | ⏭️ NEXT |
| 4 | Add Kanban Board View & Status Quick-Move to Task Workspace | `t_0a73af48` | ⏳ TO-DO |
| 5 | Wire Checklists & Dependencies Tabs into Glass Task Workspace | `t_9f6fbb9f` | ⏳ TO-DO |
| 6 | Glass Redesign for Project Canvas (`/canvases` & `/canvas/:id`) | `t_7f382ccb` | ⏳ TO-DO |
| 7 | Enhance Automation Studio (`/automation`) Inspector & I/O Tabs | `t_53e16419` | ⏳ TO-DO |
| 8 | Glass Migration for Integrations (`/connectors`) & Git Activity (`/git-commits`) | `t_e76ade85` | ⏳ TO-DO |
| 9 | Glass Migration for People & Access (`/users`) & Import/Export (`/import-export`) | `t_ec7c9171` | ⏳ TO-DO |
| 10 | End-to-End UI/UX QA, Responsive & Accessibility Verification | `t_73af7047` | ⏳ TO-DO |

---

## 5. Working process
1. Read this prompt. Confirm the next task (default order above).
2. Make changes for that single task.
3. Verify with `npm run typecheck` in `frontend/` (`tsc --noEmit`, exit 0).
4. Update `UI_UX_PROGRESS.md` (status cell + completion log + changed files).
5. Commit; report: which task done, files changed, next pending task.

---

## 6. ChatGPT (regular chat) hand-off protocol
ChatGPT regular chat cannot see project files, prior chat history, or project rules.
Hand it a self-contained mini-spec, not the whole codebase.

### Template (copy, fill `\[...\]`, send)
> Target file: `[frontend/src/components/layout/AppShell.tsx]`
> Change requested: `[add glass-themed StatusCard + Save button inside header]`
>
> Context card (paste only the relevant existing code — keep short):
> ```tsx
> [imports + exact component to edit/wrap]
> ```
>
> Acceptance criteria:
> - tsc --noEmit (in frontend/) exits 0.
> - No hardcoded colors (use only CSS vars from docs/AI_CONTEXT.md).
> - keys on list items; keep aria/role.
> - Does not change data shapes or component API.
>
> Project rules:
> - Use only CSS custom properties (--pm-glass, --pm-accent, ...).
> - No `any`.
> - key={...} on list items; keep aria/role.
>
> Return only the code block + one-line summary.

### Rules for the ChatGPT model
1. If a type/component/API is not in the context card, say "I can't verify that — please send the existing snippet" instead of inventing it.
2. Only import from files you were shown. No new files unless explicitly asked.
3. Use only the theme tokens above. No `any`.
4. Return only the code block + 1-line summary.

---

## 7. Files & constraints
- Do NOT change DB schema, env, git history, credentials, or push without owner approval.
- Approved areas: `frontend/src/**`, `UI_UX_PROGRESS.md`, `docs/`.

---

## Active item now
`UIUX-003` (`t_a85060b2`) — Restore Project Switcher & Project CRUD in Glass Workspace.
