
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { redactSecrets } from "../services/redaction.service.ts";

let db: InstanceType<typeof DatabaseSync> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the committed source schema from both src/database and dist/database.
// This intentionally avoids reading a stale schema copy beside compiled output.
const schemaPath = fileURLToPath(
  new URL("../../src/database/schema.sql", import.meta.url),
);
const schemaSql = readFileSync(schemaPath, "utf-8");

interface TableColumn {
  name: string;
}

function tableColumns(
  database: InstanceType<typeof DatabaseSync>,
  tableName: string,
): Set<string> {
  const rows = database
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as unknown as TableColumn[];

  return new Set(rows.map((row) => row.name));
}

function addColumnIfMissing(
  database: InstanceType<typeof DatabaseSync>,
  tableName: string,
  columnName: string,
  declaration: string,
): void {
  const columns = tableColumns(database, tableName);
  if (columns.has(columnName)) return;

  database.exec(
    `ALTER TABLE "${tableName}" ADD COLUMN ${columnName} ${declaration};`,
  );
}

function sanitizeLegacyConnectorSecrets(
  database: InstanceType<typeof DatabaseSync>,
): void {
  // Old connectors may contain inline secret config values. Replace those
  // values at bootstrap so legacy plaintext config is not retained indefinitely.
  const rows = database
    .prepare(
      "SELECT connector_id, config FROM connectors WHERE config IS NOT NULL",
    )
    .all() as unknown as Array<{
      connector_id: string;
      config: string;
    }>;

  for (const row of rows) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(row.config);
    } catch {
      // A malformed legacy config cannot be safely inspected.
      database
        .prepare("UPDATE connectors SET config = '{}' WHERE connector_id = ?")
        .run(row.connector_id);
      continue;
    }

    const sanitized = redactSecrets(parsed);
    const serialized = JSON.stringify(sanitized);

    if (serialized !== row.config) {
      database
        .prepare("UPDATE connectors SET config = ? WHERE connector_id = ?")
        .run(serialized, row.connector_id);
    }
  }

  // connector_configs is the legacy per-key storage. The is_secret marker is
  // authoritative; never copy those stored values into an API or log.
  database
    .prepare(
      `UPDATE connector_configs
       SET value = '[REDACTED]', updated_at = datetime('now')
       WHERE is_secret = 1 AND value IS NOT NULL`,
    )
    .run();
}

export function applyCompatibilityMigrations(
  database: InstanceType<typeof DatabaseSync>,
): void {
  const agentColumns = tableColumns(database, "agents");

  if (!agentColumns.has("expires_at")) {
    database.exec("ALTER TABLE agents ADD COLUMN expires_at DATETIME;");
  }

  // Keep this migration self-contained: older schema files may not define
  // agent_tokens. These statements are also safe when the current schema has
  // already created them.
  database.exec(`
    CREATE TABLE IF NOT EXISTS agent_tokens (
      token_hash  TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
      role        TEXT NOT NULL,
      expires_at  DATETIME NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent
      ON agent_tokens(agent_id);

    CREATE INDEX IF NOT EXISTS idx_agent_tokens_expires
      ON agent_tokens(expires_at);
  `);

  // PM-P7-03 compatibility columns. schema.sql's CREATE TABLE IF NOT EXISTS
  // cannot add these to existing connectors or audit_logs tables.
  const connectorColumns: ReadonlyArray<{
    name: string;
    declaration: string;
  }> = [
    {
      name: "project_id",
      declaration: "TEXT REFERENCES projects(project_id)",
    },
    {
      name: "environment_id",
      declaration: "TEXT REFERENCES environments(environment_id)",
    },
    {
      name: "allowed_actions",
      declaration: "TEXT NOT NULL DEFAULT '[]'",
    },
    {
      name: "credential_reference_id",
      declaration:
        "TEXT REFERENCES credential_references(credential_reference_id)",
    },
  ];

  for (const column of connectorColumns) {
    addColumnIfMissing(
      database,
      "connectors",
      column.name,
      column.declaration,
    );
  }

  const auditColumns: ReadonlyArray<{
    name: string;
    declaration: string;
  }> = [
    { name: "actor_type", declaration: "TEXT" },
    { name: "actor_id", declaration: "TEXT" },
    { name: "project_id", declaration: "TEXT" },
    { name: "request_id", declaration: "TEXT" },
    { name: "trace_id", declaration: "TEXT" },
    { name: "target_sub_id", declaration: "TEXT" },
    { name: "outcome", declaration: "TEXT" },
  ];

  for (const column of auditColumns) {
    addColumnIfMissing(
      database,
      "audit_logs",
      column.name,
      column.declaration,
    );
  }

  // PM-P7-05 compatibility column. schema.sql's CREATE TABLE IF NOT EXISTS
  // cannot add this to existing executions tables.
  addColumnIfMissing(
    database,
    "executions",
    "replayed_from",
    "TEXT REFERENCES executions(execution_id)",
  );
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_executions_replayed_from ON executions(replayed_from);",
  );

  sanitizeLegacyConnectorSecrets(database);
}

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (!db) {
    const databasePath =
      process.env.DB_PATH ||
      path.join(__dirname, "..", "..", "data", "app.db");

    db = new DatabaseSync(databasePath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    // Apply the authoritative schema first. Additive compatibility columns
    // follow, so a legacy database can execute schema.sql repeatedly.
    db.exec(schemaSql);
    applyCompatibilityMigrations(db);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
