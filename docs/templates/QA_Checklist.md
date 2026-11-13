# Hermes QA Checklist — after a ChatGPT hand-off

Run this in Hermes **after** a ChatGPT file is pasted. Complete every step; log results.

1. **Typecheck** — run `npm run typecheck` in `frontend/`. Expect exit 0.
   - Result: [PASS / FAIL] — if FAIL, fix locally & re-run.
2. **Scope filter** — run `git diff --stat HEAD` and confirm only the intended file(s) changed.
   - Result: [PASS / FAIL]
3. **Merge/apply** — apply patch (`git apply` or manual patch); resolve conflicts; re-run typecheck.
   - Result: [PASS / FAIL]
4. **Runtime demo** — start dev server, open the page; check browser console for errors.
   - Result: [PASS / FAIL]
5. **Visual / interaction** — glass tokens present, contrast OK, mobile ready, keyboard navigation works.
   - Result: [PASS / FAIL]
6. **Accessibility** — no missing `key`s, no broken `aria`, no invisible/empty interactive elements.
   - Result: [PASS / FAIL]
7. **Commit** — single-file commit (or a small clean patch) with a clear message.
   - Commit: `[hash]`

**Final:** [APPROVED / NEEDS FIX]
