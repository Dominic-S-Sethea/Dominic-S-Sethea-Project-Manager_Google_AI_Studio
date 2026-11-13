# PM-P8 — Phase 8: Integrated QA, Release & Final Acceptance

## Status
Proposed — no detailed spec existed prior to this document. Phase 7 (PM-P7-01..06) is complete; Phase 8 is unblocked.

## Cards

| Card | Name | Focus |
|------|------|-------|
| PM-P8-01 | End-to-end integration QA | Backend + frontend + DB, full test suite, migration verification |
| PM-P8-02 | Visual regression & token audit | Obsidian Signal glass tokens, 6 presets, --pm-* CSS tokens, no regressions |
| PM-P8-03 | Interaction smoke tests | Canvas separation, Automation Studio preview-only boundary, publish disabled |
| PM-P8-04 | Release readiness | Build artifacts, Docker packaging, migration script, env config |
| PM-P8-05 | Final acceptance | Sign-off checklist, commit approval, handoff documentation |

## Constraints & preferences

- No irreversible changes without explicit owner approval (DB, env, commits, history rewrite, credentials).
- Evidence-only — report what real execution returned; never fabricate output.
- One topic at a time — sequential Q&A.
- Canvas separation: Project Canvas (/canvases, /canvas/:id, /api/canvas) vs Automation Studio (/automation, preview-only until backend runtime is authorized).
- Preview-only boundary: Automation Studio does not perform live execution. Publish returns 423 RUNTIME_DISABLED. Replay returns 423 Locked. Test runs use pinned datasets and mocked action results only.
- UI/UX: Obsidian Signal glass theme — graphite-black glass #080B11 / #090B0F, crystal-bright-blue accent #54C8FF, --pm-* CSS tokens only.
- No new code for Phase 8 — Phase 8 is QA/release, not implementation. It verifies existing work.

## Acceptance gates (Phase 8 overall)

1. Backend npm run typecheck rc=0
2. Backend npm run build rc=0
3. Backend npm test all pass
4. Frontend npm run typecheck rc=0
5. Frontend npm run build rc=0
6. Live DB migration at latest version, 0 FK violations
7. All 24 blocked board cards reviewed; Phase 8 cards PM-P8-01..05 resolved

## Related

- Phase 7 (PM-P7-01..06) — complete, all gates green
- THINK.md line 41 — Phase 8 gated behind Phase 7
- PROJECT_CONTEXT.md line 45 — Phase 8 gated behind Phase 7
- UI_UX_PROGRESS.md — UI/UX redesign tracker (UIUX-001..010 all DONE)
