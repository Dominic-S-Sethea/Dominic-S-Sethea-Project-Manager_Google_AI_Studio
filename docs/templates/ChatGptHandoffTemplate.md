# ChatGPT Regular-Chat Hand-off Template

> Copy-paste this into ChatGPT (plain chat) to generate **one file**. Replace the bracketed
> `[...]` fields. Keep it to one file per chat — never ask for a whole feature/module.

---

## Hand-off
Generate/modify **one file** for Project Manager UI/UX glass redesign.

**Target file:** `[frontend/src/components/layout/AppShell.tsx]`
**Change requested:** `[add a glass-themed panel + button inside the existing ... section]` 
**Scope limit:** only add/modify the sections requested — never rewrite an untouched module.

## Context card (paste the relevant existing code only — keep it short)
```tsx
[Paste only the imports + the exact component/function you want ChatGPT to edit or wrap.]
```
<details><summary>Full existing file (if under context window)</summary>
```tsx
[existing file content limited to ~200 lines]
```
</details>

## Acceptance criteria
- `tsc --noEmit` (in `frontend/`) exits 0.
- Renders correctly; no hardcoded colors (`use only the CSS vars in docs/AI_CONTEXT.md`).
- Has `key`s on list items; keep `aria`/`role` attributes.
- Does not change data-model shapes or the existing component API.

## Rules for ChatGPT
1. If a type/component/API is not in the context card, say: *"That doesn't exist in the provided context — please send the existing snippet."* Do NOT invent it.
2. Only `import` from files you were shown. Do not add new files unless explicitly requested.
3. Use only the theme tokens in `docs/AI_CONTEXT.md`. Do not introduce `any`.
4. Return **only the code diff/snippet** (plus a one-line summary), not an explanation.
5. If you cannot satisfy acceptance criteria, return a minimal, honest stub rather than a risky guess.

## Output
Send the code as a fenced block. I will paste it into Hermes and verify with `tsc --noEmit`.
