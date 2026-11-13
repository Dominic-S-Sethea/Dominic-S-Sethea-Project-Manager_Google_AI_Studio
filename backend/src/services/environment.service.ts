
import { randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";
import { ServiceError } from "./actor.service.ts";
import { record } from "./audit.service.ts";
import { authorize,
  isProjectMember } from "./projectAccess.service.ts";

export type EnvironmentMode = "preview" | "test" | "live";

export interface Environment {
  environment_id: string;
  project_id: string;
  name: string;
  mode: EnvironmentMode;
  is_live: number;
  created_by: string;
  created_at: string;
}

export interface CreateEnvironmentInput {
  project_id: string;
  name: string;
  mode: EnvironmentMode;
}

export interface UpdateEnvironmentInput {
  name?: string;
  mode?: EnvironmentMode;
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

function requireWrite(actor: Actor, projectId: string): void {
  if (!authorize(actor, projectId, "environment", "create")) {
    throw new ServiceError(404, "Environment project not found");
  }
}

function getEnvironmentRow(id: string): Environment | undefined {
  return getDb()
    .prepare(
      `SELECT environment_id, project_id, name, mode, is_live,
              created_by, created_at
       FROM environments
       WHERE environment_id = ?`,
    )
    .get(id) as Environment | undefined;
}

function assertEnvironmentAccess(
  actor: Actor,
  environmentId: string,
  action: "read" | "update" | "delete",
): Environment {
  const row = getEnvironmentRow(environmentId);
  if (!row) throw new ServiceError(404, "Environment not found");

  if (!authorize(actor, row.project_id, "environment", action)) {
    throw new ServiceError(404, "Environment not found");
  }

  return row;
}

function validateMode(mode: EnvironmentMode): void {
  if (mode === "live") {
    throw new ServiceError(
      423,
      "Live environments are disabled by the preview-only boundary",
      "RUNTIME_DISABLED",
    );
  }

  if (mode !== "preview" && mode !== "test") {
    throw new ServiceError(400, "Environment mode must be preview or test");
  }
}

export function createEnvironment(
  input: CreateEnvironmentInput,
  actor: Actor,
): Environment {
  const name = input.name.trim();

  if (!input.project_id || !name || name.length > 120) {
    throw new ServiceError(400, "Project and environment name are required");
  }

  validateMode(input.mode);
  requireWrite(actor, input.project_id);

  const id = randomUUID();
  const now = new Date().toISOString();

  return withTransaction(() => {
    getDb()
      .prepare(
        `INSERT INTO environments (
          environment_id, project_id, name, mode, is_live, created_by, created_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        input.project_id,
        name,
        input.mode,
        actor.actor_id,
        now,
      );

    const created = getEnvironmentRow(id);
    if (!created) throw new ServiceError(500, "Environment creation failed");

    record({
      actor,
      project_id: input.project_id,
      action: "workflow.created",
      target_table: "environments",
      target_id: id,
      new_value: created,
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    return created;
  });
}

export function getEnvironment(
  environmentId: string,
  actor: Actor,
): Environment {
  return assertEnvironmentAccess(actor, environmentId, "read");
}

export function listEnvironments(
  projectId: string,
  actor: Actor,
): Environment[] {
  if (!authorize(actor, projectId, "environment", "read")) {
    // No relationship to the project: answer with an empty listing rather
    // than disclosing whether the project exists.
    if (!isProjectMember(actor, projectId)) return [];

    throw new ServiceError(404, "Environments not found");
  }

  return getDb()
    .prepare(
      `SELECT environment_id, project_id, name, mode, is_live,
              created_by, created_at
       FROM environments
       WHERE project_id = ?
       ORDER BY created_at DESC`,
    )
    .all(projectId) as unknown as Environment[];
}

export function updateEnvironment(
  environmentId: string,
  input: UpdateEnvironmentInput,
  actor: Actor,
): Environment {
  const current = assertEnvironmentAccess(actor, environmentId, "update");
  if (!authorize(actor, current.project_id, "environment", "update")) {
    throw new ServiceError(404, "Environment not found");
  }

  if (typeof input.mode !== "undefined") validateMode(input.mode);

  const name =
    typeof input.name === "string" ? input.name.trim() : current.name;

  if (!name || name.length > 120) {
    throw new ServiceError(400, "Environment name must be 1 to 120 characters");
  }

  const mode = input.mode ?? current.mode;

  return withTransaction(() => {
    getDb()
      .prepare(
        `UPDATE environments
         SET name = ?, mode = ?
         WHERE environment_id = ?`,
      )
      .run(name, mode, environmentId);

    const updated = getEnvironmentRow(environmentId);
    if (!updated) throw new ServiceError(500, "Environment update failed");

    record({
      actor,
      project_id: current.project_id,
      action: "workflow.updated",
      target_table: "environments",
      target_id: environmentId,
      old_value: current,
      new_value: updated,
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    return updated;
  });
}

export function deleteEnvironment(
  environmentId: string,
  actor: Actor,
): { environment_id: string; deleted: true } {
  const current = assertEnvironmentAccess(actor, environmentId, "delete");
  if (!authorize(actor, current.project_id, "environment", "delete")) {
    throw new ServiceError(404, "Environment not found");
  }

  return withTransaction(() => {
    const db = getDb();

    const credentialCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM credential_references WHERE environment_id = ?",
      )
      .get(environmentId) as { count: number };

    const executionCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM executions WHERE environment_id = ?",
      )
      .get(environmentId) as { count: number };

    if (credentialCount.count > 0 || executionCount.count > 0) {
      throw new ServiceError(
        409,
        "Environment is still referenced and cannot be deleted",
        "ENVIRONMENT_IN_USE",
      );
    }

    db.prepare("DELETE FROM environments WHERE environment_id = ?")
      .run(environmentId);

    record({
      actor,
      project_id: current.project_id,
      action: "workflow.updated",
      target_table: "environments",
      target_id: environmentId,
      old_value: current,
      new_value: null,
      trigger: actor.actor_type === "agent" ? "agent" : "api",
    });

    return { environment_id: environmentId, deleted: true };
  });
}
