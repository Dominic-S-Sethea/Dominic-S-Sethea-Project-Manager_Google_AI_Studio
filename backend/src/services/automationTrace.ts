import type { DatabaseSync } from "node:sqlite";
import { getProjectAccess } from "./projectAccess.service.ts";
import { ServiceError } from "./actor.service.ts";
import { redact } from "./automationRedaction.ts";

const TEST_KEY_PREFIX = "pm-p7-05:test:%";

const EXECUTION_STATUSES = new Set([
  "pending",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
  "created",
  "paused",
  "rolled_back",
  "error",
]);

interface WorkflowProjectRow {
  workflow_id: string;
  project_id: string;
}

interface ExecutionRow {
  execution_id: string;
  workflow_id: string;
  version_id: string;
  environment_id: string;
  status: string;
  trigger_type: string;
  trigger_actor_type: string;
  trigger_actor_id: string | null;
  idempotency_key: string;
  trace_id: string;
  attempt_count: number;
  error_class: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  preview: number;
}

interface ExecutionStepRow {
  step_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  status: string;
  input_json: string | null;
  output_json: string | null;
  credential_reference_id: string | null;
  idempotency_key: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  created_at: string;
}

export interface TraceListOptions {
  workflowId: string;
  limit?: number;
  offset?: number;
  status?: string;
}

function parsePreview(value: string | null): string {
  if (value === null) return "null";

  try {
    return JSON.stringify(redact(JSON.parse(value) as unknown)) ?? "null";
  } catch {
    return JSON.stringify(redact(value)) ?? "null";
  }
}

function getDatasetName(idempotencyKey: string): string {
  const match = /^pm-p7-05:test:(sample-01|sample-042|fail-branch):/.exec(
    idempotencyKey,
  );
  return match?.[1] ?? "unknown";
}

function executionForTrace(row: ExecutionRow): Record<string, unknown> {
  return redact({
    execution_id: row.execution_id,
    workflow_id: row.workflow_id,
    version_id: row.version_id,
    environment_id: row.environment_id,
    status: row.status,
    trigger_type: row.trigger_type,
    trigger_actor_type: row.trigger_actor_type,
    trigger_actor_id: row.trigger_actor_id,
    idempotency_key: row.idempotency_key,
    trace_id: row.trace_id,
    attempt_count: row.attempt_count,
    error_class: row.error_class,
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    preview: row.preview,
    is_test: true,
    dataset: getDatasetName(row.idempotency_key),
  }) as Record<string, unknown>;
}

function stepForTrace(row: ExecutionStepRow): Record<string, unknown> {
  return redact({
    step_id: row.step_id,
    node_id: row.node_id,
    node_type: row.node_type,
    attempt: row.attempt,
    status: row.status,
    input_preview: parsePreview(row.input_json),
    output_preview: parsePreview(row.output_json),
    credential_reference_id: row.credential_reference_id,
    idempotency_key: row.idempotency_key,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_ms: row.duration_ms,
    error_class: row.error_class,
    error_message: row.error_message,
    created_at: row.created_at,
  }) as Record<string, unknown>;
}

async function requireWorkflowReadAccess(
  workflowId: string,
  userId: string,
): Promise<WorkflowProjectRow> {
  const db = (await import("../database/index.ts")).getDb();
  const workflow = db.prepare(
    `SELECT workflow_id, project_id
     FROM workflows
     WHERE workflow_id = ?`,
  ).get(workflowId) as WorkflowProjectRow | undefined;

  if (!workflow) {
    throw new ServiceError(404, "Workflow not found.", "WORKFLOW_NOT_FOUND");
  }

  const access = await getProjectAccess(workflow.project_id, userId);
  if (!access?.canRead) {
    throw new ServiceError(404, "Workflow not found.", "WORKFLOW_NOT_FOUND");
  }

  return workflow;
}

export async function listExecutionTraces(
  db: DatabaseSync,
  userId: string,
  options: TraceListOptions,
): Promise<{
  executions: Record<string, unknown>[];
  limit: number;
  offset: number;
  total: number;
}> {
  const workflowId = options.workflowId.trim();
  if (!workflowId) {
    throw new ServiceError(400, "workflow_id is required.", "WORKFLOW_ID_REQUIRED");
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ServiceError(400, "limit must be between 1 and 100.", "INVALID_LIMIT");
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new ServiceError(400, "offset must be zero or greater.", "INVALID_OFFSET");
  }

  if (options.status && !EXECUTION_STATUSES.has(options.status)) {
    throw new ServiceError(400, "Invalid execution status filter.", "INVALID_STATUS");
  }

  const workflow = await requireWorkflowReadAccess(workflowId, userId);

  const rows = options.status
    ? db.prepare(
        `SELECT execution_id, workflow_id, version_id, environment_id, status,
                trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
                trace_id, attempt_count, error_class, error_message, started_at,
                completed_at, created_at, preview
         FROM executions
         WHERE workflow_id = ? AND preview = 1
           AND idempotency_key LIKE ? AND status = ?
         ORDER BY created_at DESC, execution_id DESC
         LIMIT ? OFFSET ?`,
      ).all(workflow.workflow_id, TEST_KEY_PREFIX, options.status, limit, offset)
    : db.prepare(
        `SELECT execution_id, workflow_id, version_id, environment_id, status,
                trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
                trace_id, attempt_count, error_class, error_message, started_at,
                completed_at, created_at, preview
         FROM executions
         WHERE workflow_id = ? AND preview = 1
           AND idempotency_key LIKE ?
         ORDER BY created_at DESC, execution_id DESC
         LIMIT ? OFFSET ?`,
      ).all(workflow.workflow_id, TEST_KEY_PREFIX, limit, offset);

  const countRow = options.status
    ? db.prepare(
        `SELECT COUNT(*) AS total
         FROM executions
         WHERE workflow_id = ? AND preview = 1
           AND idempotency_key LIKE ? AND status = ?`,
      ).get(workflow.workflow_id, TEST_KEY_PREFIX, options.status) as { total: number }
    : db.prepare(
        `SELECT COUNT(*) AS total
         FROM executions
         WHERE workflow_id = ? AND preview = 1
           AND idempotency_key LIKE ?`,
      ).get(workflow.workflow_id, TEST_KEY_PREFIX) as { total: number };

  return {
    executions: (rows as unknown as ExecutionRow[]).map(executionForTrace),
    limit,
    offset,
    total: countRow.total,
  };
}

export async function readExecutionTrace(
  db: DatabaseSync,
  userId: string,
  executionId: string,
): Promise<{
  execution: Record<string, unknown>;
  steps: Record<string, unknown>[];
}> {
  const row = db.prepare(
    `SELECT e.execution_id, e.workflow_id, e.version_id, e.environment_id,
            e.status, e.trigger_type, e.trigger_actor_type, e.trigger_actor_id,
            e.idempotency_key, e.trace_id, e.attempt_count, e.error_class,
            e.error_message, e.started_at, e.completed_at, e.created_at, e.preview,
            w.project_id
     FROM executions e
     JOIN workflows w ON w.workflow_id = e.workflow_id
     WHERE e.execution_id = ? AND e.preview = 1
       AND e.idempotency_key LIKE ?`,
  ).get(executionId, TEST_KEY_PREFIX) as (ExecutionRow & { project_id: string }) | undefined;

  if (!row) {
    throw new ServiceError(404, "Execution not found.", "EXECUTION_NOT_FOUND");
  }

  const access = await getProjectAccess(row.project_id, userId);
  if (!access?.canRead) {
    throw new ServiceError(404, "Execution not found.", "EXECUTION_NOT_FOUND");
  }

  const steps = db.prepare(
    `SELECT step_id, node_id, node_type, attempt, status, input_json, output_json,
            credential_reference_id, idempotency_key, started_at, ended_at,
            duration_ms, error_class, error_message, created_at
     FROM execution_steps
     WHERE execution_id = ?
     ORDER BY rowid ASC`,
  ).all(executionId) as unknown as ExecutionStepRow[];

  return {
    execution: executionForTrace(row),
    steps: steps.map(stepForTrace),
  };
}

/**
 * Replay is deliberately unavailable while the Automation runtime remains
 * preview-only. This function performs no reads or writes.
 */
export function replayExecution(
  _db: DatabaseSync,
  _userId: string,
  _executionId: string,
): never {
  throw new ServiceError(
    423,
    "Replay is disabled in preview-only mode.",
    "REPLAY_DISABLED",
  );
}