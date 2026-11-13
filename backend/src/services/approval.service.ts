
import { randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";
import { ServiceError } from "./actor.service.ts";
import { record } from "./audit.service.ts";
import { authorize } from "./projectAccess.service.ts";

type ApprovalType =
  | "publish"
  | "execute"
  | "connector_action"
  | "replay_side_effect";

type ApprovalStatus =
  | "pending"
  | "granted"
  | "rejected"
  | "expired"
  | "cancelled";

interface ApprovalRow {
  approval_id: string;
  execution_id: string | null;
  step_id: string | null;
  workflow_id: string;
  version_id: string | null;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requested_by_type: "user" | "agent" | "automation";
  requested_by_id: string;
  requested_at: string;
  reviewer_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string;
  idempotency_key: string;
  created_at: string;
}

interface WorkflowProjectRow {
  project_id: string;
  status: string;
}

export interface RequestApprovalInput {
  workflow_id: string;
  version_id?: string | null;
  execution_id?: string | null;
  step_id?: string | null;
  approval_type: ApprovalType;
  idempotency_key: string;
  expires_at: string;
  decision_note?: string | null;
}

export interface SafeApproval {
  approval_id: string;
  workflow_id: string;
  version_id: string | null;
  execution_id: string | null;
  step_id: string | null;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requested_by_type: string;
  requested_by_id: string;
  requested_at: string;
  reviewer_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string;
  created_at: string;
}

function withTransaction<T>(operation: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE;");

  try {
    const result = operation();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // Preserve the original error.
    }
    throw error;
  }
}

function safeApproval(row: ApprovalRow): SafeApproval {
  return {
    approval_id: row.approval_id,
    workflow_id: row.workflow_id,
    version_id: row.version_id,
    execution_id: row.execution_id,
    step_id: row.step_id,
    approval_type: row.approval_type,
    status: row.status,
    requested_by_type: row.requested_by_type,
    requested_by_id: row.requested_by_id,
    requested_at: row.requested_at,
    reviewer_id: row.reviewer_id,
    decided_at: row.decided_at,
    decision_note: row.decision_note,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

function getWorkflowProject(workflowId: string): WorkflowProjectRow | undefined {
  return getDb()
    .prepare("SELECT project_id, status FROM workflows WHERE workflow_id = ?")
    .get(workflowId) as WorkflowProjectRow | undefined;
}

function getApproval(id: string): ApprovalRow | undefined {
  return getDb()
    .prepare(
      `SELECT approval_id, execution_id, step_id, workflow_id, version_id,
              approval_type, status, requested_by_type, requested_by_id,
              requested_at, reviewer_id, decided_at, decision_note, expires_at,
              idempotency_key, created_at
       FROM approvals
       WHERE approval_id = ?`,
    )
    .get(id) as ApprovalRow | undefined;
}

function toRequesterType(actor: Actor): "user" | "agent" | "automation" {
  if (
    actor.actor_type === "user" ||
    actor.actor_type === "agent" ||
    actor.actor_type === "automation"
  ) {
    return actor.actor_type;
  }

  throw new ServiceError(401, "A signed-in user or authorized agent is required");
}

function assertProjectRequestAccess(actor: Actor, projectId: string): void {
  if (!authorize(actor, projectId, "approval", "request")) {
    throw new ServiceError(404, "Approval resource not found");
  }
}

function assertHumanOwner(actor: Actor, projectId: string): void {
  if (
    actor.actor_type !== "user" ||
    !authorize(actor, projectId, "approval", "approve")
  ) {
    throw new ServiceError(
      403,
      "Only a human project owner may decide an approval",
      "OWNER_REQUIRED",
    );
  }
}

/**
 * Approval requests are records only. Publish, execute and replay approvals
 * remain disabled in AD-01 preview-only mode. connector_action is retained as
 * a review record; granting it does not execute a provider operation.
 */
export function requestApproval(
  input: RequestApprovalInput,
  actor: Actor,
): SafeApproval {
  if (
    !input.workflow_id ||
    !input.idempotency_key ||
    input.idempotency_key.length > 200
  ) {
    throw new ServiceError(400, "Workflow and idempotency key are required");
  }

  if (input.approval_type !== "connector_action") {
    throw new ServiceError(
      423,
      "Publish, execute and replay approvals are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }

  const expiresAt = Date.parse(input.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new ServiceError(400, "A future approval expiry time is required");
  }

  const workflow = getWorkflowProject(input.workflow_id);
  if (!workflow) throw new ServiceError(404, "Workflow not found");
  assertProjectRequestAccess(actor, workflow.project_id);

  const requesterType = toRequesterType(actor);
  const now = new Date().toISOString();

  return withTransaction(() => {
    const db = getDb();
    const existing = db
      .prepare(
        `SELECT approval_id, execution_id, step_id, workflow_id, version_id,
                approval_type, status, requested_by_type, requested_by_id,
                requested_at, reviewer_id, decided_at, decision_note, expires_at,
                idempotency_key, created_at
         FROM approvals
         WHERE idempotency_key = ?`,
      )
      .get(input.idempotency_key) as ApprovalRow | undefined;

    if (existing) {
      const identical =
        existing.workflow_id === input.workflow_id &&
        existing.version_id === (input.version_id ?? null) &&
        existing.execution_id === (input.execution_id ?? null) &&
        existing.step_id === (input.step_id ?? null) &&
        existing.approval_type === input.approval_type &&
        existing.requested_by_type === requesterType &&
        existing.requested_by_id === actor.actor_id;

      if (!identical) {
        throw new ServiceError(
          409,
          "Idempotency key was already used for a different approval request",
          "IDEMPOTENCY_CONFLICT",
        );
      }

      return safeApproval(existing);
    }

    const id = randomUUID();

    db.prepare(
      `INSERT INTO approvals (
        approval_id, execution_id, step_id, workflow_id, version_id,
        approval_type, status, requested_by_type, requested_by_id,
        requested_at, expires_at, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.execution_id ?? null,
      input.step_id ?? null,
      input.workflow_id,
      input.version_id ?? null,
      input.approval_type,
      requesterType,
      actor.actor_id,
      now,
      input.expires_at,
      input.idempotency_key,
      now,
    );

    const created = getApproval(id);
    if (!created) throw new ServiceError(500, "Approval request was not persisted");

    record({
      actor,
      project_id: workflow.project_id,
      action: "approval.requested",
      target_table: "approvals",
      target_id: id,
      new_value: safeApproval(created),
      trigger: "api",
    });

    return safeApproval(created);
  });
}

export function listApprovals(
  projectId: string,
  actor: Actor,
  status?: ApprovalStatus,
): SafeApproval[] {
  if (!authorize(actor, projectId, "approval", "read")) {
    throw new ServiceError(404, "Approval queue not found");
  }

  const rows = status
    ? getDb()
        .prepare(
          `SELECT a.approval_id, a.execution_id, a.step_id, a.workflow_id,
                  a.version_id, a.approval_type, a.status, a.requested_by_type,
                  a.requested_by_id, a.requested_at, a.reviewer_id, a.decided_at,
                  a.decision_note, a.expires_at, a.idempotency_key, a.created_at
           FROM approvals a
           JOIN workflows w ON w.workflow_id = a.workflow_id
           WHERE w.project_id = ? AND a.status = ?
           ORDER BY a.requested_at DESC`,
        )
        .all(projectId, status) as unknown as ApprovalRow[]
    : getDb()
        .prepare(
          `SELECT a.approval_id, a.execution_id, a.step_id, a.workflow_id,
                  a.version_id, a.approval_type, a.status, a.requested_by_type,
                  a.requested_by_id, a.requested_at, a.reviewer_id, a.decided_at,
                  a.decision_note, a.expires_at, a.idempotency_key, a.created_at
           FROM approvals a
           JOIN workflows w ON w.workflow_id = a.workflow_id
           WHERE w.project_id = ?
           ORDER BY a.requested_at DESC`,
        )
        .all(projectId) as unknown as ApprovalRow[];

  return rows.map(safeApproval);
}

export function decideApproval(
  approvalId: string,
  decision: "approve" | "reject",
  actor: Actor,
  note?: string,
): SafeApproval {
  const row = getApproval(approvalId);
  if (!row) throw new ServiceError(404, "Approval not found");

  const workflow = getWorkflowProject(row.workflow_id);
  if (!workflow) throw new ServiceError(404, "Approval not found");

  assertHumanOwner(actor, workflow.project_id);

  if (
    decision === "approve" &&
    row.requested_by_type === "user" &&
    row.requested_by_id === actor.actor_id
  ) {
    throw new ServiceError(
      403,
      "A requester cannot approve their own approval request",
      "SELF_APPROVAL_FORBIDDEN",
    );
  }

  const targetStatus: ApprovalStatus =
    decision === "approve" ? "granted" : "rejected";

  let expiredDuringDecision = false;

  const result = withTransaction(() => {
    const current = getApproval(approvalId);
    if (!current) throw new ServiceError(404, "Approval not found");

    if (current.status !== "pending") {
      if (
        current.status === targetStatus &&
        current.reviewer_id === actor.actor_id
      ) {
        return safeApproval(current);
      }

      throw new ServiceError(
        409,
        "Approval has already received a decision",
        "APPROVAL_ALREADY_DECIDED",
      );
    }

    if (Date.parse(current.expires_at) <= Date.now()) {
      const now = new Date().toISOString();

      getDb()
        .prepare(
          `UPDATE approvals
           SET status = 'expired', decided_at = ?, decision_note = NULL
           WHERE approval_id = ? AND status = 'pending'`,
        )
        .run(now, approvalId);

      record({
        actor: {
          actor_type: "system",
          actor_id: "system",
        },
        project_id: workflow.project_id,
        action: "approval.expired",
        target_table: "approvals",
        target_id: approvalId,
        old_value: safeApproval(current),
        new_value: { approval_id: approvalId, status: "expired" },
        trigger: "system",
      });

      expiredDuringDecision = true;
      const updated = getApproval(approvalId);
      if (!updated) throw new ServiceError(500, "Approval update failed");
      return safeApproval(updated);
    }

    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE approvals
         SET status = ?, reviewer_id = ?, decided_at = ?, decision_note = ?
         WHERE approval_id = ? AND status = 'pending'`,
      )
      .run(
        targetStatus,
        actor.actor_id,
        now,
        note ?? null,
        approvalId,
      );

    const updated = getApproval(approvalId);
    if (!updated) throw new ServiceError(500, "Approval update failed");

    record({
      actor,
      project_id: workflow.project_id,
      action: decision === "approve" ? "approval.granted" : "approval.rejected",
      target_table: "approvals",
      target_id: approvalId,
      old_value: safeApproval(current),
      new_value: safeApproval(updated),
      trigger: "api",
    });

    return safeApproval(updated);
  });

  if (expiredDuringDecision) {
    throw new ServiceError(409, "Approval has expired", "APPROVAL_EXPIRED");
  }

  return result;
}

/**
 * Internal expiry operation. It has no public route and only changes pending
 * records whose expires_at has elapsed. Repeated calls are idempotent.
 */
export function expireApproval(approvalId: string): SafeApproval | null {
  const row = getApproval(approvalId);
  if (!row) return null;
  if (row.status !== "pending") return safeApproval(row);
  if (Date.parse(row.expires_at) > Date.now()) return safeApproval(row);

  const workflow = getWorkflowProject(row.workflow_id);
  if (!workflow) return null;

  return withTransaction(() => {
    const current = getApproval(approvalId);
    if (!current || current.status !== "pending") {
      return current ? safeApproval(current) : null;
    }

    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE approvals
         SET status = 'expired', decided_at = ?
         WHERE approval_id = ? AND status = 'pending'`,
      )
      .run(now, approvalId);

    const updated = getApproval(approvalId);
    if (!updated) return null;

    record({
      actor: { actor_type: "system", actor_id: "system" },
      project_id: workflow.project_id,
      action: "approval.expired",
      target_table: "approvals",
      target_id: approvalId,
      old_value: safeApproval(current),
      new_value: safeApproval(updated),
      trigger: "system",
    });

    return safeApproval(updated);
  });
}
