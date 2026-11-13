import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getProjectAccess } from "./projectAccess.service.ts";
import { ServiceError } from "./actor.service.ts";
import { newTraceId } from "./outbox.service.ts";
import { redact } from "./automationRedaction.ts";
import type { WorkflowNodeType } from "../types/automation.ts";

export const PINNED_DATASETS = {
  "sample-01": {
    name: "sample-01",
    event_type: "task.updated",
    pinned_payload: {
      task_id: "sample-001",
      status: "in_progress",
      blocked_by: null,
      assignee: "sample-user-001",
    },
    connector_response: {
      mocked: true,
      accepted: true,
      receipt_id: "mock-receipt-001",
    },
    fail_action: false,
  },
  "sample-042": {
    name: "sample-042",
    event_type: "task.updated",
    pinned_payload: {
      task_id: "sample-042",
      status: "blocked",
      blocked_by: "sample-028",
      assignee: "sample-user-042",
    },
    connector_response: {
      mocked: true,
      accepted: true,
      receipt_id: "mock-receipt-042",
    },
    fail_action: false,
  },
  "fail-branch": {
    name: "fail-branch",
    event_type: "task.updated",
    pinned_payload: {
      task_id: "sample-043",
      status: "done",
      blocked_by: null,
      assignee: "sample-user-043",
    },
    connector_response: {
      mocked: true,
      accepted: false,
      code: "PINNED_CONNECTOR_FAILURE",
    },
    fail_action: true,
  },
} as const;

export type PinnedDatasetName = keyof typeof PINNED_DATASETS;

interface TestRunRequest {
  dataset: PinnedDatasetName;
  environment_id: string;
}

interface WorkflowRow {
  workflow_id: string;
  project_id: string;
  current_version_id: string | null;
}

interface VersionRow {
  version_id: string;
  workflow_id: string;
}

interface EnvironmentRow {
  environment_id: string;
  project_id: string;
  mode: string;
  is_live: number;
}

interface WorkflowNodeRow {
  node_id: string;
  node_type: WorkflowNodeType;
  name: string;
  config_json: string;
  credential_reference_id: string | null;
  position_x: number;
  position_y: number;
}

interface WorkflowEdgeRow {
  from_node_id: string;
  to_node_id: string;
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

interface TestStepPreview {
  step_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  status: string;
  input_preview: string;
  output_preview: string;
  credential_reference_id: string | null;
  idempotency_key: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  created_at: string;
}

export interface TestExecutionPreview {
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
  is_test: boolean;
  dataset: string;
  steps: TestStepPreview[];
}

export interface TestRunResult {
  status: number;
  body: {
    execution: TestExecutionPreview;
    duplicate?: boolean;
  };
}

interface SimulatedStep {
  node: WorkflowNodeRow;
  status: "succeeded" | "failed" | "skipped";
  input: unknown;
  output: unknown;
  error_class: "permanent" | null;
  error_message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rollback(db: DatabaseSync): void {
  try {
    db.exec("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
}

function safeJson(value: unknown): string {
  const encoded = JSON.stringify(redact(value));
  return typeof encoded === "string" ? encoded : "null";
}

function parseJsonPreview(value: string | null): string {
  if (value === null) return "null";

  try {
    return safeJson(JSON.parse(value) as unknown);
  } catch {
    return safeJson(value);
  }
}

function parseNodeConfig(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getDatasetNameFromKey(key: string): string {
  const match = /^pm-p7-05:test:(sample-01|sample-042|fail-branch):/.exec(key);
  return match?.[1] ?? "unknown";
}

function makeIdempotencyKey(
  workflowId: string,
  versionId: string,
  environmentId: string,
  datasetName: PinnedDatasetName,
): string {
  const tuple = [workflowId, versionId, environmentId, datasetName].join("\u001f");
  const digest = createHash("sha256").update(tuple, "utf8").digest("hex");
  return `pm-p7-05:test:${datasetName}:${digest}`;
}

function compareNodes(left: WorkflowNodeRow, right: WorkflowNodeRow): number {
  return (
    left.position_y - right.position_y ||
    left.position_x - right.position_x ||
    left.node_id.localeCompare(right.node_id)
  );
}

function orderNodes(
  nodes: WorkflowNodeRow[],
  edges: WorkflowEdgeRow[],
): WorkflowNodeRow[] {
  const nodeById = new Map(nodes.map((node) => [node.node_id, node]));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of nodes) {
    indegree.set(node.node_id, 0);
    outgoing.set(node.node_id, []);
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.from_node_id) || !nodeById.has(edge.to_node_id)) {
      continue;
    }

    outgoing.get(edge.from_node_id)?.push(edge.to_node_id);
    indegree.set(
      edge.to_node_id,
      (indegree.get(edge.to_node_id) ?? 0) + 1,
    );
  }

  const ready = nodes
    .filter((node) => indegree.get(node.node_id) === 0)
    .sort(compareNodes);

  const ordered: WorkflowNodeRow[] = [];

  while (ready.length > 0) {
    const node = ready.shift();
    if (!node) break;

    ordered.push(node);

    for (const nextId of outgoing.get(node.node_id) ?? []) {
      const nextDegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextDegree);

      if (nextDegree === 0) {
        const nextNode = nodeById.get(nextId);
        if (nextNode) {
          ready.push(nextNode);
          ready.sort(compareNodes);
        }
      }
    }
  }

  if (ordered.length !== nodes.length) {
    throw new ServiceError(
      400,
      "The workflow contains a cycle and cannot be test-run.",
      "WORKFLOW_CYCLE",
    );
  }

  return ordered;
}

function simulatePinnedSteps(
  nodes: WorkflowNodeRow[],
  dataset: (typeof PINNED_DATASETS)[PinnedDatasetName],
): SimulatedStep[] {
  const steps: SimulatedStep[] = [];
  let currentValue: unknown = dataset.pinned_payload;
  let failed = false;
  let awaitingApproval = false;

  for (const node of nodes) {
    const input = {
      dataset: dataset.name,
      event_type: dataset.event_type,
      data: currentValue,
    };

    if (awaitingApproval) {
      steps.push({
        node,
        status: "skipped",
        input,
        output: {
          skipped: true,
          reason: "A preceding human gate requires review.",
          preview_only: true,
        },
        error_class: null,
        error_message: null,
      });
      continue;
    }

    if (failed && node.node_type !== "error_handler") {
      steps.push({
        node,
        status: "skipped",
        input,
        output: {
          skipped: true,
          reason: "A preceding pinned test step failed.",
          preview_only: true,
        },
        error_class: null,
        error_message: null,
      });
      continue;
    }

    const config = parseNodeConfig(node.config_json);
    let status: SimulatedStep["status"] = "succeeded";
    let output: Record<string, unknown>;
    let errorClass: SimulatedStep["error_class"] = null;
    let errorMessage: string | null = null;

    switch (node.node_type) {
      case "trigger":
        output = {
          received: true,
          event_type: dataset.event_type,
          payload: currentValue,
          pinned: true,
        };
        break;

      case "transform":
        output = isRecord(currentValue)
          ? { ...currentValue, preview_transformed: true }
          : { value: currentValue, preview_transformed: true };
        break;

      case "decision": {
        const statusValue =
          isRecord(currentValue) && typeof currentValue.status === "string"
            ? currentValue.status
            : "";
        const branch = statusValue === "blocked" ? "YES" : "NO";

        output = {
          branch,
          condition_result: branch === "YES",
          evaluated_against: "pinned_dataset",
        };
        break;
      }

      case "action": {
        const configuredOperation = config.operation;
        const operation =
          typeof configuredOperation === "string" &&
          /^[A-Za-z0-9_.:-]{1,80}$/.test(configuredOperation)
            ? configuredOperation
            : "mocked_action";

        output = {
          mocked: true,
          operation,
          configuration_preview: redact(config),
          response: dataset.connector_response,
          external_side_effect_performed: false,
        };

        if (dataset.fail_action) {
          status = "failed";
          errorClass = "permanent";
          errorMessage = "Pinned test action failed.";
          failed = true;
          output = {
            ...output,
            failure: true,
            error_class: "permanent",
            error_message: errorMessage,
          };
        }
        break;
      }

      case "human_gate":
        status = "skipped";
        awaitingApproval = true;
        output = {
          state: "awaiting_approval",
          approval_required: true,
          approval_record_created: false,
          preview_only: true,
        };
        break;

      case "error_handler":
        output = {
          handled: failed,
          recovery_path: failed ? "manual_review" : "not_needed",
          preview_only: true,
        };
        break;

      default:
        output = {
          skipped: true,
          reason: "Unsupported node type in pinned test mode.",
          preview_only: true,
        };
        status = "skipped";
        break;
    }

    steps.push({
      node,
      status,
      input,
      output,
      error_class: errorClass,
      error_message: errorMessage,
    });

    if (status !== "skipped") {
      currentValue = output;
    }
  }

  return steps;
}

function toStepPreview(row: ExecutionStepRow): TestStepPreview {
  return redact({
    step_id: row.step_id,
    node_id: row.node_id,
    node_type: row.node_type,
    attempt: row.attempt,
    status: row.status,
    input_preview: parseJsonPreview(row.input_json),
    output_preview: parseJsonPreview(row.output_json),
    credential_reference_id: row.credential_reference_id,
    idempotency_key: row.idempotency_key,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_ms: row.duration_ms,
    error_class: row.error_class,
    error_message: row.error_message,
    created_at: row.created_at,
  }) as TestStepPreview;
}

function buildExecutionPreview(
  db: DatabaseSync,
  row: ExecutionRow,
): TestExecutionPreview {
  const stepRows = db.prepare(
    `SELECT step_id, node_id, node_type, attempt, status, input_json, output_json,
            credential_reference_id, idempotency_key, started_at, ended_at,
            duration_ms, error_class, error_message, created_at
     FROM execution_steps
     WHERE execution_id = ?
     ORDER BY rowid ASC`,
  ).all(row.execution_id) as unknown as ExecutionStepRow[];

  const safeExecution = redact({
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
    dataset: getDatasetNameFromKey(row.idempotency_key),
  }) as Omit<TestExecutionPreview, "steps">;

  return {
    ...safeExecution,
    steps: stepRows.map(toStepPreview),
  };
}

export async function createTestExecution(
  db: DatabaseSync,
  userId: string,
  workflowId: string,
  input: unknown,
): Promise<TestRunResult> {
  if (!userId.trim()) {
    throw new ServiceError(401, "Authentication required.", "AUTH_REQUIRED");
  }

  if (!workflowId.trim() || !isRecord(input)) {
    throw new ServiceError(400, "Invalid test-run request.", "INVALID_TEST_REQUEST");
  }

  const body = input as Record<string, unknown>;
  const datasetValue = body.dataset;
  const environmentId = body.environment_id;

  if (
    typeof datasetValue !== "string" ||
    !Object.prototype.hasOwnProperty.call(PINNED_DATASETS, datasetValue) ||
    typeof environmentId !== "string" ||
    !environmentId.trim() ||
    Object.keys(body).some((key) => key !== "dataset" && key !== "environment_id")
  ) {
    throw new ServiceError(
      400,
      "A known dataset and environment_id are required.",
      "INVALID_TEST_REQUEST",
    );
  }

  const datasetName = datasetValue as PinnedDatasetName;
  const dataset = PINNED_DATASETS[datasetName];

  db.exec("BEGIN IMMEDIATE");
  let transactionOpen = true;

  try {
    const workflow = db.prepare(
      `SELECT workflow_id, project_id, current_version_id
       FROM workflows
       WHERE workflow_id = ?`,
    ).get(workflowId) as WorkflowRow | undefined;

    if (!workflow) {
      throw new ServiceError(404, "Workflow not found.", "WORKFLOW_NOT_FOUND");
    }

    const access = await getProjectAccess(workflow.project_id, userId);
    if (!access?.canWrite) {
      throw new ServiceError(
        403,
        "Project write access required.",
        "PROJECT_WRITE_ACCESS_REQUIRED",
      );
    }

    if (!workflow.current_version_id) {
      throw new ServiceError(
        400,
        "The workflow has no current version to test.",
        "WORKFLOW_VERSION_REQUIRED",
      );
    }

    const version = db.prepare(
      `SELECT version_id, workflow_id
       FROM workflow_versions
       WHERE version_id = ?`,
    ).get(workflow.current_version_id) as VersionRow | undefined;

    if (!version || version.workflow_id !== workflow.workflow_id) {
      throw new ServiceError(
        400,
        "The workflow current version is invalid.",
        "INVALID_WORKFLOW_VERSION",
      );
    }

    const environment = db.prepare(
      `SELECT environment_id, project_id, mode, is_live
       FROM environments
       WHERE environment_id = ?`,
    ).get(environmentId) as EnvironmentRow | undefined;

    if (!environment) {
      throw new ServiceError(
        404,
        "Environment not found.",
        "ENVIRONMENT_NOT_FOUND",
      );
    }

    if (
      environment.project_id !== workflow.project_id ||
      environment.mode !== "preview" ||
      environment.is_live !== 0
    ) {
      throw new ServiceError(
        400,
        "Test runs require a non-live preview environment in the workflow project.",
        "PREVIEW_ENVIRONMENT_REQUIRED",
      );
    }

    const idempotencyKey = makeIdempotencyKey(
      workflow.workflow_id,
      version.version_id,
      environment.environment_id,
      datasetName,
    );

    const existing = db.prepare(
      "SELECT * FROM executions WHERE idempotency_key = ?",
    ).get(idempotencyKey) as ExecutionRow | undefined;

    if (existing) {
      const sameRequest =
        existing.workflow_id === workflow.workflow_id &&
        existing.version_id === version.version_id &&
        existing.environment_id === environment.environment_id &&
        existing.preview === 1;

      db.exec("ROLLBACK");
      transactionOpen = false;

      if (!sameRequest) {
        throw new ServiceError(
          409,
          "The test-run idempotency key conflicts with another execution.",
          "IDEMPOTENCY_CONFLICT",
        );
      }

      return {
        status: 200,
        body: {
          execution: buildExecutionPreview(db, existing),
          duplicate: true,
        },
      };
    }

    const nodeRows = db.prepare(
      `SELECT node_id, node_type, name, config_json, credential_reference_id,
              position_x, position_y
       FROM workflow_nodes
       WHERE version_id = ?
       ORDER BY position_y, position_x, node_id`,
    ).all(version.version_id) as unknown as WorkflowNodeRow[];

    if (nodeRows.length === 0) {
      throw new ServiceError(
        400,
        "The current workflow version has no nodes to test.",
        "WORKFLOW_NODES_REQUIRED",
      );
    }

    const edgeRows = db.prepare(
      `SELECT from_node_id, to_node_id
       FROM workflow_edges
       WHERE version_id = ?`,
    ).all(version.version_id) as unknown as WorkflowEdgeRow[];

    const orderedNodes = orderNodes(nodeRows, edgeRows);
    const simulatedSteps = simulatePinnedSteps(orderedNodes, dataset);
    const hasFailure = simulatedSteps.some((step) => step.status === "failed");
    const awaitsApproval = simulatedSteps.some(
      (step) => step.node.node_type === "human_gate",
    );

    const executionStatus = hasFailure
      ? "failed"
      : awaitsApproval
        ? "awaiting_approval"
        : "succeeded";

    const now = new Date().toISOString();
    const completedAt = executionStatus === "awaiting_approval" ? null : now;
    const executionId = randomUUID();
    const traceId = newTraceId();
    const errorClass = hasFailure ? "permanent" : null;
    const errorMessage = hasFailure ? "Pinned test step failed." : null;

    db.prepare(
      `INSERT INTO executions (
         execution_id, workflow_id, version_id, environment_id, status,
         trigger_type, trigger_actor_type, trigger_actor_id, idempotency_key,
         trace_id, attempt_count, error_class, error_message, started_at,
         completed_at, created_at, preview
       )
       VALUES (?, ?, ?, ?, ?, 'manual', 'user', ?, ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
    ).run(
      executionId,
      workflow.workflow_id,
      version.version_id,
      environment.environment_id,
      executionStatus,
      userId,
      idempotencyKey,
      traceId,
      errorClass,
      errorMessage,
      now,
      completedAt,
      now,
    );

    for (const step of simulatedSteps) {
      const stepId = randomUUID();
      const stepIdempotencyKey = `${idempotencyKey}:${step.node.node_id}`;

      db.prepare(
        `INSERT INTO execution_steps (
           step_id, execution_id, node_id, node_type, attempt, status,
           input_json, output_json, credential_reference_id, idempotency_key,
           started_at, ended_at, duration_ms, error_class, error_message, created_at
         )
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      ).run(
        stepId,
        executionId,
        step.node.node_id,
        step.node.node_type,
        step.status,
        safeJson(step.input),
        safeJson(step.output),
        step.node.credential_reference_id,
        stepIdempotencyKey,
        now,
        now,
        step.error_class,
        step.error_message,
        now,
      );
    }

    const execution = db.prepare(
      "SELECT * FROM executions WHERE execution_id = ?",
    ).get(executionId) as ExecutionRow | undefined;

    if (!execution) {
      throw new Error("Test execution insert did not produce a row.");
    }

    db.exec("COMMIT");
    transactionOpen = false;

    return {
      status: 201,
      body: {
        execution: buildExecutionPreview(db, execution),
        duplicate: false,
      },
    };
  } catch (error) {
    if (transactionOpen) rollback(db);
    throw error;
  }
}