import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getProjectAccess } from "./projectAccess.service.ts";
import { newTraceId } from "./outbox.service.ts";
import { record } from "./audit.service.ts";
import type { Execution, ExecutionStatus } from "../types/automation.ts";

export interface CreateExecutionInput {
  workflow_id: string;
  version_id: string;
  environment_id: string;
  idempotency_key: string;
  trace_id?: string;
}

export type ExecutionResult = {
  status: number;
  body: { message?: string; execution?: Execution; duplicate?: boolean };
};

type WorkflowRow = { workflow_id: string; project_id: string };
type VersionRow = { version_id: string; workflow_id: string };
type EnvironmentRow = { environment_id: string; project_id: string; mode: string; is_live: number };

function rollback(db: DatabaseSync): void {
  try { db.exec("ROLLBACK"); } catch { /* preserve the original error */ }
}

function getExecution(db: DatabaseSync, id: string): Execution | undefined {
  return db.prepare("SELECT * FROM executions WHERE execution_id = ?").get(id) as Execution | undefined;
}

export async function createExecution(
  db: DatabaseSync,
  userId: string,
  input: unknown,
): Promise<ExecutionResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { status: 400, body: { message: "Invalid execution request" } };
  }
  const body = input as Record<string, unknown>;
  const forbidden = ["execution_id", "status", "trigger_type", "trigger_actor_type", "trigger_actor_id", "preview"];
  if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
    return { status: 400, body: { message: "Server-controlled execution fields are not accepted" } };
  }
  const workflow_id = body.workflow_id;
  const version_id = body.version_id;
  const environment_id = body.environment_id;
  const idempotency_key = body.idempotency_key;
  const trace_id = body.trace_id;
  if (
    typeof workflow_id !== "string" || !workflow_id.trim() ||
    typeof version_id !== "string" || !version_id.trim() ||
    typeof environment_id !== "string" || !environment_id.trim() ||
    typeof idempotency_key !== "string" || !idempotency_key.trim()
  ) {
    return { status: 400, body: { message: "workflow_id, version_id, environment_id and idempotency_key are required" } };
  }
  if (trace_id !== undefined && (typeof trace_id !== "string" || !trace_id.trim())) {
    return { status: 400, body: { message: "trace_id must be a non-empty string" } };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const workflow = db.prepare(
      "SELECT workflow_id, project_id FROM workflows WHERE workflow_id = ?",
    ).get(workflow_id) as WorkflowRow | undefined;
    if (!workflow) {
      rollback(db);
      return { status: 404, body: { message: "Workflow not found" } };
    }

    const access = await getProjectAccess(workflow.project_id, userId);
    if (!access?.canWrite) {
      rollback(db);
      return { status: 403, body: { message: "Project write access required" } };
    }

    const version = db.prepare(
      "SELECT version_id, workflow_id FROM workflow_versions WHERE version_id = ?",
    ).get(version_id) as VersionRow | undefined;
    if (!version) {
      rollback(db);
      return { status: 404, body: { message: "Workflow version not found" } };
    }
    if (version.workflow_id !== workflow.workflow_id) {
      rollback(db);
      return { status: 400, body: { message: "Version does not belong to workflow" } };
    }

    const environment = db.prepare(
      "SELECT environment_id, project_id, mode, is_live FROM environments WHERE environment_id = ?",
    ).get(environment_id) as EnvironmentRow | undefined;
    if (!environment) {
      rollback(db);
      return { status: 404, body: { message: "Environment not found" } };
    }
    if (environment.project_id !== workflow.project_id) {
      rollback(db);
      return { status: 400, body: { message: "Environment does not belong to workflow project" } };
    }
    if (environment.mode !== "preview" || environment.is_live !== 0) {
      rollback(db);
      return { status: 400, body: { message: "Only non-live preview environments are permitted" } };
    }

    const existing = db.prepare(
      "SELECT * FROM executions WHERE idempotency_key = ?",
    ).get(idempotency_key) as Execution | undefined;
    if (existing) {
      const same = existing.workflow_id === workflow_id && existing.version_id === version_id &&
        existing.environment_id === environment_id;
      rollback(db);
      if (!same) return { status: 409, body: { message: "idempotency_key conflict" } };
      return { status: 200, body: { execution: existing, duplicate: true } };
    }

    const executionId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO executions (
        execution_id, workflow_id, version_id, environment_id, status,
        trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
        trace_id, approval_id, attempt_count, error_class, error_message,
        started_at, completed_at, cancel_requested_by, cancel_requested_at,
        cancel_reason, cancelled_at, created_at, preview
      ) VALUES (?, ?, ?, ?, 'created', 'manual', 'user', ?, ?, ?, NULL, 0, NULL, NULL,
                NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`,
    ).run(
      executionId, workflow_id, version_id, environment_id, userId,
      idempotency_key, typeof trace_id === "string" ? trace_id : newTraceId(), now,
    );
    const execution = getExecution(db, executionId);
    if (!execution) throw new Error("Execution insert did not produce a row");
    record({
      actor: { actor_type: "user", actor_id: userId },
      project_id: workflow.project_id,
      action: "execution.created",
      target_table: "executions",
      target_id: executionId,
      new_value: execution,
      trigger: "api",
    });
    db.exec("COMMIT");
    return { status: 201, body: { execution, duplicate: false } };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

const TRANSITIONS: Record<string, { sources: ExecutionStatus[]; target: ExecutionStatus }> = {
  start: { sources: ["created"], target: "running" },
  pause: { sources: ["running"], target: "paused" },
  resume: { sources: ["paused"], target: "running" },
  complete: { sources: ["running"], target: "succeeded" },
  rollback: { sources: ["running", "succeeded"], target: "rolled_back" },
};

export async function transitionExecution(
  db: DatabaseSync,
  userId: string,
  executionId: string,
  action: keyof typeof TRANSITIONS,
): Promise<ExecutionResult> {
  const transition = TRANSITIONS[action];
  if (!transition) return { status: 400, body: { message: "Unsupported transition" } };

  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare(
      `SELECT e.*, w.project_id
       FROM executions e JOIN workflows w ON w.workflow_id = e.workflow_id
       WHERE e.execution_id = ?`,
    ).get(executionId) as (Execution & { project_id: string }) | undefined;
    if (!row) {
      rollback(db);
      return { status: 404, body: { message: "Execution not found" } };
    }

    const access = await getProjectAccess(row.project_id, userId);
    if (!access?.canWrite) {
      rollback(db);
      return { status: 403, body: { message: "Project write access required" } };
    }

    if (row.status === transition.target) {
      db.exec("COMMIT");
      const current = getExecution(db, executionId);
      return { status: 200, body: { execution: current, duplicate: true } };
    }
    if (!transition.sources.includes(row.status)) {
      rollback(db);
      return { status: 409, body: { message: "Invalid execution transition" } };
    }

    let sql = "UPDATE executions SET status = ? WHERE execution_id = ? AND status = ?";
    if (action === "start") {
      sql = "UPDATE executions SET status = ?, started_at = COALESCE(started_at, ?) WHERE execution_id = ? AND status = ?";
    } else if (action === "complete") {
      sql = "UPDATE executions SET status = ?, completed_at = ? WHERE execution_id = ? AND status = ?";
    }
    const now = new Date().toISOString();
    const update = action === "start" || action === "complete"
      ? db.prepare(sql).run(transition.target, now, executionId, row.status)
      : db.prepare(sql).run(transition.target, executionId, row.status);

    if (Number(update.changes) === 0) {
      const latest = getExecution(db, executionId);
      if (latest?.status === transition.target) {
        db.exec("COMMIT");
        return { status: 200, body: { execution: latest, duplicate: true } };
      }
      rollback(db);
      return { status: 409, body: { message: "Execution transition conflict" } };
    }

    const execution = getExecution(db, executionId);
    record({
      actor: { actor_type: "user", actor_id: userId },
      project_id: row.project_id,
      action:
        action === "start" ? "execution.started"
        : action === "pause" ? "execution.paused"
        : action === "resume" ? "execution.resumed"
        : action === "complete" ? "execution.completed"
        : "execution.rolled_back",
      target_table: "executions",
      target_id: executionId,
      old_value: { status: row.status },
      new_value: execution,
      trigger: "api",
    });
    db.exec("COMMIT");
    return { status: 200, body: { execution, duplicate: false } };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

