// Automation Studio type definitions
// Shared between backend and frontend; kept in sync with backend/src/types if needed.

export type NodeType =
  | "trigger"
  | "transform"
  | "decision"
  | "action"
  | "human_gate"
  | "error_handler";

export type SideEffectClass =
  | "none"
  | "read_only"
  | "write"
  | "send"
  | "mixed";

export interface NodeConfig {
  [key: string]: unknown;
}

export interface NodeInput {
  node_type: NodeType;
  name?: string;
  purpose?: string;
  config?: NodeConfig;
  input_schema?: unknown;
  output_schema?: unknown;
  side_effect_class?: SideEffectClass;
  idempotency?: unknown;
  credential_ref?: string | null;
  retry_policy?: unknown;
  test_cases?: unknown[];
  position_x?: number;
  position_y?: number;
}

export interface NodeOutput {
  node_type: NodeType;
  name: string;
  output_schema?: unknown;
  sample?: unknown;
}

export type EdgeType = "line" | "arrow";

export interface WorkflowEdge {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  branch_label?: string | null;
  condition_expr?: string | null;
}

export interface ValidationIssue {
  rule: string;
  severity: "error" | "warning";
  message: string;
  node_id?: string;
  field?: string;
}

export interface ValidationContext {
  project_id?: string;
  permittedScopes?: string[];
  testedNodeIds?: string[];
}

export interface Execution {
  execution_id: string;
  workflow_id: string;
  version_id: string;
  environment_id: string;
  status: string;
  trigger_type: string;
  trigger_actor_type: string;
  trigger_actor_id: string;
  idempotency_key: string;
  trace_id: string;
  attempt_count: number;
  error_class?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  is_test: boolean;
}

export interface ExecutionStep {
  step_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  status: string;
  input_preview: string;
  output_preview: string;
  credential_reference_id?: string;
  idempotency_key: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  error_class?: string;
  error_message?: string;
  created_at: string;
}

export interface Trace {
  execution_id: string;
  workflow_id: string;
  version_id: string | null;
  environment_id: string;
  status: string;
  trigger_type: string;
  trigger_actor_type: string;
  trigger_actor_id: string;
  idempotency_key: string;
  trace_id: string;
  attempt_count: number;
  error_class?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface PinnedDataset {
  name: string;
  event_type: string;
  pinned_payload: unknown;
}

export interface ReplayPolicy {
  allow_non_side_effecting: boolean;
  owner_only: boolean;
  creates_new_execution_id: boolean;
  never_mutates_original: boolean;
}

export type PinnedDatasetName =
  | "sample-01"
  | "sample-042"
  | "fail-branch";

export interface AutomationWorkflowOption {
  workflow_id: string;
  project_id: string;
  name: string;
  status: string;
  current_version_id: string | null;
}

export interface AutomationEnvironmentOption {
  environment_id: string;
  project_id: string;
  name: string;
  mode: "preview" | "test" | "live";
  is_live: number | boolean;
}

export interface AutomationExecutionListItem extends Execution {
  dataset: string;
  preview: number;
}

export interface AutomationTestExecution extends Execution {
  dataset: string;
  preview: number;
  steps: ExecutionStep[];
}

export interface AutomationTestRunResponse {
  execution: AutomationTestExecution;
  duplicate?: boolean;
}

export interface AutomationExecutionListResponse {
  executions: AutomationExecutionListItem[];
  limit: number;
  offset: number;
  total: number;
}

export interface AutomationTraceResponse {
  execution: AutomationExecutionListItem;
  steps: ExecutionStep[];
}

export interface AutomationPublishResponse {
  workflow: {
    workflow_id: string;
    status: "published";
  };
  idempotency_key: string;
  warning: string;
}
