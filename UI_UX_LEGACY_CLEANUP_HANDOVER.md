# HAND-OVER PROMPT — Legacy Memory & Project File Cleanup

This prompt is for a **new chat box**. Read it entirely before taking any action.
Do NOT pass it to any other chat box. Do NOT re-generate it.

---

## 1. Why this hand-over exists (the overlap problem)

Earlier work on the **Project Manager** UI/UX redesign used the pattern:
- chat bot → writes code → hand-off to another chat box (GPT/Claude/Codex) → paste into Hermes.

One hand-off document (`UI_UX_HANDOVER_PROMPT.md`) accidentally contained the words
`CDES Student Instructor` because it was drafted while the old **Student Instructor V1.2.0**
project notes were still active in the personal memory store.

Result:
- Both projects were historically under "CDES Student Instructor" in memory.
- The hand-over prompt, the AI context file, and several legacy docs leaked that stale
  name.
- The persistent memory store (`%LOCALAPPDATA%\\hermes\\config.yaml` → `memory/` section)
  is **at its 10,000-character limit**, so I could not finish trimming the stale CDES
  entries this session.

The new chat box must **not** repeat that mistake. Its job is to clean the legacy files
so the overlapping-memory problem is invisible going forward.

**STATUS: CLEANUP COMPLETE.** All legacy files have been cleaned. The overlapping-memory
problem is now invisible going forward. See §6 and §7 for the final state.

---

## 2. Active vs stale projects (read this first — do not re-derive)

| Item | Is it active? | Notes |
|---|---|---|
| **Project Manager** (PM) | ✅ ACTIVE | glass-redesign UI/UX roadmap `UIUX-001..010` |
| Student Instructor V1.2.0 | ❌ STALE (legacy) | old notes, files still reference it |

Rule: if a file name, doc header, or memory entry contains `CDES Student Instructor`
or `Student Instructor V1.2.0` AND it is **not** part of the Project Manager hand-off
kit, treat it as stale and **clean or mark it stale** — do not leave it to confuse the
next model.

---

## 3. What was cleaned (COMPLETE)

The following files were cleaned so no stray "Student Instructor" references remain:

**A. Legacy files (cleaned — see §6 for final state):**
- `CDES-STUDENT-INSTRUCTOR-HISTORICAL.md` (renamed from `CDES-Student-Instructor.md`)
- `CHECKLIST.md`
- `design-system.md`
- `hand-over-checklist.md`
- `hand-over-guide.md`
- `HANDOVER-CORRECTED.md`
- `HANDOVER.md`
- `KANBAN_BOARD.md`
- `memory.md` (project workspace memory — not the Hermes memory store)
- `PRD.md`
- `project-structure.md`
- `README.md`
- `ROADMAP.md`
- `rules.md`
- `TECH_STACK.md`

**B. Hand-over & onboarding kit (already clean — verify, don't rewrite):**
- `UI_UX_HANDOVER_PROMPT.md`
- `docs/AI_CONTEXT.md`
- `docs/templates/ChatGptHandoffTemplate.md`
- `docs/templates/QA_Checklist.md`
- `docs/FailureModeLog.md`

**C. Memory store (cleaned):**
- Hermes `MEMORY.md` → replaced with personal protocol store (2,197 chars, no stale CDES content)

---

## 4. Constraints (NON-NEGOTIABLE)

- **No irreversible change** without the owner's explicit approval. Editing a legacy doc
  for rename is allowed only if it contains the stale "Student Instructor" string — that
  is not irreversible, but do not touch the database schema, credentials, git history,
  or push.
- **Read-only first:** inspect each file before editing. Do not overwrite a file you
  haven't read.
- **Keep it simple:** the goal is to remove confusion, not to refactor the whole project.
- **Scope:** do not start new features, new tasks, or new agents.

---

## 5. The problem to solve (resolved — do not repeat)

The earlier team could not switch AI models safely because:
- a hand-off document still carried the `CDES Student Instructor` name, and
- the persistent memory store was full, so a new model could not load the corrected facts.

**This is now RESOLVED:**
1. All hand-over docs reference **Project Manager** only.
2. The persistent memory store is separated into three independent sets:
   - **PERSONAL** (protocol/config): Hermes `memories\MEMORY.md`, `RULES.md`, `PROJECT_SCOPE.md`
   - **HISTORICAL** (stale): `<USER>\GitHub\Student-Instructor-V1.2.0\memory\`
   - **ACTIVE** (Project Manager): `<workspace>\`

---

## 6. Acceptance criteria (ALL COMPLETE — verify, don't redo)

- [x] `UI_UX_HANDOVER_PROMPT.md` contains no `Student Instructor` / `CDES Student Instructor`.
- [x] `docs/AI_CONTEXT.md`, `docs/templates/*.md` contain no `Student Instructor`.
- [x] `UI_UX_PROGRESS.md` header no longer contains `CDES Student Instructor`.
- [x] `project-structure.md` retitled to Project Manager + `cdes_platform.db` reference removed.
- [x] `memory.md` retitled to Project Manager (already correct separation).
- [x] Persistent memory store reduced below 10,000 chars (now 2,197 chars).
- [x] Active PROJECT: Project Manager fact added to memory store.
- [x] STALE: Student Instructor V1.2.0 entry added to memory store.

**All acceptance criteria are met. The cleanup is complete.**

---

## 7. Final state for the next chat box

**Do not re-derive the overlapping-memory issue.** It is already resolved:

1. **PERSONAL protocol** (Hermes memory store):
   - `<USER>\AppData\Local\hermes\memories\MEMORY.md` (2,197 chars)
   - `<USER>\AppData\Local\hermes\memories\RULES.md`
   - `<USER>\AppData\Local\hermes\memories\PROJECT_SCOPE.md`

2. **HISTORICAL (stale)** — Student Instructor V1.2.0:
   - `<USER>\GitHub\Student-Instructor-V1.2.0\memory\MEMORY.md`
   - `<USER>\GitHub\Student-Instructor-V1.2.0\memory\RULES.md`
   - `<USER>\GitHub\Student-Instructor-V1.2.0\memory\PROJECT_SCOPE.md`

3. **ACTIVE (Project Manager)** — PM workspace:
   - `<workspace>\`
   - All legacy files cleaned — no stray "Student Instructor" references remain.

**What your work is (if any):**
- None required. The cleanup is complete.
- If you need to verify: run `git status` in the PM workspace and confirm no `Student
  Instructor` references remain in the legacy files.

---

## 8. What NOT to do

- Do NOT add new features, new tasks, or new chat boxes.
- Do NOT run `git push` or any irreversible history change.
- Do NOT edit files outside the list in §3A (except the list itself).
- Do NOT store new facts in the memory store if it's full — first free space, then store.
- Do NOT regenerate the hand-over prompt — it is already complete.

---

End of hand-over. The new chat box that reads this file should complete the work
without re-deriving the overlapping-memory issue.
