
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";
import { ServiceError } from "./actor.service.ts";
import { record } from "./audit.service.ts";
import { authorize } from "./projectAccess.service.ts";
import {
  parseDefinition,
  stableJson,
  syncVersionRows,
  type WorkflowDefinition,
  type WorkflowRow,
  type WorkflowVersionRow,
} from "./workflow.service.ts";

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

function getWorkflow(workflowId: string): WorkflowRow | undefined {
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

function getVersionRow(versionId: string): WorkflowVersionRow | undefined {
  return getDb()
    .prepare(
      `SELECT version_id, workflow_id, version_number, definition_json,
              definition_hash, schema_version, is_reviewed, review_note,
              created_by, created_at, published_at
       FROM workflow_versions
       WHERE version_id = ?`,
    )
    .get(versionId) as WorkflowVersionRow | undefined;
}

function assertVersionAccess(
  actor: Actor,
  workflow: WorkflowRow,
  action: "read" | "create",
): void {
  if (!authorize(actor, workflow.project_id, "workflow_version", action)) {
    throw new ServiceError(404, "Workflow version not found");
  }
}

function cloneDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  const nodeIds = new Map<string, string>();

  const nodes = definition.nodes.map((node) => {
    const nextId = randomUUID();
    nodeIds.set(node.node_id, nextId);
    return {
      ...node,
      node_id: nextId,
      config: structuredClone(node.config),
    };
  });

  const edges = definition.edges.map((edge) => ({
    ...edge,
    edge_id: randomUUID(),
    from_node_id: nodeIds.get(edge.from_node_id) ?? "",
    to_node_id: nodeIds.get(edge.to_node_id) ?? "",
  }));

  return {
    nodes,
    edges,
    ...(definition.loop_guard
      ? { loop_guard: { ...definition.loop_guard } }
      : {}),
  };
}

function createImmutableVersion(
  actor: Actor,
  workflow: WorkflowRow,
  definition: WorkflowDefinition,
): WorkflowVersionRow {
  const db = getDb();
  const maximum = db
    .prepare(
      "SELECT MAX(version_number) AS maximum FROM workflow_versions WHERE workflow_id = ?",
    )
    .get(workflow.workflow_id) as { maximum: number | null };

  const versionNumber = (maximum.maximum ?? 0) + 1;
  const versionId = randomUUID();
  const now = new Date().toISOString();
  const definitionJson = stableJson(definition);
  const hash = createHash("sha256").update(definitionJson).digest("hex");

  db.prepare(
    `INSERT INTO workflow_versions (
      version_id, workflow_id, version_number, definition_json,
      definition_hash, schema_version, is_reviewed, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
  ).run(
    versionId,
    workflow.workflow_id,
    versionNumber,
    definitionJson,
    hash,
    actor.actor_id,
    now,
  );

  syncVersionRows(versionId, definition);

  db.prepare(
    `UPDATE workflows
     SET current_version_id = ?, updated_at = ?
     WHERE workflow_id = ?`,
  ).run(versionId, now, workflow.workflow_id);

  const created = getVersionRow(versionId);
  if (!created) throw new ServiceError(500, "Workflow version creation failed");

  record({
    actor,
    project_id: workflow.project_id,
    action: "version.created",
    target_table: "workflow_versions",
    target_id: versionId,
    target_sub_id: String(versionNumber),
    new_value: created,
    trigger: actor.actor_type === "agent" ? "agent" : "api",
  });

  return created;
}

export function createVersion(
  actor: Actor,
  workflowId: string,
): WorkflowVersionRow {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new ServiceError(404, "Workflow not found");
  assertVersionAccess(actor, workflow, "create");

  if (workflow.status !== "draft") {
    throw new ServiceError(409, "Only draft workflows can be versioned");
  }

  if (!workflow.current_version_id) {
    throw new ServiceError(409, "Workflow has no current draft version");
  }

  return withTransaction(() => {
    const current = getVersionRow(workflow.current_version_id as string);
    if (!current) throw new ServiceError(409, "Current workflow version not found");

    const definition = cloneDefinition(parseDefinition(current.definition_json));
    return createImmutableVersion(actor, workflow, definition);
  });
}

export function getVersion(
  actor: Actor,
  versionId: string,
): WorkflowVersionRow {
  const version = getVersionRow(versionId);
  if (!version) throw new ServiceError(404, "Workflow version not found");

  const workflow = getWorkflow(version.workflow_id);
  if (!workflow) throw new ServiceError(404, "Workflow version not found");
  assertVersionAccess(actor, workflow, "read");

  return version;
}

export function listVersions(
  actor: Actor,
  workflowId: string,
): WorkflowVersionRow[] {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new ServiceError(404, "Workflow not found");
  assertVersionAccess(actor, workflow, "read");

  return getDb()
    .prepare(
      `SELECT version_id, workflow_id, version_number, definition_json,
              definition_hash, schema_version, is_reviewed, review_note,
              created_by, created_at, published_at
       FROM workflow_versions
       WHERE workflow_id = ?
       ORDER BY version_number DESC`,
    )
    .all(workflowId) as unknown as WorkflowVersionRow[];
}

/**
 * Rollback creates a new immutable version from the selected historical
 * definition. It never mutates or deletes the historical snapshot.
 */
export function rollbackToVersion(
  actor: Actor,
  workflowId: string,
  versionId: string,
): WorkflowVersionRow {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new ServiceError(404, "Workflow not found");
  assertVersionAccess(actor, workflow, "create");

  if (workflow.status !== "draft") {
    throw new ServiceError(409, "Only draft workflows can be restored");
  }

  const source = getVersionRow(versionId);
  if (!source || source.workflow_id !== workflowId) {
    throw new ServiceError(404, "Workflow version not found");
  }

  return withTransaction(() => {
    const definition = cloneDefinition(parseDefinition(source.definition_json));

    const restored = createImmutableVersion(actor, workflow, definition);

    record({
      actor,
      project_id: workflow.project_id,
      action: "workflow.updated",
      target_table: "workflows",
      target_id: workflowId,
      old_value: { current_version_id: workflow.current_version_id },
      new_value: {
        current_version_id: restored.version_id,
        restored_from_version_id: versionId,
      },
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    return restored;
  });
}
