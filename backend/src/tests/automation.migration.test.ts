import assert from "node:assert/strict";
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { applyCompatibilityMigrations, closeDb as closeApplicationDatabase, getDb as getApplicationDatabase } from "../database/index.ts";
import { runMigrations } from "../database/migrate.ts";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_DIRECTORY = path.resolve(TEST_DIRECTORY, "../database");
const MIGRATIONS_DIRECTORY = path.join(DATABASE_DIRECTORY, "migrations");
const SCHEMA_PATH = path.join(DATABASE_DIRECTORY, "schema.sql");
const BASELINE_MIGRATION_PATH = path.join(
  MIGRATIONS_DIRECTORY,
  "0000_baseline.sql",
);

const AUTOMATION_TABLES = [
  "workflows",
  "workflow_versions",
  "workflow_nodes",
  "workflow_edges",
  "environments",
  "executions",
  "execution_steps",
  "approvals",
  "credential_references",
  "idempotency_keys",
];

interface SchemaObjectRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

function createTemporaryDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), "pm-automation-migrations-"));
}

function getTableNames(database: InstanceType<typeof DatabaseSync>): string[] {
  const rows = database
    .prepare(
      `SELECT name
       FROM sqlite_schema
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as unknown as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

function getSchemaObjects(database: InstanceType<typeof DatabaseSync>): SchemaObjectRow[] {
  return database
    .prepare(
      `SELECT type, name, tbl_name
       FROM sqlite_schema
       WHERE type IN ('table', 'index', 'trigger')
         AND name NOT LIKE 'sqlite_%'
       ORDER BY type, name`,
    )
    .all() as unknown as SchemaObjectRow[];
}

function getRowCounts(
  database: InstanceType<typeof DatabaseSync>,
  tableNames: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const tableName of tableNames) {
    const escapedName = tableName.replaceAll('"', '""');
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM "${escapedName}"`)
      .get() as { count: number } | undefined;

    counts[tableName] = row?.count ?? 0;
  }

  return counts;
}

function assertNoForeignKeyViolations(
  database: InstanceType<typeof DatabaseSync>,
): void {
  const violations = database
    .prepare("PRAGMA foreign_key_check")
    .all();

  assert.equal(
    violations.length,
    0,
    `Expected no foreign-key violations; received ${JSON.stringify(violations)}`,
  );
}

function copyMigrationFiles(destination: string): void {
  mkdirSync(destination, { recursive: true });

  for (const fileName of readdirSync(MIGRATIONS_DIRECTORY)) {
    if (fileName.endsWith(".sql")) {
      copyFileSync(
        path.join(MIGRATIONS_DIRECTORY, fileName),
        path.join(destination, fileName),
      );
    }
  }
}

function seedBaselineRows(database: InstanceType<typeof DatabaseSync>): void {
  database.prepare(
    `INSERT INTO users
      (user_id, username, email, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("user-p6-07", "migration-test", "migration-test@example.invalid", "not-a-secret", "2026-01-01T00:00:00.000Z");

  database.prepare(
    `INSERT INTO projects
      (project_id, name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("project-p6-07", "Migration Test Project", "user-p6-07", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");

  database.prepare(
    `INSERT INTO agents
      (agent_id, name, role, api_key_hash, provider, model, permissions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "agent-p6-07",
    "Migration Test Agent",
    "viewer",
    "test-hash-only",
    "test-provider",
    "test-model",
    "[]",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );
}

function seedAutomationRows(database: InstanceType<typeof DatabaseSync>): void {
  const timestamp = "2026-01-02T00:00:00.000Z";

  database.prepare(
    `INSERT INTO workflows
      (workflow_id, project_id, name, status, current_version_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
  ).run("workflow-test", "project-p6-07", "Preview Workflow", "draft", "user-p6-07", timestamp, timestamp);

  database.prepare(
    `INSERT INTO workflow_versions
      (version_id, workflow_id, version_number, definition_json, definition_hash, schema_version, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("workflow-version-test", "workflow-test", 1, "{}", "test-hash", 1, "user-p6-07", timestamp);

  database.prepare(
    "UPDATE workflows SET current_version_id = ? WHERE workflow_id = ?",
  ).run("workflow-version-test", "workflow-test");

  database.prepare(
    `INSERT INTO environments
      (environment_id, project_id, name, mode, is_live, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("environment-test", "project-p6-07", "Preview", "preview", 0, "user-p6-07", timestamp);

  database.prepare(
    `INSERT INTO workflow_nodes
      (node_id, version_id, node_type, name, config_json, position_x, position_y, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("node-trigger-test", "workflow-version-test", "trigger", "Manual Trigger", "{}", 0, 0, timestamp);

  database.prepare(
    `INSERT INTO workflow_nodes
      (node_id, version_id, node_type, name, config_json, position_x, position_y, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("node-action-test", "workflow-version-test", "action", "Preview Action", "{}", 160, 0, timestamp);

  database.prepare(
    `INSERT INTO workflow_edges
      (edge_id, version_id, from_node_id, to_node_id)
     VALUES (?, ?, ?, ?)`,
  ).run("workflow-edge-test", "workflow-version-test", "node-trigger-test", "node-action-test");

  database.prepare(
    `INSERT INTO executions
      (execution_id, workflow_id, version_id, environment_id, status, trigger_type,
       trigger_actor_type, idempotency_key, trace_id, approval_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    "execution-test",
    "workflow-test",
    "workflow-version-test",
    "environment-test",
    "pending",
    "manual",
    "user",
    "execution-idempotency-test",
    "trace-test",
    timestamp,
  );

  database.prepare(
    `INSERT INTO execution_steps
      (step_id, execution_id, node_id, node_type, status, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "execution-step-test",
    "execution-test",
    "node-action-test",
    "action",
    "pending",
    "step-idempotency-test",
    timestamp,
  );

  database.prepare(
    `INSERT INTO approvals
      (approval_id, execution_id, step_id, workflow_id, approval_type, status,
       requested_by_type, requested_by_id, requested_at, expires_at, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "approval-test",
    "execution-test",
    "execution-step-test",
    "workflow-test",
    "execute",
    "pending",
    "user",
    "user-p6-07",
    timestamp,
    "2027-01-01T00:00:00.000Z",
    "approval-idempotency-test",
    timestamp,
  );

  database.prepare(
    "UPDATE executions SET approval_id = ? WHERE execution_id = ?",
  ).run("approval-test", "execution-test");

  database.prepare(
    `INSERT INTO idempotency_keys
      (key, request_hash, response_snapshot, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    "domain-idempotency-test",
    "request-hash",
    "{}",
    timestamp,
    "2027-01-01T00:00:00.000Z",
  );
}

test("fresh schema and the migration sequence produce identical schema objects", () => {
  const temporaryDirectory = createTemporaryDirectory();
  const migratedPath = path.join(temporaryDirectory, "migrated.db");
  const freshDatabase = new DatabaseSync(":memory:");
  let applicationDatabase: InstanceType<typeof DatabaseSync> | null = null;
  let migratedDatabase: InstanceType<typeof DatabaseSync> | null = null;
  const previousDbPath = process.env.DB_PATH;

  try {
    // Exercise the real getDb() bootstrap against an isolated file.
    process.env.DB_PATH = path.join(temporaryDirectory, "index-bootstrap.db");
    applicationDatabase = getApplicationDatabase();
    applicationDatabase.exec("PRAGMA foreign_keys = ON;");

    // Also apply schema.sql directly as a second fresh-install comparison.
    freshDatabase.exec(readFileSync(SCHEMA_PATH, "utf8"));
    applyCompatibilityMigrations(freshDatabase);
    assertNoForeignKeyViolations(applicationDatabase);
    assertNoForeignKeyViolations(freshDatabase);

    runMigrations({
      databasePath: migratedPath,
      migrationsDir: MIGRATIONS_DIRECTORY,
      schemaPath: SCHEMA_PATH,
      log: () => undefined,
    });

    migratedDatabase = new DatabaseSync(migratedPath);
    migratedDatabase.exec("PRAGMA foreign_keys = ON;");
    applyCompatibilityMigrations(migratedDatabase);

    const schemaTables = getTableNames(freshDatabase);
    const applicationTables = getTableNames(applicationDatabase);
    const migratedTables = getTableNames(migratedDatabase);

    for (const tableName of AUTOMATION_TABLES) {
      assert.ok(schemaTables.includes(tableName), `schema.sql is missing ${tableName}`);
      assert.ok(applicationTables.includes(tableName), `getDb() is missing ${tableName}`);
      assert.ok(migratedTables.includes(tableName), `migrations are missing ${tableName}`);
    }

    assert.deepEqual(applicationTables, schemaTables);
    assert.deepEqual(migratedTables, schemaTables);
    assert.deepEqual(
      getSchemaObjects(applicationDatabase),
      getSchemaObjects(freshDatabase),
    );
    assert.deepEqual(
      getSchemaObjects(migratedDatabase),
      getSchemaObjects(freshDatabase),
    );
    assertNoForeignKeyViolations(migratedDatabase);
  } finally {
    migratedDatabase?.close();
    closeApplicationDatabase();
    if (previousDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = previousDbPath;
    }
    freshDatabase.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("baseline adoption preserves existing rows and the runner is idempotent", () => {
  const temporaryDirectory = createTemporaryDirectory();
  const databasePath = path.join(temporaryDirectory, "existing.db");
  const existingDatabase = new DatabaseSync(databasePath);

  try {
    existingDatabase.exec("PRAGMA foreign_keys = ON;");
    existingDatabase.exec(readFileSync(BASELINE_MIGRATION_PATH, "utf8"));
    seedBaselineRows(existingDatabase);

    const baselineTables = getTableNames(existingDatabase)
      .filter((tableName) => tableName !== "schema_migrations");
    const countsBefore = getRowCounts(existingDatabase, baselineTables);
    // audit_logs is an append-only trail: applying migrations legitimately
    // appends migration.applied rows, so it is compared separately below.
    const { audit_logs: auditBefore = 0, ...dataBefore } = countsBefore;

    // Simulate a pre-ledger database whose baseline schema already exists.
    existingDatabase.exec("DROP TABLE schema_migrations;");
    existingDatabase.close();

    const firstRun = runMigrations({
      databasePath,
      migrationsDir: MIGRATIONS_DIRECTORY,
      schemaPath: SCHEMA_PATH,
      log: () => undefined,
    });

    assert.equal(firstRun.currentVersion, 4);
    assert.deepEqual(firstRun.pendingVersions, []);

    const migratedDatabase = new DatabaseSync(databasePath);
    try {
      migratedDatabase.exec("PRAGMA foreign_keys = ON;");
      const countsAfter = getRowCounts(migratedDatabase, baselineTables);
      const { audit_logs: auditAfter = 0, ...dataAfter } = countsAfter;
      assert.deepEqual(dataAfter, dataBefore);
      // 0003 adds the PM-P7-03 audit columns and records itself; 0004 records
      // too. 0000-0002 predate those columns and cannot be recorded.
      assert.equal(auditAfter, auditBefore + 2);
      assertNoForeignKeyViolations(migratedDatabase);

      const ledgerRows = migratedDatabase
        .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
        .all() as unknown as Array<{ version: number; name: string }>;

      assert.deepEqual(
        ledgerRows.map((row) => row.version),
        [0, 1, 2, 3, 4],
      );
      assert.deepEqual(
        ledgerRows.map((row) => row.name),
        ["baseline", "automation_domain", "automation_events", "pm_p7_03_security", "pm_p7_05_replay"],
      );
    } finally {
      migratedDatabase.close();
    }

    const logs: string[] = [];
    const secondRun = runMigrations({
      databasePath,
      migrationsDir: MIGRATIONS_DIRECTORY,
      schemaPath: SCHEMA_PATH,
      log: (message) => logs.push(message),
    });

    assert.equal(secondRun.currentVersion, 4);
    assert.deepEqual(secondRun.pendingVersions, []);
    assert.ok(
      logs.some((line) => line.includes('"event":"migration_noop"')),
      "second run should report that no migrations are pending",
    );
  } finally {
    try {
      existingDatabase.close();
    } catch {
      // It may already have been closed before the runner was invoked.
    }
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the runner refuses to continue when an applied migration is tampered with", () => {
  const temporaryDirectory = createTemporaryDirectory();
  const copiedMigrationsDirectory = path.join(temporaryDirectory, "migrations");
  const databasePath = path.join(temporaryDirectory, "drift.db");

  try {
    copyMigrationFiles(copiedMigrationsDirectory);

    runMigrations({
      databasePath,
      migrationsDir: copiedMigrationsDirectory,
      schemaPath: SCHEMA_PATH,
      log: () => undefined,
    });

    appendFileSync(
      path.join(copiedMigrationsDirectory, "0001_automation_domain.sql"),
      "\n-- deliberate checksum drift test\n",
    );

    assert.throws(
      () => runMigrations({
        databasePath,
        migrationsDir: copiedMigrationsDirectory,
        schemaPath: SCHEMA_PATH,
        log: () => undefined,
      }),
      /checksum mismatch/i,
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("development down migration removes Automation objects and preserves baseline", () => {
  const temporaryDirectory = createTemporaryDirectory();
  const databasePath = path.join(temporaryDirectory, "down.db");
  const baselineDatabase = new DatabaseSync(":memory:");
  const previousNodeEnvironment = process.env.NODE_ENV;

  try {
    baselineDatabase.exec(readFileSync(BASELINE_MIGRATION_PATH, "utf8"));

    runMigrations({
      databasePath,
      migrationsDir: MIGRATIONS_DIRECTORY,
      schemaPath: SCHEMA_PATH,
      log: () => undefined,
    });

    const database = new DatabaseSync(databasePath);
    try {
      database.exec("PRAGMA foreign_keys = ON;");
      seedBaselineRows(database);
      seedAutomationRows(database);
      assertNoForeignKeyViolations(database);
    } finally {
      database.close();
    }

    process.env.NODE_ENV = "test";
    const result = runMigrations({
      databasePath,
      migrationsDir: MIGRATIONS_DIRECTORY,
      schemaPath: SCHEMA_PATH,
      downToVersion: 0,
      log: () => undefined,
    });

    assert.deepEqual(result.rolledBackVersions, [4, 3, 2, 1]);
    assert.equal(result.currentVersion, 0);

    const rolledBackDatabase = new DatabaseSync(databasePath);
    try {
      rolledBackDatabase.exec("PRAGMA foreign_keys = ON;");
      assert.deepEqual(
        getTableNames(rolledBackDatabase),
        getTableNames(baselineDatabase),
      );
      assert.deepEqual(
        getSchemaObjects(rolledBackDatabase),
        getSchemaObjects(baselineDatabase),
      );
      assert.equal(
        (rolledBackDatabase
          .prepare("SELECT COUNT(*) AS count FROM users")
          .get() as { count: number }).count,
        1,
      );

      const ledgerVersions = rolledBackDatabase
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all() as unknown as Array<{ version: number }>;

      assert.deepEqual(ledgerVersions.map((row) => row.version), [0]);
      assertNoForeignKeyViolations(rolledBackDatabase);
    } finally {
      rolledBackDatabase.close();
    }
  } finally {
    if (previousNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnvironment;
    }
    baselineDatabase.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

