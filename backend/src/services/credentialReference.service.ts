
import { randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";
import { ServiceError } from "./actor.service.ts";
import { record } from "./audit.service.ts";
import { authorize } from "./projectAccess.service.ts";
import { hasSecretValuePattern } from "./redaction.service.ts";

interface CredentialReferenceRow {
  credential_reference_id: string;
  project_id: string;
  connector_id: string | null;
  environment_id: string | null;
  provider_scopes: string;
  created_by: string;
  created_at: string;
  rotated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_verified_at: string | null;
}

interface ConnectorScopeRow {
  connector_id: string;
  project_id: string | null;
  environment_id: string | null;
  allowed_actions: string;
}

interface EnvironmentScopeRow {
  environment_id: string;
  project_id: string;
  mode: string;
}

export interface CredentialMetadata {
  configured: boolean;
  status: "active" | "revoked" | "expired";
  scopes: string[];
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}

export interface CreateCredentialReferenceInput {
  project_id: string;
  connector_id: string;
  environment_id: string;
  reference: string;
  scopes: string[];
  expires_at?: string | null;
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

function parseScopes(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.length > 0,
    );
  } catch {
    return [];
  }
}

function validateScopes(scopes: unknown): string[] {
  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    scopes.some(
      (scope) =>
        typeof scope !== "string" ||
        scope.trim().length === 0 ||
        scope.includes("*") ||
        scope.length > 120,
    )
  ) {
    throw new ServiceError(
      400,
      "At least one explicit, non-wildcard provider scope is required",
      "INVALID_SCOPES",
    );
  }

  return [...new Set(scopes.map((scope) => (scope as string).trim()))];
}

function rowMetadata(row: CredentialReferenceRow): CredentialMetadata {
  const now = Date.now();
  const expired =
    row.expires_at !== null &&
    Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) <= now;

  const status = row.revoked_at
    ? "revoked"
    : expired
      ? "expired"
      : "active";

  return {
    configured: status === "active",
    status,
    scopes: parseScopes(row.provider_scopes),
    created_at: row.created_at,
    updated_at: row.rotated_at ?? row.created_at,
    last_verified_at: row.last_verified_at,
  };
}

function requireOwner(actor: Actor, projectId: string): void {
  if (!authorize(actor, projectId, "credential_reference", "create")) {
    throw new ServiceError(
      403,
      "Credential references can only be managed by a project owner",
      "FORBIDDEN",
    );
  }
}

function getReferenceByConnector(
  connectorId: string,
): CredentialReferenceRow | undefined {
  return getDb()
    .prepare(
      `SELECT credential_reference_id, project_id, connector_id, environment_id,
              provider_scopes, created_by, created_at, rotated_at, expires_at,
              revoked_at, last_verified_at
       FROM credential_references
       WHERE connector_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(connectorId) as CredentialReferenceRow | undefined;
}

function requireConnectorAndEnvironment(
  projectId: string,
  connectorId: string,
  environmentId: string,
): void {
  const db = getDb();

  const connector = db
    .prepare(
      `SELECT connector_id, project_id, environment_id, allowed_actions
       FROM connectors
       WHERE connector_id = ?`,
    )
    .get(connectorId) as ConnectorScopeRow | undefined;

  if (
    !connector ||
    connector.project_id !== projectId ||
    connector.environment_id !== environmentId
  ) {
    throw new ServiceError(
      404,
      "Connector not found in this project and environment",
      "CONNECTOR_NOT_FOUND",
    );
  }

  const environment = db
    .prepare(
      `SELECT environment_id, project_id, mode
       FROM environments
       WHERE environment_id = ?`,
    )
    .get(environmentId) as EnvironmentScopeRow | undefined;

  if (
    !environment ||
    environment.project_id !== projectId ||
    environment.mode === "live"
  ) {
    throw new ServiceError(
      400,
      "Credential references require a project-scoped preview or test environment",
      "INVALID_ENVIRONMENT",
    );
  }
}

/**
 * Creates a server-side pointer to a secret-store entry. The pointer is
 * persisted only in credential_references.reference and is never returned.
 */
export function createCredentialReference(
  input: CreateCredentialReferenceInput,
  actor: Actor,
): CredentialMetadata {
  if (
    typeof input.project_id !== "string" ||
    typeof input.connector_id !== "string" ||
    typeof input.environment_id !== "string" ||
    typeof input.reference !== "string" ||
    input.reference.trim().length === 0
  ) {
    throw new ServiceError(400, "Invalid credential-reference input", "INVALID_INPUT");
  }

  if (hasSecretValuePattern(input.reference)) {
    throw new ServiceError(
      400,
      "A raw credential is not accepted; provide a secret-store reference",
      "RAW_SECRET_REJECTED",
    );
  }

  requireOwner(actor, input.project_id);
  requireConnectorAndEnvironment(
    input.project_id,
    input.connector_id,
    input.environment_id,
  );

  const scopes = validateScopes(input.scopes);
  const now = new Date().toISOString();
  const id = randomUUID();

  return withTransaction(() => {
    const db = getDb();
    const existing = getReferenceByConnector(input.connector_id);

    if (existing && !existing.revoked_at) {
      throw new ServiceError(
        409,
        "A credential reference is already configured for this connector",
        "CREDENTIAL_ALREADY_CONFIGURED",
      );
    }

    db.prepare(
      `INSERT INTO credential_references (
        credential_reference_id, project_id, connector_id, environment_id,
        reference, provider_scopes, created_by, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.project_id,
      input.connector_id,
      input.environment_id,
      input.reference.trim(),
      JSON.stringify(scopes),
      actor.actor_id,
      now,
      input.expires_at ?? null,
    );

    db.prepare(
      `UPDATE connectors
       SET credential_reference_id = ?, updated_at = ?
       WHERE connector_id = ? AND project_id = ?`,
    ).run(id, now, input.connector_id, input.project_id);

    const snapshot = {
      credential_reference_id: id,
      project_id: input.project_id,
      connector_id: input.connector_id,
      environment_id: input.environment_id,
      reference: input.reference,
      scopes,
      created_at: now,
    };

    record({
      actor,
      project_id: input.project_id,
      action: "credential_reference.created",
      target_table: "credential_references",
      target_id: id,
      new_value: snapshot,
      trigger: "api",
    });

    const created = db
      .prepare(
        `SELECT credential_reference_id, project_id, connector_id,
                environment_id, provider_scopes, created_by, created_at,
                rotated_at, expires_at, revoked_at, last_verified_at
         FROM credential_references
         WHERE credential_reference_id = ?`,
      )
      .get(id) as CredentialReferenceRow | undefined;

    if (!created) {
      throw new ServiceError(500, "Credential reference was not persisted");
    }

    return rowMetadata(created);
  });
}

export function getCredentialMetadataByConnector(
  connectorId: string,
  actor: Actor,
): CredentialMetadata {
  const row = getReferenceByConnector(connectorId);
  if (!row) throw new ServiceError(404, "Credential reference not found");

  if (!authorize(actor, row.project_id, "credential_reference", "read")) {
    throw new ServiceError(404, "Credential reference not found");
  }

  return rowMetadata(row);
}

export function listCredentialMetadata(
  projectId: string,
  actor: Actor,
): CredentialMetadata[] {
  if (!authorize(actor, projectId, "credential_reference", "read")) {
    throw new ServiceError(404, "Credential references not found");
  }

  const rows = getDb()
    .prepare(
      `SELECT credential_reference_id, project_id, connector_id, environment_id,
              provider_scopes, created_by, created_at, rotated_at, expires_at,
              revoked_at, last_verified_at
       FROM credential_references
       WHERE project_id = ?
       ORDER BY created_at DESC`,
    )
    .all(projectId) as unknown as CredentialReferenceRow[];

  return rows.map(rowMetadata);
}

/**
 * Rotation is addressed by connector_id so the write-only API does not need
 * to return the credential_reference_id or the stored reference pointer.
 */
export function rotateCredentialReference(
  connectorId: string,
  reference: string,
  scopes: string[] | undefined,
  actor: Actor,
): CredentialMetadata {
  if (
    typeof reference !== "string" ||
    reference.trim().length === 0 ||
    hasSecretValuePattern(reference)
  ) {
    throw new ServiceError(
      400,
      "A secret-store reference is required; raw credentials are rejected",
      "INVALID_REFERENCE",
    );
  }

  const row = getReferenceByConnector(connectorId);
  if (!row) throw new ServiceError(404, "Credential reference not found");
  requireOwner(actor, row.project_id);

  const nextScopes =
    typeof scopes === "undefined"
      ? parseScopes(row.provider_scopes)
      : validateScopes(scopes);

  return withTransaction(() => {
    const now = new Date().toISOString();

    getDb()
      .prepare(
        `UPDATE credential_references
         SET reference = ?, provider_scopes = ?, rotated_at = ?, revoked_at = NULL
         WHERE credential_reference_id = ?`,
      )
      .run(
        reference.trim(),
        JSON.stringify(nextScopes),
        now,
        row.credential_reference_id,
      );

    record({
      actor,
      project_id: row.project_id,
      action: "credential_reference.rotated",
      target_table: "credential_references",
      target_id: row.credential_reference_id,
      old_value: {
        ...row,
        reference: "[REDACTED]",
      },
      new_value: {
        credential_reference_id: row.credential_reference_id,
        reference,
        provider_scopes: nextScopes,
        rotated_at: now,
      },
      trigger: "api",
    });

    const updated = getDb()
      .prepare(
        `SELECT credential_reference_id, project_id, connector_id,
                environment_id, provider_scopes, created_by, created_at,
                rotated_at, expires_at, revoked_at, last_verified_at
         FROM credential_references
         WHERE credential_reference_id = ?`,
      )
      .get(row.credential_reference_id) as CredentialReferenceRow | undefined;

    if (!updated) throw new ServiceError(500, "Credential reference update failed");
    return rowMetadata(updated);
  });
}

export function revokeCredentialReference(
  connectorId: string,
  actor: Actor,
): CredentialMetadata {
  const row = getReferenceByConnector(connectorId);
  if (!row) throw new ServiceError(404, "Credential reference not found");
  requireOwner(actor, row.project_id);

  return withTransaction(() => {
    const now = new Date().toISOString();

    getDb()
      .prepare(
        `UPDATE credential_references
         SET revoked_at = ?
         WHERE credential_reference_id = ? AND revoked_at IS NULL`,
      )
      .run(now, row.credential_reference_id);

    record({
      actor,
      project_id: row.project_id,
      action: "credential_reference.revoked",
      target_table: "credential_references",
      target_id: row.credential_reference_id,
      old_value: row,
      new_value: {
        credential_reference_id: row.credential_reference_id,
        revoked_at: now,
      },
      trigger: "api",
    });

    const updated = getDb()
      .prepare(
        `SELECT credential_reference_id, project_id, connector_id,
                environment_id, provider_scopes, created_by, created_at,
                rotated_at, expires_at, revoked_at, last_verified_at
         FROM credential_references
         WHERE credential_reference_id = ?`,
      )
      .get(row.credential_reference_id) as CredentialReferenceRow | undefined;

    if (!updated) throw new ServiceError(500, "Credential reference update failed");
    return rowMetadata(updated);
  });
}

export function credentialReferenceHasScopes(
  credentialReferenceId: string,
  projectId: string,
  environmentId: string,
  requiredScopes: string[],
): boolean {
  const row = getDb()
    .prepare(
      `SELECT project_id, environment_id, provider_scopes, expires_at, revoked_at
       FROM credential_references
       WHERE credential_reference_id = ?`,
    )
    .get(credentialReferenceId) as
    | {
        project_id: string;
        environment_id: string | null;
        provider_scopes: string;
        expires_at: string | null;
        revoked_at: string | null;
      }
    | undefined;

  if (
    !row ||
    row.project_id !== projectId ||
    row.environment_id !== environmentId ||
    row.revoked_at !== null
  ) {
    return false;
  }

  if (
    row.expires_at &&
    Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) <= Date.now()
  ) {
    return false;
  }

  const available = new Set(parseScopes(row.provider_scopes));
  return requiredScopes.every((scope) => available.has(scope));
}
