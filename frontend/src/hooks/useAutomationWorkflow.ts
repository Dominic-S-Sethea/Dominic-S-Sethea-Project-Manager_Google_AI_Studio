import { useCallback } from "react";
import { validateNode, ValidationIssue } from "../lib/automationValidation";

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

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export const useAutomationWorkflow = () => {
  const validateCurrentNode = useCallback(
    (nodeInput: NodeInput, projectId?: string): ValidationIssue[] => {
      return validateNode(nodeInput, projectId);
    },
    [],
  );

  return {
    validateCurrentNode,
  };
};
