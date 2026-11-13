# PM-P7-06 — Automation Studio Lifecycle: Publish, Pause, Rollback

## Status
Proposed (no detailed spec existed prior to this document)

## Scope
PM-P7-06 adds the **publish lifecycle** for workflows: transitioning a workflow from `draft` to `published` through an approval gate. Pause/resume/rollback execution transitions already exist in `execution.service.ts` and `automation.executions.ts` and are in scope only for frontend exposure and test coverage.

## Constraints & preferences
- **Preview-only boundary:** publishing a workflow does NOT enable live execution. No live connector calls, no live runtime.
- **Publish approval:** `ApprovalType.publish` returns `423 RUNTIME_DISABLED` in preview-only mode (same as execute/replay). Only `connector_action` approvals are creatable.
- **No schema changes:** `workflows.status` already includes `published`; `workflow_versions.published_at` and `is_reviewed` already exist; `approvals` table already exists.
- **API prefix:** `/api/v1/automation/...` (PM-P7-03 prefix). Publish route: `POST /api/v1/automation/workflows/:id/publish`.
- **Idempotency:** publish uses a deterministic idempotency key.
- **Access control:** publish requires project write access; only human owners may decide publish approvals.
- **Audit:** publish request and decision are recorded via `record()` in `audit.service.ts`.

## Acceptance gates
1. Backend `npm run typecheck` rc=0
2. Backend `npm run build` rc=0
3. Backend `npm test` all pass (including new publish test)
4. Frontend `npm run typecheck` rc=0
5. Frontend `npm run build` rc=0

## Files to change

### Backend
1. `backend/src/services/workflow.service.ts` — Add `publishWorkflow(actor, workflowId)` function:
   - Validate workflow exists, status is `draft`, has `current_version_id`
   - Require project write access
   - Build idempotency key: `pm-p7-06:publish:{workflowId}:{versionId}`
   - Call `requestApproval({ workflow_id, version_id, approval_type: "publish", idempotency_key, expires_at, ... })`
   - In preview-only mode, `requestApproval` throws `423 RUNTIME_DISABLED` before any status change
   - If approval were granted (future), set workflow status to `published`, set `workflow_versions.published_at`

2. `backend/src/routes/automation.workflows.routes.ts` — Add route:
   - `POST /:workflowId/publish` → `requireUserOrAgent` → `publishWorkflow`

### Frontend
1. `frontend/src/types/automation.ts` — Add `AutomationPublishResponse` type
2. `frontend/src/pages/AutomationStudio.tsx` — Add publish button (disabled in preview-only, tooltip "Preview only · publishing disabled"), publish confirmation dialog

### Tests
1. `backend/src/tests/automation.api.test.ts` or new test — publish returns 423 in preview-only mode, validates draft requirement, validates write access

## Design decisions
- Publish is a separate route (not part of `updateWorkflow`) because it requires an approval gate and status transition logic.
- Publish approval is requested but immediately rejected by `requestApproval` (423) in preview-only mode — no workflow status change occurs.
- The `published_at` timestamp on `workflow_versions` is set only when an approval is granted (future runtime boundary).
- Idempotency key format: `pm-p7-06:publish:{workflowId}:{versionId}` — deterministic, no hash needed since publish is a one-time transition per version.

## Related
- PM-P7-03: approvals service, `requestApproval`, `decideApproval`, `ApprovalType.publish`
- PM-P7-01: workflow domain model, `workflows.status` CHECK includes `published`
- PM-P7-05: preview-only boundary, `423 Locked` replay, pinned test datasets
