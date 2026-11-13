
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";
import { ServiceError } from "./actor.service.ts";
import { record } from "./audit.service.ts";
import { authorize, getProjectCreatorId } from "./projectAccess.service.ts";
import {
  containsSecretMaterial,
  redactForAudit,
} from "./redaction.service.ts";
import { requestApproval, type RequestApprovalInput } from "./approval.service.ts";

export type WorkflowStatus =
  | "draft"
  | "test"
  | "published"
  | "paused"
  | "archived";

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

export interface WorkflowNode {
  node_id: string;
  node_type: NodeType;
  name: string;
  purpose: string;
  config: Record<string, unknown>;
  input_schema?: unknown;
  output_schema?: unknown;
  side_effect_class?: SideEffectClass;
  idempotency?: unknown;
  credential_ref?: string | null;
  retry_policy?: unknown;
  test_cases?: unknown[];
  position_x: number;
  position_y: number;
}

export interface WorkflowEdge {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  branch_label?: string | null;
  condition_expr?: string | null;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  loop_guard?: {
    max_iterations: number;
  };
}

export type EdgeRejectionReason =
  | "self_loop"
  | "duplicate"
  | "cross_project"
  | "cycle";

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

export interface WorkflowRow {
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

export interface WorkflowVersionRow {
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

export interface WorkflowWithVersion {
  workflow: WorkflowRow;
  version: WorkflowVersionRow | null;
}

export interface NodeInput {
  node_type: NodeType;
  name?: string;
  purpose?: string;
  config?: Record<string, unknown>;
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

export interface UpdateWorkflowInput {
  name?: string;
  description?: string | null;
  definition?: WorkflowDefinition;
}

const NODE_TYPES = new Set<NodeType>([
  "trigger",
  "transform",
  "decision",
  "action",
  "human_gate",
  "error_handler",
]);

const SIDE_EFFECT_CLASSES = new Set<SideEffectClass>([
  "none",
  "read_only",
  "write",
  "send",
  "mixed",
]);

const SUPPORTED_EVENTS = new Set([
  "task.created",
  "task.updated",
  "project.updated",
  "workflow.run",
]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    result[key] = stableValue(value[key]);
  }
  return result;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function emptyDefinition(): WorkflowDefinition {
  return { nodes: [], edges: [] };
}

export function parseDefinition(raw: string): WorkflowDefinition {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ServiceError(500, "Stored workflow definition is invalid");
  }

  if (!isRecord(parsed)) {
    throw new ServiceError(500, "Stored workflow definition is invalid");
  }

  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];

  return {
    nodes: nodes.filter(isRecord).map((node) => ({
      node_id: typeof node.node_id === "string" ? node.node_id : "",
      node_type: node.node_type as NodeType,
      name: typeof node.name === "string" ? node.name : "",
      purpose: typeof node.purpose === "string" ? node.purpose : "",
      config: isRecord(node.config) ? node.config : {},
      ...(typeof node.input_schema !== "undefined"
        ? { input_schema: node.input_schema }
        : {}),
      ...(typeof node.output_schema !== "undefined"
        ? { output_schema: node.output_schema }
        : {}),
      ...(typeof node.side_effect_class === "string"
        ? { side_effect_class: node.side_effect_class as SideEffectClass }
        : {}),
      ...(typeof node.idempotency !== "undefined"
        ? { idempotency: node.idempotency }
        : {}),
      ...(typeof node.credential_ref === "string" ||
      node.credential_ref === null
        ? { credential_ref: node.credential_ref }
        : {}),
      ...(typeof node.retry_policy !== "undefined"
        ? { retry_policy: node.retry_policy }
        : {}),
      ...(Array.isArray(node.test_cases)
        ? { test_cases: node.test_cases }
        : {}),
      position_x:
        typeof node.position_x === "number" && Number.isFinite(node.position_x)
          ? node.position_x
          : 0,
      position_y:
        typeof node.position_y === "number" && Number.isFinite(node.position_y)
          ? node.position_y
          : 0,
    })),
    edges: edges.filter(isRecord).map((edge) => ({
      edge_id: typeof edge.edge_id === "string" ? edge.edge_id : "",
      from_node_id:
        typeof edge.from_node_id === "string" ? edge.from_node_id : "",
      to_node_id:
        typeof edge.to_node_id === "string" ? edge.to_node_id : "",
      ...(typeof edge.branch_label === "string" ||
      edge.branch_label === null
        ? { branch_label: edge.branch_label }
        : {}),
      ...(typeof edge.condition_expr === "string" ||
      edge.condition_expr === null
        ? { condition_expr: edge.condition_expr }
        : {}),
    })),
    ...(isRecord(parsed.loop_guard) &&
    typeof parsed.loop_guard.max_iterations === "number"
      ? {
          loop_guard: {
            max_iterations: parsed.loop_guard.max_iterations,
          },
        }
      : {}),
  };
}

function workflowRow(workflowId: string): WorkflowRow | undefined {
  return getDb()
    .prepare(
      `SELECT workflow_id, project_id, name, description, status,
              current_version_id, created_by, created_by_agent_id,
              created_at, updated_at
       FROM workflows
       WHERE workflow_id = ?`,
    )
    .get(workflowId) as WorkflowRow | undefined;
}

function currentVersion(workflow: WorkflowRow): WorkflowVersionRow | null {
  if (!workflow.current_version_id) return null;

  return (
    (getDb()
      .prepare(
        `SELECT version_id, workflow_id, version_number, definition_json,
                definition_hash, schema_version, is_reviewed, review_note,
                created_by, created_at, published_at
         FROM workflow_versions
         WHERE version_id = ? AND workflow_id = ?`,
      )
      .get(workflow.current_version_id, workflow.workflow_id) as
      | WorkflowVersionRow
      | undefined) ?? null
  );
}

function assertWorkflowAccess(
  actor: Actor,
  workflowId: string,
  action: "read" | "create" | "update" | "delete",
): WorkflowRow {
  const row = workflowRow(workflowId);
  if (!row) throw new ServiceError(404, "Workflow not found");

  if (!authorize(actor, row.project_id, "workflow", action)) {
    throw new ServiceError(404, "Workflow not found");
  }

  return row;
}

function assertDraft(workflow: WorkflowRow): void {
  if (workflow.status !== "draft") {
    throw new ServiceError(
      409,
      "Only draft workflows can be changed",
      "WORKFLOW_NOT_DRAFT",
    );
  }
}

function definitionForWorkflow(workflow: WorkflowRow): WorkflowDefinition {
  const version = currentVersion(workflow);
  return version ? parseDefinition(version.definition_json) : emptyDefinition();
}

function getProjectActorUserId(actor: Actor, projectId: string): string {
  if (actor.actor_type === "user") return actor.actor_id;

  if (actor.actor_type === "agent") {
    const creatorId = getProjectCreatorId(projectId);
    if (creatorId) return creatorId;
  }

  throw new ServiceError(
    403,
    "A project-bound user or explicitly authorized agent is required",
    "ACTOR_NOT_ALLOWED",
  );
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function assertSafeDefinition(definition: WorkflowDefinition): void {
  if (containsSecretMaterial({
    nodes: definition.nodes.map((node) => ({
      config: node.config,
      input_schema: node.input_schema,
      output_schema: node.output_schema,
      test_cases: node.test_cases,
    })),
  })) {
    throw new ServiceError(
      400,
      "Workflow definitions cannot contain secrets or inline credentials",
      "SECRET_MATERIAL_REJECTED",
    );
  }
}

function validateJsonSchema(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const allowedTypes = new Set([
    "object",
    "array",
    "string",
    "number",
    "integer",
    "boolean",
    "null",
  ]);

  if (
    typeof value.type !== "string" ||
    !allowedTypes.has(value.type)
  ) {
    return false;
  }

  if (typeof value.properties !== "undefined") {
    if (!isRecord(value.properties)) return false;
    for (const child of Object.values(value.properties)) {
      if (!validateJsonSchema(child)) return false;
    }
  }

  if (typeof value.items !== "undefined" && !validateJsonSchema(value.items)) {
    return false;
  }

  if (typeof value.required !== "undefined") {
    if (
      !Array.isArray(value.required) ||
      value.required.some((entry) => typeof entry !== "string")
    ) {
      return false;
    }
  }

  return true;
}

function hasUnsafeExpression(value: string): boolean {
  return (
    value.length === 0 ||
    value.length > 500 ||
    /\b(?:eval|Function|fetch|XMLHttpRequest|require|import|Date|Math\.random|process|globalThis|window|document)\b/.test(
      value,
    ) ||
    /(?:https?:\/\/|javascript:|data:)/i.test(value)
  );
}

function graphHasCycle(definition: WorkflowDefinition): boolean {
  const adjacency = new Map<string, string[]>();

  for (const node of definition.nodes) adjacency.set(node.node_id, []);
  for (const edge of definition.edges) {
    const targets = adjacency.get(edge.from_node_id);
    if (targets) targets.push(edge.to_node_id);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const target of adjacency.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const node of definition.nodes) {
    if (visit(node.node_id)) return true;
  }

  return false;
}

function allowedLoopGuard(definition: WorkflowDefinition): boolean {
  return (
    typeof definition.loop_guard?.max_iterations === "number" &&
    Number.isInteger(definition.loop_guard.max_iterations) &&
    definition.loop_guard.max_iterations >= 1 &&
    definition.loop_guard.max_iterations <= 100
  );
}

function connectorOperationAllowed(
  connectorId: string,
  operationId: string,
  projectId: string | undefined,
): boolean {
  const connector = getDb()
    .prepare(
      `SELECT project_id, allowed_actions
       FROM connectors
       WHERE connector_id = ?`,
    )
    .get(connectorId) as
    | { project_id: string | null; allowed_actions: string }
    | undefined;

  if (!connector || !connector.project_id) return false;
  if (projectId && connector.project_id !== projectId) return false;

  try {
    const actions: unknown = JSON.parse(connector.allowed_actions);
    return (
      Array.isArray(actions) &&
      actions.includes(operationId) &&
      !actions.includes("*")
    );
  } catch {
    return false;
  }
}

function credentialReferenceMatches(
  credentialRef: string,
  projectId: string | undefined,
): boolean {
  const row = getDb()
    .prepare(
      `SELECT project_id, revoked_at, expires_at
       FROM credential_references
       WHERE credential_reference_id = ?`,
    )
    .get(credentialRef) as
    | {
        project_id: string;
        revoked_at: string | null;
        expires_at: string | null;
      }
    | undefined;

  return Boolean(
    row &&
      row.revoked_at === null &&
      (!row.expires_at || Date.parse(row.expires_at) > Date.now()) &&
      (!projectId || row.project_id === projectId),
  );
}

export function validateWorkflow(
  definition: WorkflowDefinition,
  context: ValidationContext = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = definition.nodes;
  const edges = definition.edges;
  const nodesById = new Map(nodes.map((node) => [node.node_id, node]));
  const names = new Set<string>();
  const outgoing = new Map<string, WorkflowEdge[]>();

  for (const edge of edges) {
    const current = outgoing.get(edge.from_node_id) ?? [];
    current.push(edge);
    outgoing.set(edge.from_node_id, current);
  }

  const add = (
    rule: string,
    severity: "error" | "warning",
    message: string,
    node?: WorkflowNode,
    field?: string,
  ): void => {
    issues.push({
      rule,
      severity,
      message,
      ...(node ? { node_id: node.node_id } : {}),
      ...(field ? { field } : {}),
    });
  };

  for (const node of nodes) {
    if (!NODE_TYPES.has(node.node_type)) {
      add("V-01", "error", "Node type is not in the approved catalog", node, "node_type");
    }

    const name = normalizeName(node.name);
    if (!name || !normalizeName(node.purpose)) {
      add("V-02", "error", "Node name and purpose are required", node);
    }

    const normalizedName = name.toLocaleLowerCase();
    if (normalizedName && names.has(normalizedName)) {
      add("V-02", "error", "Node names must be unique within a workflow", node, "name");
    }
    if (normalizedName) names.add(normalizedName);

    if (!isRecord(node.config)) {
      add("V-03", "error", "Node configuration must be an object", node, "config");
      continue;
    }

    if (
      node.input_schema &&
      !validateJsonSchema(node.input_schema)
    ) {
      add("V-04", "error", "Input schema is not a supported JSON schema", node, "input_schema");
    }
    if (
      node.output_schema &&
      !validateJsonSchema(node.output_schema)
    ) {
      add("V-04", "error", "Output schema is not a supported JSON schema", node, "output_schema");
    }

    const config = node.config;

    if (node.node_type === "trigger") {
      if (
        typeof config.event_type !== "string" ||
        !SUPPORTED_EVENTS.has(config.event_type)
      ) {
        add("V-06", "error", "Trigger event type is not supported", node, "config.event_type");
      }
      if (
        typeof config.subscription_id !== "string" ||
        config.subscription_id.trim().length === 0
      ) {
        add("V-03", "error", "Trigger subscription_id is required", node, "config.subscription_id");
      }
    }

    if (node.node_type === "transform") {
      if (!isRecord(config.mapping)) {
        add("V-03", "error", "Transform mapping must be an object", node, "config.mapping");
      }
      if (!["fail", "pass-through"].includes(String(config.on_error))) {
        add("V-03", "error", "Transform on_error must be fail or pass-through", node, "config.on_error");
      }
      if (
        Object.keys(config).some((key) =>
          /connector|http|url|endpoint|fetch/i.test(key),
        ) ||
        JSON.stringify(config).match(/https?:\/\//i)
      ) {
        add("V-14", "error", "Transform nodes cannot contain external calls or HTTP references", node);
      }
    }

    if (node.node_type === "decision") {
      const branches = Array.isArray(config.branches)
        ? config.branches
        : [];

      const nodeEdges = outgoing.get(node.node_id) ?? [];
      if (
        nodeEdges.length < 2 ||
        nodeEdges.some(
          (edge) =>
            typeof edge.branch_label !== "string" ||
            edge.branch_label.trim().length === 0,
        )
      ) {
        add("V-07", "error", "Decision nodes need at least two labeled outgoing edges", node);
      }

      if (
        typeof config.default_target_node_id !== "string" ||
        !nodesById.has(config.default_target_node_id)
      ) {
        add("V-08", "error", "Decision nodes require an existing default branch target", node, "config.default_target_node_id");
      }

      if (branches.length < 2) {
        add("V-07", "error", "Decision configuration requires at least two branches", node, "config.branches");
      }

      for (const branch of branches) {
        if (
          !isRecord(branch) ||
          typeof branch.condition !== "string" ||
          hasUnsafeExpression(branch.condition)
        ) {
          add("V-09", "error", "Decision conditions must be deterministic, bounded expressions", node, "config.branches");
          break;
        }
      }
    }

    if (node.node_type === "action") {
      const connectorId =
        typeof config.connector_id === "string" ? config.connector_id : "";
      const operationId =
        typeof config.operation_id === "string" ? config.operation_id : "";

      if (
        !connectorId ||
        !operationId ||
        !connectorOperationAllowed(
          connectorId,
          operationId,
          context.project_id,
        )
      ) {
        add("V-10", "error", "Action connector operation is not approved for this project", node, "config.operation_id");
      }

      const scopes = Array.isArray(config.scope)
        ? config.scope.filter((scope): scope is string => typeof scope === "string")
        : [];

      if (
        scopes.length === 0 ||
        scopes.some((scope) => scope.includes("*"))
      ) {
        add("V-11", "error", "Action scope must be explicit and least-privilege", node, "config.scope");
      }

      if (
        !SIDE_EFFECT_CLASSES.has(node.side_effect_class ?? "none") ||
        !["write", "send"].includes(node.side_effect_class ?? "") ||
        !node.idempotency ||
        typeof node.idempotency === "string" &&
          node.idempotency.trim().length === 0
      ) {
        add("V-12", "error", "Actions require a declared write/send class and idempotency strategy", node);
      }

      if (
        !node.credential_ref ||
        !credentialReferenceMatches(
          node.credential_ref,
          context.project_id,
        )
      ) {
        add("V-13", "error", "Action credential_ref must identify an active project credential reference", node, "credential_ref");
      }
    }

    if (node.node_type === "human_gate") {
      const reviewerPolicy = config.reviewer_policy;
      let reviewerIds: string[] = [];

      if (Array.isArray(reviewerPolicy)) {
        reviewerIds = reviewerPolicy.filter(
          (id): id is string => typeof id === "string",
        );
      } else if (
        isRecord(reviewerPolicy) &&
        Array.isArray(reviewerPolicy.user_ids)
      ) {
        reviewerIds = reviewerPolicy.user_ids.filter(
          (id): id is string => typeof id === "string",
        );
      }

      const reviewerProjectId = context.project_id;
      const hasProjectOwner = Boolean(
        reviewerProjectId &&
          reviewerIds.some((userId) => {
            const row = getDb()
              .prepare(
                `SELECT p.created_by, pm.role
                 FROM projects p
                 LEFT JOIN project_members pm
                   ON pm.project_id = p.project_id AND pm.user_id = ?
                 WHERE p.project_id = ?`,
              )
              .get(userId, reviewerProjectId) as
              | { created_by: string; role: string | null }
              | undefined;

            return row?.created_by === userId || row?.role === "owner";
          }),
      );

      if (!hasProjectOwner) {
        add("V-15", "error", "Human-gate reviewer policy must resolve to at least one project owner", node, "config.reviewer_policy");
      }
      if (
        typeof config.expiry_seconds !== "number" ||
        config.expiry_seconds <= 0 ||
        !config.escalation_policy
      ) {
        add("V-16", "error", "Human gates require expiry_seconds and escalation_policy", node);
      }
    }

    if (node.node_type === "error_handler") {
      const recovery = config.recovery;
      if (!["retry", "notify", "create_review", "end"].includes(String(recovery))) {
        add("V-17", "error", "Error handler recovery must be an approved recovery action", node, "config.recovery");
      }
      if (recovery === "retry" &&
        (typeof config.max_retries !== "number" ||
          !Number.isInteger(config.max_retries) ||
          config.max_retries < 1 ||
          config.max_retries > 10)
      ) {
        add("V-17", "error", "Retry recovery requires max_retries from 1 to 10", node, "config.max_retries");
      }
      if (
        recovery === "notify" &&
        (typeof config.notify_target !== "string" ||
          config.notify_target.trim().length === 0)
      ) {
        add("V-17", "error", "Notify recovery requires a notify_target", node, "config.notify_target");
      }
    }

    if (containsSecretMaterial({
      config: node.config,
      input_schema: node.input_schema,
      output_schema: node.output_schema,
      test_cases: node.test_cases,
    })) {
      add("V-20", "error", "Node data contains a secret or credential-like value", node);
    }

    if (context.permittedScopes) {
      const required = Array.isArray(config.scope)
        ? config.scope.filter((scope): scope is string => typeof scope === "string")
        : [];

      if (
        required.some((scope) => !context.permittedScopes?.includes(scope))
      ) {
        add("V-21", "warning", "Current actor may not have every required scope", node);
      }
    }

    if (!node.test_cases || node.test_cases.length === 0) {
      add("V-22", "warning", "Node has no pinned test case", node, "test_cases");
    }

    if (
      context.testedNodeIds &&
      !context.testedNodeIds.includes(node.node_id)
    ) {
      add("V-23", "warning", "Node has no passing test summary for the current version", node);
    }
  }

  if (nodes.filter((node) => node.node_type === "trigger").length !== 1) {
    add("V-05", "error", "A workflow version must contain exactly one trigger");
  }

  const nodeIds = new Set(nodes.map((node) => node.node_id));
  for (const edge of edges) {
    if (
      !nodeIds.has(edge.from_node_id) ||
      !nodeIds.has(edge.to_node_id)
    ) {
      add("V-18", "error", "An edge references a node outside this workflow version");
    }
  }

  if (graphHasCycle(definition) && !allowedLoopGuard(definition)) {
    add("V-18", "error", "Workflow graph contains a cycle without an explicit loop guard");
  }

  const hasTerminal = nodes.some(
    (node) => (outgoing.get(node.node_id) ?? []).length === 0,
  );
  if (!hasTerminal) {
    add("V-19", "error", "Workflow requires at least one terminal node");
  }

  const severityOrder = (severity: ValidationIssue["severity"]): number =>
    severity === "error" ? 0 : 1;

  return issues.sort((left, right) => {
    const severityDifference =
      severityOrder(left.severity) - severityOrder(right.severity);
    if (severityDifference !== 0) return severityDifference;
    return left.rule.localeCompare(right.rule, undefined, { numeric: true });
  });
}

function validNodeForProjection(node: WorkflowNode): boolean {
  return (
    typeof node.node_id === "string" &&
    node.node_id.length > 0 &&
    NODE_TYPES.has(node.node_type) &&
    typeof node.name === "string" &&
    node.name.trim().length > 0 &&
    node.name.trim().length <= 120
  );
}

/**
 * Rebuilds the normalized node/edge projection from the saved version JSON.
 * Invalid draft nodes are retained in definition_json for correction but are
 * not projected into tables whose CHECK/FK constraints require valid rows.
 */
export function syncVersionRows(
  versionId: string,
  definition: WorkflowDefinition,
): void {
  const db = getDb();

  db.prepare("DELETE FROM workflow_edges WHERE version_id = ?").run(versionId);
  db.prepare("DELETE FROM workflow_nodes WHERE version_id = ?").run(versionId);

  const validNodes = definition.nodes.filter(validNodeForProjection);
  const validIds = new Set(validNodes.map((node) => node.node_id));

  for (const node of validNodes) {
    const credentialReferenceId =
      typeof node.credential_ref === "string" &&
      db.prepare(
        `SELECT credential_reference_id
         FROM credential_references
         WHERE credential_reference_id = ?`,
      ).get(node.credential_ref)
        ? node.credential_ref
        : null;

    db.prepare(
      `INSERT INTO workflow_nodes (
        node_id, version_id, node_type, name, config_json,
        credential_reference_id, position_x, position_y, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      node.node_id,
      versionId,
      node.node_type,
      node.name.trim(),
      JSON.stringify(node.config ?? {}),
      credentialReferenceId,
      Number.isFinite(node.position_x) ? node.position_x : 0,
      Number.isFinite(node.position_y) ? node.position_y : 0,
      new Date().toISOString(),
    );
  }

  for (const edge of definition.edges) {
    if (
      !edge.edge_id ||
      !validIds.has(edge.from_node_id) ||
      !validIds.has(edge.to_node_id)
    ) {
      continue;
    }

    db.prepare(
      `INSERT INTO workflow_edges (
        edge_id, version_id, from_node_id, to_node_id,
        branch_label, condition_expr
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      edge.edge_id,
      versionId,
      edge.from_node_id,
      edge.to_node_id,
      edge.branch_label ?? null,
      edge.condition_expr ?? null,
    );
  }
}

function assertProjectWrite(actor: Actor, projectId: string): void {
  if (!authorize(actor, projectId, "workflow", "update")) {
    throw new ServiceError(404, "Workflow not found");
  }
}

export function createWorkflow(
  actor: Actor,
  projectId: string,
  name: string,
  description?: string,
): WorkflowRow {
  const normalizedName = normalizeName(name);
  if (!projectId || !normalizedName || normalizedName.length > 120) {
    throw new ServiceError(400, "Project and workflow name are required");
  }

  if (!authorize(actor, projectId, "workflow", "create")) {
    throw new ServiceError(404, "Project not found");
  }

  const createdBy = getProjectActorUserId(actor, projectId);
  const workflowId = randomUUID();
  const versionId = randomUUID();
  const now = new Date().toISOString();
  const definition = emptyDefinition();
  const definitionJson = stableJson(definition);
  const definitionHash = createHash("sha256")
    .update(definitionJson)
    .digest("hex");

  return withTransaction(() => {
    const db = getDb();

    // workflows.current_version_id and workflow_versions.workflow_id form a
    // circular foreign-key pair: insert the workflow first with a NULL
    // current_version_id, then the version, then point the workflow at it.
    db.prepare(
      `INSERT INTO workflows (
        workflow_id, project_id, name, description, status,
        current_version_id, created_by, created_by_agent_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'draft', NULL, ?, ?, ?, ?)`,
    ).run(
      workflowId,
      projectId,
      normalizedName,
      description?.trim() || null,
      createdBy,
      actor.actor_type === "agent" ? actor.actor_id : null,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO workflow_versions (
        version_id, workflow_id, version_number, definition_json,
        definition_hash, schema_version, is_reviewed, created_by, created_at
      ) VALUES (?, ?, 1, ?, ?, 1, 0, ?, ?)`,
    ).run(
      versionId,
      workflowId,
      definitionJson,
      definitionHash,
      actor.actor_id,
      now,
    );

    db.prepare(
      `UPDATE workflows SET current_version_id = ? WHERE workflow_id = ?`,
    ).run(versionId, workflowId);

    record({
      actor,
      project_id: projectId,
      action: "workflow.created",
      target_table: "workflows",
      target_id: workflowId,
      new_value: {
        workflow_id: workflowId,
        project_id: projectId,
        name: normalizedName,
        description: description ?? null,
        status: "draft",
        definition,
      },
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    const created = workflowRow(workflowId);
    if (!created) throw new ServiceError(500, "Workflow creation failed");
    return created;
  });
}

export function getWorkflow(
  actor: Actor,
  workflowId: string,
): WorkflowWithVersion {
  const workflow = assertWorkflowAccess(actor, workflowId, "read");
  return {
    workflow,
    version: currentVersion(workflow),
  };
}

export function listWorkflows(
  actor: Actor,
  projectId: string,
  status?: WorkflowStatus,
): WorkflowRow[] {
  if (!authorize(actor, projectId, "workflow", "read")) {
    throw new ServiceError(404, "Workflows not found");
  }

  const rows = status
    ? getDb()
        .prepare(
          `SELECT workflow_id, project_id, name, description, status,
                  current_version_id, created_by, created_by_agent_id,
                  created_at, updated_at
           FROM workflows
           WHERE project_id = ? AND status = ?
           ORDER BY updated_at DESC`,
        )
        .all(projectId, status) as unknown as WorkflowRow[]
    : getDb()
        .prepare(
          `SELECT workflow_id, project_id, name, description, status,
                  current_version_id, created_by, created_by_agent_id,
                  created_at, updated_at
           FROM workflows
           WHERE project_id = ?
           ORDER BY updated_at DESC`,
        )
        .all(projectId) as unknown as WorkflowRow[];

  return rows;
}

export function updateWorkflow(
  actor: Actor,
  workflowId: string,
  input: UpdateWorkflowInput,
): { workflow: WorkflowRow; issues: ValidationIssue[] } {
  const currentWorkflow = assertWorkflowAccess(actor, workflowId, "update");
  assertDraft(currentWorkflow);

  const currentVersionRow = currentVersion(currentWorkflow);
  if (!currentVersionRow) {
    throw new ServiceError(409, "Workflow has no current draft version");
  }

  const existingDefinition = parseDefinition(currentVersionRow.definition_json);
  const nextDefinition = input.definition ?? existingDefinition;
  assertSafeDefinition(nextDefinition);

  const nextName =
    typeof input.name === "string"
      ? normalizeName(input.name)
      : currentWorkflow.name;

  if (!nextName || nextName.length > 120) {
    throw new ServiceError(400, "Workflow name must be 1 to 120 characters");
  }

  const nextDescription =
    typeof input.description === "undefined"
      ? currentWorkflow.description
      : input.description?.trim() || null;

  if (nextDescription && nextDescription.length > 2000) {
    throw new ServiceError(400, "Workflow description is too long");
  }

  const now = new Date().toISOString();
  const definitionJson = stableJson(nextDefinition);
  const definitionHash = createHash("sha256")
    .update(definitionJson)
    .digest("hex");

  return withTransaction(() => {
    const db = getDb();

    db.prepare(
      `UPDATE workflows
       SET name = ?, description = ?, updated_at = ?
       WHERE workflow_id = ? AND status = 'draft'`,
    ).run(nextName, nextDescription, now, workflowId);

    db.prepare(
      `UPDATE workflow_versions
       SET definition_json = ?, definition_hash = ?
       WHERE version_id = ? AND workflow_id = ?`,
    ).run(
      definitionJson,
      definitionHash,
      currentVersionRow.version_id,
      workflowId,
    );

    syncVersionRows(currentVersionRow.version_id, nextDefinition);

    const issues = validateWorkflow(nextDefinition, {
      project_id: currentWorkflow.project_id,
    });

    record({
      actor,
      project_id: currentWorkflow.project_id,
      action: "workflow.updated",
      target_table: "workflows",
      target_id: workflowId,
      old_value: {
        workflow: currentWorkflow,
        definition: existingDefinition,
      },
      new_value: {
        name: nextName,
        description: nextDescription,
        definition: nextDefinition,
        issues,
      },
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    const updated = workflowRow(workflowId);
    if (!updated) throw new ServiceError(500, "Workflow update failed");

    return { workflow: updated, issues };
  });
}

function defaultConfig(nodeType: NodeType): Record<string, unknown> {
  switch (nodeType) {
    case "trigger":
      return {
        event_type: "task.updated",
        subscription_id: "",
      };
    case "transform":
      return {
        mapping: {},
        on_error: "fail",
      };
    case "decision":
      return {
        branches: [],
        default_target_node_id: "",
      };
    case "action":
      return {
        connector_id: "",
        operation_id: "",
        parameters: {},
        scope: [],
        timeout_ms: 30000,
      };
    case "human_gate":
      return {
        reviewer_policy: [],
        expiry_seconds: 3600,
        escalation_policy: "notify_owner",
      };
    case "error_handler":
      return {
        handles: ["any"],
        recovery: "end",
        max_retries: 0,
      };
  }
}

function mutateDefinition<T>(
  actor: Actor,
  workflowId: string,
  mutation: (
    definition: WorkflowDefinition,
    workflow: WorkflowRow,
  ) => T,
): { result: T; issues: ValidationIssue[] } {
  const workflow = assertWorkflowAccess(actor, workflowId, "update");
  assertDraft(workflow);

  const version = currentVersion(workflow);
  if (!version) throw new ServiceError(409, "Workflow has no current version");

  return withTransaction(() => {
    const definition = parseDefinition(version.definition_json);
    const result = mutation(definition, workflow);

    assertSafeDefinition(definition);

    const definitionJson = stableJson(definition);
    const hash = createHash("sha256").update(definitionJson).digest("hex");
    const now = new Date().toISOString();

    getDb()
      .prepare(
        `UPDATE workflow_versions
         SET definition_json = ?, definition_hash = ?
         WHERE version_id = ?`,
      )
      .run(definitionJson, hash, version.version_id);

    getDb()
      .prepare("UPDATE workflows SET updated_at = ? WHERE workflow_id = ?")
      .run(now, workflowId);

    syncVersionRows(version.version_id, definition);

    const issues = validateWorkflow(definition, {
      project_id: workflow.project_id,
    });

    record({
      actor,
      project_id: workflow.project_id,
      action: "workflow.updated",
      target_table: "workflows",
      target_id: workflowId,
      old_value: version.definition_json,
      new_value: definition,
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    return { result, issues };
  });
}

export function createNode(
  actor: Actor,
  workflowId: string,
  input: NodeInput,
): { node: WorkflowNode; issues: ValidationIssue[] } {
  if (!NODE_TYPES.has(input.node_type)) {
    throw new ServiceError(400, "Unsupported node type", "INVALID_NODE_TYPE");
  }

  const { result, issues } = mutateDefinition(
    actor,
    workflowId,
    (definition) => {
      const nextName =
        normalizeName(input.name) ||
        `New ${input.node_type.replace("_", " ")} ${definition.nodes.length + 1}`;

      const node: WorkflowNode = {
        node_id: randomUUID(),
        node_type: input.node_type,
        name: nextName,
        purpose: input.purpose?.trim() ?? "",
        config: input.config ?? defaultConfig(input.node_type),
        position_x: Number.isFinite(input.position_x) ? input.position_x ?? 0 : 0,
        position_y: Number.isFinite(input.position_y) ? input.position_y ?? 0 : 0,
        ...(typeof input.input_schema !== "undefined"
          ? { input_schema: input.input_schema }
          : {}),
        ...(typeof input.output_schema !== "undefined"
          ? { output_schema: input.output_schema }
          : {}),
        ...(input.side_effect_class
          ? { side_effect_class: input.side_effect_class }
          : {}),
        ...(typeof input.idempotency !== "undefined"
          ? { idempotency: input.idempotency }
          : {}),
        ...(typeof input.credential_ref !== "undefined"
          ? { credential_ref: input.credential_ref }
          : {}),
        ...(typeof input.retry_policy !== "undefined"
          ? { retry_policy: input.retry_policy }
          : {}),
        ...(input.test_cases ? { test_cases: input.test_cases } : {}),
      };

      definition.nodes.push(node);
      return node;
    },
  );

  return { node: result, issues };
}

export function updateNode(
  actor: Actor,
  workflowId: string,
  nodeId: string,
  patch: Partial<NodeInput>,
): { node: WorkflowNode; issues: ValidationIssue[] } {
  const { result, issues } = mutateDefinition(
    actor,
    workflowId,
    (definition) => {
      const node = definition.nodes.find((entry) => entry.node_id === nodeId);
      if (!node) throw new ServiceError(404, "Workflow node not found");

      if (patch.node_type && patch.node_type !== node.node_type) {
        throw new ServiceError(400, "Node type cannot be changed after creation");
      }

      if (typeof patch.name === "string") node.name = patch.name;
      if (typeof patch.purpose === "string") node.purpose = patch.purpose;
      if (patch.config) node.config = patch.config;
      if (typeof patch.input_schema !== "undefined") node.input_schema = patch.input_schema;
      if (typeof patch.output_schema !== "undefined") node.output_schema = patch.output_schema;
      if (patch.side_effect_class) node.side_effect_class = patch.side_effect_class;
      if (typeof patch.idempotency !== "undefined") node.idempotency = patch.idempotency;
      if (typeof patch.credential_ref !== "undefined") node.credential_ref = patch.credential_ref;
      if (typeof patch.retry_policy !== "undefined") node.retry_policy = patch.retry_policy;
      if (patch.test_cases) node.test_cases = patch.test_cases;
      if (typeof patch.position_x === "number") node.position_x = patch.position_x;
      if (typeof patch.position_y === "number") node.position_y = patch.position_y;

      return node;
    },
  );

  return { node: result, issues };
}

export function deleteNode(
  actor: Actor,
  workflowId: string,
  nodeId: string,
): { deleted: true; issues: ValidationIssue[] } {
  const { issues } = mutateDefinition(actor, workflowId, (definition) => {
    const index = definition.nodes.findIndex((node) => node.node_id === nodeId);
    if (index < 0) throw new ServiceError(404, "Workflow node not found");

    definition.nodes.splice(index, 1);
    definition.edges = definition.edges.filter(
      (edge) =>
        edge.from_node_id !== nodeId && edge.to_node_id !== nodeId,
    );

    return true;
  });

  return { deleted: true, issues };
}

function edgeRejection(
  definition: WorkflowDefinition,
  fromNodeId: string,
  toNodeId: string,
): EdgeRejectionReason | null {
  if (fromNodeId === toNodeId) return "self_loop";

  const nodeIds = new Set(definition.nodes.map((node) => node.node_id));
  if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) {
    return "cross_project";
  }

  if (
    definition.edges.some(
      (edge) =>
        edge.from_node_id === fromNodeId &&
        edge.to_node_id === toNodeId,
    )
  ) {
    return "duplicate";
  }

  const candidate: WorkflowDefinition = {
    ...definition,
    edges: [
      ...definition.edges,
      {
        edge_id: "candidate-edge",
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
      },
    ],
  };

  if (graphHasCycle(candidate) && !allowedLoopGuard(candidate)) {
    return "cycle";
  }

  return null;
}

export function createEdge(
  actor: Actor,
  workflowId: string,
  fromNodeId: string,
  toNodeId: string,
  branchLabel?: string,
  conditionExpr?: string,
): { edge: WorkflowEdge; issues: ValidationIssue[] } {
  const { result, issues } = mutateDefinition(
    actor,
    workflowId,
    (definition) => {
      const reason = edgeRejection(definition, fromNodeId, toNodeId);
      if (reason) {
        throw new ServiceError(
          400,
          `Edge rejected: ${reason}`,
          "EDGE_REJECTED",
          { reason },
        );
      }

      const edge: WorkflowEdge = {
        edge_id: randomUUID(),
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        branch_label: branchLabel ?? null,
        condition_expr: conditionExpr ?? null,
      };

      definition.edges.push(edge);
      return edge;
    },
  );

  return { edge: result, issues };
}

export function deleteEdge(
  actor: Actor,
  workflowId: string,
  edgeId: string,
): { deleted: true; issues: ValidationIssue[] } {
  const { issues } = mutateDefinition(actor, workflowId, (definition) => {
    const index = definition.edges.findIndex((edge) => edge.edge_id === edgeId);
    if (index < 0) throw new ServiceError(404, "Workflow edge not found");
    definition.edges.splice(index, 1);
    return true;
  });

  return { deleted: true, issues };
}

export function deleteWorkflow(
  actor: Actor,
  workflowId: string,
): { workflow_id: string; status: "archived" } {
  const workflow = assertWorkflowAccess(actor, workflowId, "delete");

  if (!authorize(actor, workflow.project_id, "workflow", "delete")) {
    throw new ServiceError(404, "Workflow not found");
  }

  if (workflow.status === "archived") {
    return { workflow_id: workflowId, status: "archived" };
  }

  return withTransaction(() => {
    const now = new Date().toISOString();

    getDb()
      .prepare(
        `UPDATE workflows
         SET status = 'archived', updated_at = ?
         WHERE workflow_id = ?`,
      )
      .run(now, workflowId);

    record({
      actor,
      project_id: workflow.project_id,
      action: "workflow.archived",
      target_table: "workflows",
      target_id: workflowId,
      old_value: workflow,
      new_value: { ...workflow, status: "archived", updated_at: now },
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    return { workflow_id: workflowId, status: "archived" };
  });
}

export function publishWorkflow(
  actor: Actor,
  workflowId: string,
): { workflow_id: string; status: "published" } {
  const workflow = assertWorkflowAccess(actor, workflowId, "update");

  if (!authorize(actor, workflow.project_id, "workflow", "update")) {
    throw new ServiceError(404, "Workflow not found");
  }

  if (workflow.status !== "draft") {
    throw new ServiceError(
      409,
      "Only draft workflows can be published",
      "WORKFLOW_NOT_DRAFT",
    );
  }

  if (!workflow.current_version_id) {
    throw new ServiceError(
      409,
      "The workflow has no current version to publish",
      "WORKFLOW_VERSION_REQUIRED",
    );
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const idempotencyKey = `pm-p7-06:publish:${workflowId}:${workflow.current_version_id}`;

  const input: RequestApprovalInput = {
    workflow_id: workflowId,
    version_id: workflow.current_version_id,
    approval_type: "publish",
    idempotency_key: idempotencyKey,
    expires_at: expiresAt,
    decision_note: null,
  };

  // requestApproval throws 423 RUNTIME_DISABLED in preview-only mode before
  // any status change occurs. If a future runtime boundary grants publish
  // approvals, this is where the workflow would transition to 'published'.
  const approval = requestApproval(input, actor);

  return withTransaction(() => {
    getDb()
      .prepare(
        `UPDATE workflows
         SET status = 'published', updated_at = ?
         WHERE workflow_id = ?`,
      )
      .run(now, workflowId);

    getDb()
      .prepare(
        `UPDATE workflow_versions
         SET published_at = ?
         WHERE version_id = ?`,
      )
      .run(now, workflow.current_version_id);

    record({
      actor,
      project_id: workflow.project_id,
      action: "workflow.published",
      target_table: "workflows",
      target_id: workflowId,
      old_value: { ...workflow, status: "draft" },
      new_value: { ...workflow, status: "published", updated_at: now },
      trigger: actor.actor_type === "agent" ? "agent" : "api",
      trace_id: undefined as string | undefined,
    });

    return { workflow_id: workflowId, status: "published" };
  });
}

