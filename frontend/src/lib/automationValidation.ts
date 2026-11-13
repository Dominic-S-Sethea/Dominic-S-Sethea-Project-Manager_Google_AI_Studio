const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const SUPPORTED_EVENTS = new Set([
  "task.updated",
  "task.created",
  "task.deleted",
]);

export const hasUnsafeExpression = (cond: string): boolean => {
  const unsafe = /(?:require|spawn|exec|system|shell|child_process|fork|spawnSync)/i;
  return unsafe.test(cond);
};

export interface ValidationIssue {
  rule: string;
  severity: "error" | "warning";
  message: string;
  node_id?: string;
  field?: string;
}

export interface NodeInput {
  node_type: string;
  name?: string;
  purpose?: string;
  config?: Record<string, unknown>;
  input_schema?: unknown;
  output_schema?: unknown;
  side_effect_class?: string;
  idempotency?: unknown;
  credential_ref?: string | null;
  retry_policy?: unknown;
  test_cases?: unknown[];
  position_x?: number;
  position_y?: number;
}

export const validateNode = (
  node: NodeInput,
  _projectId?: string,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const { node_type, name, purpose, config } = node;

  const NODE_TYPES = new Set([
    "trigger", "transform", "decision", "action", "human_gate", "error_handler",
  ]);
  if (!NODE_TYPES.has(node_type)) {
    issues.push({
      rule: "V-01",
      severity: "error",
      message: "Node type is not in the approved catalog",
      node_id: node_type,
    });
  }

  if (!name || !purpose) {
    issues.push({
      rule: "V-02",
      severity: "error",
      message: "Node name and purpose are required",
    });
  }

  if (!isRecord(config)) {
    issues.push({
      rule: "V-03",
      severity: "error",
      message: "Node configuration must be an object",
    });
  }

  if (node_type === "trigger") {
    const { event_type, subscription_id } = (config as any) || {};
    if (event_type && !SUPPORTED_EVENTS.has(event_type)) {
      issues.push({
        rule: "V-06",
        severity: "error",
        message: "Trigger event type is not supported",
      });
    }
    if (!subscription_id || subscription_id.trim().length === 0) {
      issues.push({
        rule: "V-03",
        severity: "error",
        message: "Trigger subscription_id is required",
      });
    }
  }

  if (node_type === "decision") {
    const branches = Array.isArray(config?.branches) ? config.branches : [];
    if (branches.length < 2) {
      issues.push({
        rule: "V-07",
        severity: "error",
        message: "Decision nodes need at least two labeled outgoing edges",
      });
    }
    if (typeof config?.default_target_node_id !== "string") {
      issues.push({
        rule: "V-08",
        severity: "error",
        message: "Decision nodes require an existing default branch target",
      });
    }
    for (const branch of branches) {
      if (typeof branch?.condition !== "string" || hasUnsafeExpression(branch.condition)) {
        issues.push({
          rule: "V-09",
          severity: "error",
          message: "Decision conditions must be deterministic, bounded expressions",
        });
        break;
      }
    }
  }

  if (node_type === "action") {
    const { connector_id, operation_id } = (config as any) || {};
    if (!connector_id || !operation_id) {
      issues.push({
        rule: "V-10",
        severity: "error",
        message: "Action connector operation is not approved for this project",
      });
    }
  }

  return issues;
};
