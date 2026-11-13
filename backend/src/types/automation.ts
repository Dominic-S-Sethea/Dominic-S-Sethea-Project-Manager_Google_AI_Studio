/**
 * Persisted Automation domain contracts.
 *
 * This module contains types only. It does not implement workflow execution,
 * state transitions, permissions, or connector interactions.
 */

export type WorkflowStatus =
  | "draft"
  | "test"
  | "published"
  | "paused"
  | "archived";

export type WorkflowNodeType =
  | "trigger"
  | "transform"
  | "decision"
  | "action"
  | "human_gate"
  | "error_handler";

export type EnvironmentMode = "preview" | "test" | "live";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "created"
  | "paused"
  | "rolled_back"
  | "error";

export type ExecutionTriggerType =
  | "event"
  | "manual"
  | "schedule"
  | "retry"
  | "replay";

export type TriggerActorType = "user" | "agent" | "system" | "automation";

export type ExecutionErrorClass = "retryable" | "permanent";

export type ExecutionStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export type ApprovalType =
  | "publish"
  | "execute"
  | "connector_action"
  | "replay_side_effect";

export type ApprovalStatus =
  | "pending"
  | "granted"
  | "rejected"
  | "expired"
  | "cancelled";

export type ApprovalRequesterType = "user" | "agent" | "automation";

export interface Workflow {
  workflow_id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  current_version_id: string | null;
  created_by: string;
  created_by_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersion {
  version_id: string;
  workflow_id: string;
  version_number: number;
  definition_json: string;
  definition_hash: string;
  schema_version: number;
  is_reviewed: number;
  review_note: string | null;
  created_by: string;
  created_at: string;
  published_at: string | null;
}

export interface WorkflowNode {
  node_id: string;
  version_id: string;
  node_type: WorkflowNodeType;
  name: string;
  config_json: string;
  credential_reference_id: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface WorkflowEdge {
  edge_id: string;
  version_id: string;
  from_node_id: string;
  to_node_id: string;
  branch_label: string | null;
  condition_expr: string | null;
}

export interface Environment {
  environment_id: string;
  project_id: string;
  name: string;
  mode: EnvironmentMode;
  is_live: number;
  created_by: string;
  created_at: string;
}

export interface Execution {
  execution_id: string;
  workflow_id: string;
  version_id: string;
  environment_id: string;
  status: ExecutionStatus;
  trigger_type: ExecutionTriggerType;
  trigger_actor_type: TriggerActorType;
  trigger_actor_id: string | null;
  idempotency_key: string;
  trace_id: string;
  approval_id: string | null;
  attempt_count: number;
  error_class: ExecutionErrorClass | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancel_requested_by: string | null;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  preview: number;
}

export interface ExecutionStep {
  step_id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  status: ExecutionStepStatus;
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

export interface Approval {
  approval_id: string;
  execution_id: string | null;
  step_id: string | null;
  workflow_id: string;
  version_id: string | null;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requested_by_type: ApprovalRequesterType;
  requested_by_id: string;
  requested_at: string;
  reviewer_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string;
  idempotency_key: string;
  created_at: string;
}

export interface CredentialReference {
  credential_reference_id: string;
  project_id: string;
  connector_id: string | null;
  environment_id: string | null;
  reference: string;
  provider_scopes: string;
  created_by: string;
  created_at: string;
  rotated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_verified_at: string | null;
}

export interface IdempotencyKey {
  key: string;
  request_hash: string;
  response_snapshot: string;
  created_at: string;
  expires_at: string;
}


