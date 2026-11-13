# Failure Mode Log — ChatGPT → Hermes code hand-offs

Log every ChatGPT failure and the exact Hermes patch that fixed it. 
Pre-fill with observed patterns; new rows added per hand-off.

| # | File | ChatGPT failure | Root cause | Hermes fix | Guardrail added |
|---|---|---|---|---|---|
| 1 | `AppShell.tsx` | hardcodes accent colors instead of CSS vars | no token awareness in prompt | replaced literals with `--pm-accent` | token rule in template |
| 2 | `ThemeProvider.tsx` | invented exported keys | partial file context | matched existing TS shape & re-derived keys | import-only-shown rule |
| 3 | `TaskList.tsx` | missing list `key`s | generic component template | added stable `key`s | keys rule in template |
| 4 | `Icon.tsx` | rewrote untouched icon list | scope creep in prompt | reverted to targeted add; kept existing list | no-rewrite rule in template |

<!-- Append new rows below this line in the same order. -->
