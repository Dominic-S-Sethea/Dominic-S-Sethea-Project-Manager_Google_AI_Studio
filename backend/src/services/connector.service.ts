
import { randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";
import { ServiceError } from "./actor.service.ts";
import { record } from "./audit.service.ts";
import { authorize,
  isProjectMember } from "./projectAccess.service.ts";
import {
  isSecretConfigKey,
  redact,
} from "./redaction.service.ts";

export interface ConnectorDefinition {
  id: string;
  name: string;
  provider: string;
  type: "oauth" | "api_key" | "webhook" | "token";
  description: string;
  icon: string;
  configFields: {
    key: string;
    label: string;
    type: "text" | "password" | "url";
    required: boolean;
    placeholder?: string;
  }[];
  actions: {
    id: string;
    label: string;
    description: string;
  }[];
}

export interface ConnectorInstance {
  connector_id: string;
  project_id: string;
  environment_id: string;
  name: string;
  type: string;
  provider: string;
  status: "connected" | "disconnected" | "error" | "pending";
  allowed_actions: string[];
  credential_configured: boolean;
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ConnectorRow {
  connector_id: string;
  project_id: string | null;
  environment_id: string | null;
  credential_reference_id: string | null;
  allowed_actions: string;
  name: string;
  type: string;
  provider: string;
  status: ConnectorInstance["status"];
  config: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const AVAILABLE_CONNECTORS: ConnectorDefinition[] = [
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    type: "token",
    description: "Connect to GitHub repositories, issues, and pull requests",
    icon: "github",
    configFields: [
      {
        key: "access_token",
        label: "Personal Access Token",
        type: "password",
        required: true,
        placeholder: "Use a write-only credential reference",
      },
      {
        key: "repo_owner",
        label: "Repository Owner",
        type: "text",
        required: false,
      },
      {
        key: "repo_name",
        label: "Repository Name",
        type: "text",
        required: false,
      },
    ],
    actions: [
      { id: "list_repos", label: "List Repositories", description: "List accessible repositories" },
      { id: "create_issue", label: "Create Issue", description: "Create an issue" },
      { id: "list_issues", label: "List Issues", description: "List repository issues" },
      { id: "link_commit", label: "Link Commit", description: "Link a commit to a task" },
    ],
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    provider: "hermes",
    type: "api_key",
    description: "Connect to Hermes Agent for AI-powered assistance",
    icon: "hermes",
    configFields: [
      {
        key: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "Use a write-only credential reference",
      },
      {
        key: "base_url",
        label: "Base URL",
        type: "url",
        required: false,
      },
      {
        key: "model",
        label: "Default Model",
        type: "text",
        required: false,
      },
    ],
    actions: [
      { id: "test_connection", label: "Test Connection", description: "Verify a connection in a future provider-enabled card" },
      { id: "send_message", label: "Send Message", description: "Send a message in a future provider-enabled card" },
      { id: "list_models", label: "List Models", description: "List models in a future provider-enabled card" },
    ],
  },
];

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

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseActions(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function safeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const value = redact(config);

  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRow(connectorId: string): ConnectorRow | undefined {
  return getDb()
    .prepare(
      `SELECT connector_id, project_id, environment_id,
              credential_reference_id, allowed_actions, name, type,
              provider, status, config, created_by, created_at, updated_at
       FROM connectors
       WHERE connector_id = ?`,
    )
    .get(connectorId) as ConnectorRow | undefined;
}

function toSafeInstance(row: ConnectorRow): ConnectorInstance {
  if (!row.project_id || !row.environment_id) {
    throw new ServiceError(404, "Connector not found");
  }

  return {
    connector_id: row.connector_id,
    project_id: row.project_id,
    environment_id: row.environment_id,
    name: row.name,
    type: row.type,
    provider: row.provider,
    status: row.status,
    allowed_actions: parseActions(row.allowed_actions),
    credential_configured: row.credential_reference_id !== null,
    config: safeConfig(parseConfig(row.config)),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function assertMappedRow(row: ConnectorRow | undefined): ConnectorRow {
  if (
    !row ||
    !row.project_id ||
    !row.environment_id
  ) {
    // Legacy connectors with NULL project scope remain quarantined.
    throw new ServiceError(404, "Connector not found");
  }

  return row;
}

function assertConnectorAccess(
  row: ConnectorRow,
  actor: Actor,
  action: "read" | "create" | "update" | "delete" | "test",
): void {
  if (!row.project_id || !authorize(actor, row.project_id, "connector", action)) {
    throw new ServiceError(404, "Connector not found");
  }
}

function validateSafeConfig(
  provider: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const definition = AVAILABLE_CONNECTORS.find(
    (entry) => entry.provider === provider,
  );

  if (!definition) {
    throw new ServiceError(400, "Unknown connector provider", "UNKNOWN_PROVIDER");
  }

  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const field = definition.configFields.find((entry) => entry.key === key);

    if (!field) {
      throw new ServiceError(400, `Unsupported connector setting: ${key}`);
    }

    if (field.type === "password" || isSecretConfigKey(key)) {
      throw new ServiceError(
        400,
        "Raw connector credentials are not accepted; configure a write-only credential reference",
        "RAW_SECRET_REJECTED",
      );
    }

    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      value !== null
    ) {
      throw new ServiceError(400, `Invalid value for connector setting: ${key}`);
    }

    if (typeof value === "string" && value.length > 2000) {
      throw new ServiceError(400, `Connector setting is too long: ${key}`);
    }

    safe[key] = value;
  }

  return safe;
}

function validateAllowedActions(
  provider: string,
  actions: string[],
): string[] {
  const definition = AVAILABLE_CONNECTORS.find(
    (entry) => entry.provider === provider,
  );

  if (!definition) {
    throw new ServiceError(400, "Unknown connector provider");
  }

  if (
    !Array.isArray(actions) ||
    actions.some(
      (action) =>
        typeof action !== "string" ||
        !definition.actions.some((known) => known.id === action),
    )
  ) {
    throw new ServiceError(
      400,
      "Connector action allowlist contains an unsupported action",
      "INVALID_ACTION_ALLOWLIST",
    );
  }

  return [...new Set(actions)];
}

export class ConnectorService {
  listAvailable(): ConnectorDefinition[] {
    return AVAILABLE_CONNECTORS.map((definition) => ({
      ...definition,
      configFields: definition.configFields.map((field) => ({
        ...field,
        ...(field.type === "password"
          ? { placeholder: "Use a write-only credential reference" }
          : {}),
      })),
    }));
  }

  getDefinition(provider: string): ConnectorDefinition | undefined {
    return AVAILABLE_CONNECTORS.find((entry) => entry.provider === provider);
  }

  getProjectIdForConnector(connectorId: string): string | null {
    const row = readRow(connectorId);
    return row?.project_id ?? null;
  }

  listInstances(projectId: string, actor: Actor): ConnectorInstance[] {
    if (!authorize(actor, projectId, "connector", "read")) {
      // No relationship to the project: answer with an empty listing rather
      // than disclosing whether the project exists.
      if (!isProjectMember(actor, projectId)) return [];

      throw new ServiceError(404, "Connectors not found");
    }

    const rows = getDb()
      .prepare(
        `SELECT connector_id, project_id, environment_id,
                credential_reference_id, allowed_actions, name, type,
                provider, status, config, created_by, created_at, updated_at
         FROM connectors
         WHERE project_id = ?
         ORDER BY created_at DESC`,
      )
      .all(projectId) as unknown as ConnectorRow[];

    return rows
      .filter((row) => row.project_id !== null && row.environment_id !== null)
      .map(toSafeInstance);
  }

  getInstance(connectorId: string, actor: Actor): ConnectorInstance | null {
    const row = readRow(connectorId);
    // Legacy connectors with NULL project scope stay quarantined: report them
    // as absent so the route answers 404 without leaking that the row exists.
    if (!row || !row.project_id || !row.environment_id) return null;

    assertConnectorAccess(row, actor, "read");
    return toSafeInstance(row);
  }

  createInstance(
    input: {
      project_id: string;
      environment_id: string;
      provider: string;
      name: string;
      config?: Record<string, unknown>;
      allowed_actions?: string[];
    },
    actor: Actor,
  ): ConnectorInstance {
    const definition = this.getDefinition(input.provider);
    if (!definition) {
      throw new ServiceError(400, "Unknown connector provider", "UNKNOWN_PROVIDER");
    }

    if (!authorize(actor, input.project_id, "connector", "create")) {
      throw new ServiceError(404, "Project not found");
    }

    const environment = getDb()
      .prepare(
        `SELECT project_id, mode
         FROM environments
         WHERE environment_id = ?`,
      )
      .get(input.environment_id) as
      | { project_id: string; mode: string }
      | undefined;

    if (
      !environment ||
      environment.project_id !== input.project_id ||
      environment.mode === "live"
    ) {
      throw new ServiceError(400, "Connector requires a project-scoped preview or test environment");
    }

    const safeConfig = validateSafeConfig(
      input.provider,
      input.config ?? {},
    );

    const actions = validateAllowedActions(
      input.provider,
      input.allowed_actions ?? [],
    );

    const id = randomUUID();
    const now = new Date().toISOString();
    const name = input.name.trim() || definition.name;

    return withTransaction(() => {
      getDb()
        .prepare(
          `INSERT INTO connectors (
            connector_id, project_id, environment_id, allowed_actions,
            credential_reference_id, name, type, provider, status, config,
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'disconnected', ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.project_id,
          input.environment_id,
          JSON.stringify(actions),
          name,
          definition.type,
          input.provider,
          JSON.stringify(safeConfig),
          actor.actor_id,
          now,
          now,
        );

      for (const [key, value] of Object.entries(safeConfig)) {
        getDb()
          .prepare(
            `INSERT INTO connector_configs (
              config_id, connector_id, key, value, is_secret, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, ?, ?)`,
          )
          .run(randomUUID(), id, key, String(value), now, now);
      }

      record({
        actor,
        project_id: input.project_id,
        action: "connector.created",
        target_table: "connectors",
        target_id: id,
        new_value: {
          connector_id: id,
          project_id: input.project_id,
          environment_id: input.environment_id,
          provider: input.provider,
          name,
          allowed_actions: actions,
          config: safeConfig,
        },
        trigger: actor.actor_type === "agent" ? "agent" : "api",
      });

      const created = readRow(id);
      if (!created) throw new ServiceError(500, "Connector creation failed");
      return toSafeInstance(created);
    });
  }

  updateConfig(
    connectorId: string,
    config: Record<string, unknown>,
    actor: Actor,
  ): ConnectorInstance {
    const current = assertMappedRow(readRow(connectorId));
    assertConnectorAccess(current, actor, "update");

    const safeUpdates = validateSafeConfig(current.provider, config);
    const mergedConfig = {
      ...parseConfig(current.config),
      ...safeUpdates,
    };

    return withTransaction(() => {
      const now = new Date().toISOString();

      getDb()
        .prepare(
          `UPDATE connectors
           SET config = ?, updated_at = ?
           WHERE connector_id = ? AND project_id = ?`,
        )
        .run(
          JSON.stringify(mergedConfig),
          now,
          connectorId,
          current.project_id,
        );

      for (const [key, value] of Object.entries(safeUpdates)) {
        getDb()
          .prepare(
            `INSERT INTO connector_configs (
              config_id, connector_id, key, value, is_secret, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, ?, ?)
            ON CONFLICT(connector_id, key)
            DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          )
          .run(
            randomUUID(),
            connectorId,
            key,
            String(value),
            now,
            now,
          );
      }

      record({
        actor,
        project_id: current.project_id as string,
        action: "connector.updated",
        target_table: "connectors",
        target_id: connectorId,
        old_value: {
          ...current,
          config: parseConfig(current.config),
        },
        new_value: {
          ...current,
          config: mergedConfig,
          updated_at: now,
        },
        trigger: actor.actor_type === "agent" ? "agent" : "api",
      });

      const updated = readRow(connectorId);
      if (!updated) throw new ServiceError(500, "Connector update failed");
      return toSafeInstance(updated);
    });
  }

  updateStatus(
    connectorId: string,
    status: ConnectorInstance["status"],
    actor: Actor,
  ): ConnectorInstance {
    if (status === "connected") {
      throw new ServiceError(
        423,
        "Provider connection status cannot be asserted in preview-only mode",
        "RUNTIME_DISABLED",
      );
    }

    const current = assertMappedRow(readRow(connectorId));
    assertConnectorAccess(current, actor, "update");

    return withTransaction(() => {
      const now = new Date().toISOString();

      getDb()
        .prepare(
          `UPDATE connectors
           SET status = ?, updated_at = ?
           WHERE connector_id = ? AND project_id = ?`,
        )
        .run(status, now, connectorId, current.project_id);

      record({
        actor,
        project_id: current.project_id as string,
        action: "connector.updated",
        target_table: "connectors",
        target_id: connectorId,
        old_value: { status: current.status },
        new_value: { status, updated_at: now },
        trigger: actor.actor_type === "agent" ? "agent" : "api",
      });

      const updated = readRow(connectorId);
      if (!updated) throw new ServiceError(500, "Connector status update failed");
      return toSafeInstance(updated);
    });
  }

  deleteInstance(connectorId: string, actor: Actor): boolean {
    const current = assertMappedRow(readRow(connectorId));
    assertConnectorAccess(current, actor, "delete");

    const credential = getDb()
      .prepare(
        "SELECT credential_reference_id FROM credential_references WHERE connector_id = ? LIMIT 1",
      )
      .get(connectorId);

    if (credential) {
      throw new ServiceError(
        409,
        "Revoke and remove the credential reference before deleting this connector",
        "CONNECTOR_HAS_CREDENTIAL",
      );
    }

    return withTransaction(() => {
      getDb()
        .prepare("DELETE FROM connector_configs WHERE connector_id = ?")
        .run(connectorId);

      const result = getDb()
        .prepare(
          "DELETE FROM connectors WHERE connector_id = ? AND project_id = ?",
        )
        .run(connectorId, current.project_id);

      const changes = Number(
        (result as unknown as { changes: number }).changes,
      );

      if (changes > 0) {
        record({
          actor,
          project_id: current.project_id as string,
          action: "connector.deleted",
          target_table: "connectors",
          target_id: connectorId,
          old_value: current,
          new_value: null,
          trigger: actor.actor_type === "agent" ? "agent" : "api",
        });
      }

      return changes > 0;
    });
  }

  getConfig(connectorId: string, actor: Actor): Record<string, unknown> {
    const instance = this.getInstance(connectorId, actor);
    if (!instance) throw new ServiceError(404, "Connector not found");
    return instance.config;
  }

  testConnection(
    connectorId: string,
    actor: Actor,
  ): Promise<{ ok: boolean; message: string }> {
    const instance = this.getInstance(connectorId, actor);
    if (!instance) throw new ServiceError(404, "Connector not found");

    return Promise.resolve({
      ok: false,
      message: "External provider verification is disabled in preview-only mode",
    });
  }

  async githubListRepos(
    _connectorId: string,
    _actor: Actor,
  ): Promise<never> {
    throw new ServiceError(
      423,
      "External provider actions are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }

  async githubListIssues(
    _connectorId: string,
    _owner: string,
    _repo: string,
    _actor: Actor,
  ): Promise<never> {
    throw new ServiceError(
      423,
      "External provider actions are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }

  async githubCreateIssue(
    _connectorId: string,
    _owner: string,
    _repo: string,
    _title: string,
    _body: string,
    _actor: Actor,
  ): Promise<never> {
    throw new ServiceError(
      423,
      "External provider actions are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }

  async hermesTestConnection(
    _connectorId: string,
    _actor: Actor,
  ): Promise<never> {
    throw new ServiceError(
      423,
      "External provider actions are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }

  async hermesSendMessage(
    _connectorId: string,
    _message: string,
    _actor: Actor,
  ): Promise<never> {
    throw new ServiceError(
      423,
      "External provider actions are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }

  async hermesListModels(
    _connectorId: string,
    _actor: Actor,
  ): Promise<never> {
    throw new ServiceError(
      423,
      "External provider actions are disabled in preview-only mode",
      "RUNTIME_DISABLED",
    );
  }
}

export const connectorService = new ConnectorService();
