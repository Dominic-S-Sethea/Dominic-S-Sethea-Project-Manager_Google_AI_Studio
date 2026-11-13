import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { applyCompatibilityMigrations, closeDb, getDb } from "../database/index.ts";
import { createTestExecution } from "../services/automationTestRun.ts";
import {
  listExecutionTraces,
  readExecutionTrace,
} from "../services/automationTrace.ts";
import { createAutomationTestRouter } from "../routes/automation.test.routes.ts";
import { ServiceError } from "../services/actor.service.ts";
import { redact } from "../services/automationRedaction.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../database/migrations");
const jwtSecret = process.env.JWT_SECRET || "project-manager-jwt-secret";

function makeTempDatabasePath(): { directory: string; file: string } {
  const directory = mkdtempSync(path.join(tmpdir(), "pm-p705-"));
  return {
    directory,
    file: path.join(directory, "test.sqlite"),
  };
}

function seedDomain(db: DatabaseSync): void {
  db.exec(`
    INSERT OR IGNORE INTO users
      (user_id, username, email, password_hash, created_at)
    VALUES
      ('u1', 'User One', 'u1@example.test', 'hash', '2026-01-01');

    INSERT OR IGNORE INTO projects
      (project_id, name, created_by, created_at, updated_at)
    VALUES
      ('p1', 'Project One', 'u1', '2026-01-01', '2026-01-01');

    INSERT OR IGNORE INTO workflows
      (workflow_id, project_id, name, status, created_by, created_at, updated_at)
    VALUES
      ('w1', 'p1', 'Workflow One', 'draft', 'u1', '2026-01-01', '2026-01-01');

    INSERT OR IGNORE INTO workflow_versions
      (version_id, workflow_id, version_number, definition_json,
       definition_hash, schema_version, created_by, created_at)
    VALUES
      ('v1', 'w1', 1, '{}', 'hash-v1', 1, 'u1', '2026-01-01');

    UPDATE workflows
    SET current_version_id = 'v1'
    WHERE workflow_id = 'w1';

    INSERT OR IGNORE INTO environments
      (environment_id, project_id, name, mode, is_live, created_by, created_at)
    VALUES
      ('env1', 'p1', 'Preview', 'preview', 0, 'u1', '2026-01-01');
  `);

  db.prepare(
    `INSERT INTO workflow_nodes
      (node_id, version_id, node_type, name, config_json,
       position_x, position_y, created_at)
     VALUES (?, 'v1', ?, ?, ?, ?, 0, '2026-01-01')`,
  ).run("node-trigger", "trigger", "Task event", "{}", 0);

  db.prepare(
    `INSERT INTO workflow_nodes
      (node_id, version_id, node_type, name, config_json,
       position_x, position_y, created_at)
     VALUES (?, 'v1', ?, ?, ?, ?, 0, '2026-01-01')`,
  ).run("node-decision", "decision", "Dependency check", "{}", 1);

  db.prepare(
    `INSERT INTO workflow_nodes
      (node_id, version_id, node_type, name, config_json,
       position_x, position_y, created_at)
     VALUES (?, 'v1', ?, ?, ?, ?, 0, '2026-01-01')`,
  ).run(
    "node-action",
    "action",
    "Notify owner",
    JSON.stringify({
      operation: "notify_owner",
      token: "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    }),
    2,
  );

  db.exec(`
    INSERT INTO workflow_edges
      (edge_id, version_id, from_node_id, to_node_id)
    VALUES
      ('edge-1', 'v1', 'node-trigger', 'node-decision'),
      ('edge-2', 'v1', 'node-decision', 'node-action');
  `);
}

async function withAppDb<T>(
  run: (db: DatabaseSync) => Promise<T> | T,
): Promise<T> {
  const temp = makeTempDatabasePath();
  const previousDbPath = process.env.DB_PATH;

  process.env.DB_PATH = temp.file;
  closeDb();

  try {
    const db = getDb();
    seedDomain(db);
    return await run(db);
  } finally {
    closeDb();

    if (previousDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = previousDbPath;
    }

    rmSync(temp.directory, { recursive: true, force: true });
  }
}

function countRows(db: DatabaseSync, tableName: string): number {
  const allowedTables = new Set([
    "projects",
    "tasks",
    "workflows",
    "workflow_versions",
    "workflow_nodes",
    "workflow_edges",
    "event",
    "outbox",
    "approvals",
    "idempotency_keys",
    "executions",
    "execution_steps",
  ]);

  if (!allowedTables.has(tableName)) {
    throw new Error("Unsupported test table.");
  }

  const row = db.prepare(
    `SELECT COUNT(*) AS count FROM ${tableName}`,
  ).get() as { count: number };

  return row.count;
}

test("PM-P7-05 pinned test, trace redaction, isolation, and replay lock", async () => {
  await withAppDb(async (db) => {
    // Migration 0004's up SQL is a no-op (version marker). The replayed_from
    // column is already present from getDb() -> schema.sql + applyCompatibilityMigrations.
    db.exec(readFileSync(path.join(migrationsDir, "0004_pm_p7_05_replay.sql"), "utf8"));

    const replayColumn = db.prepare(
      "PRAGMA table_info(executions)",
    ).all() as Array<{ name: string }>;

    assert.equal(
      replayColumn.some((column) => column.name === "replayed_from"),
      true,
    );

    const redactionCanary = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    const redacted = JSON.stringify(redact({
      token: redactionCanary,
      email: "person@example.test",
      nested: {
        authorization: `Bearer ${redactionCanary}`,
      },
    }));

    assert.equal(redacted.includes(redactionCanary), false);
    assert.match(redacted, /\[REDACTED\]/);

    const protectedTableNames = [
      "projects",
      "tasks",
      "workflows",
      "workflow_versions",
      "workflow_nodes",
      "workflow_edges",
      "event",
      "outbox",
      "approvals",
      "idempotency_keys",
    ];

    const protectedCountsBefore = new Map(
      protectedTableNames.map((name) => [name, countRows(db, name)]),
    );

    const first = await createTestExecution(
      db,
      "u1",
      "w1",
      {
        dataset: "sample-042",
        environment_id: "env1",
      },
    );

    assert.equal(first.status, 201);
    assert.equal(first.body.execution.status, "succeeded");
    assert.equal(first.body.execution.preview, 1);
    assert.equal(first.body.execution.is_test, true);
    assert.equal(first.body.execution.dataset, "sample-042");
    assert.equal(first.body.execution.steps.length, 3);

    const firstExecutionId = first.body.execution.execution_id;

    const duplicate = await createTestExecution(
      db,
      "u1",
      "w1",
      {
        dataset: "sample-042",
        environment_id: "env1",
      },
    );

    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(
      duplicate.body.execution.execution_id,
      firstExecutionId,
    );

    assert.equal(
      countRows(db, "executions"),
      1,
    );
    assert.equal(
      countRows(db, "execution_steps"),
      3,
    );

    const serializedSteps = db.prepare(
      `SELECT input_json, output_json
       FROM execution_steps
       WHERE execution_id = ?`,
    ).all(firstExecutionId) as Array<{
      input_json: string | null;
      output_json: string | null;
    }>;

    const persistedTrace = JSON.stringify(serializedSteps);
    assert.equal(persistedTrace.includes(redactionCanary), false);
    assert.match(persistedTrace, /\[REDACTED\]/);

    const listed = await listExecutionTraces(db, "u1", {
      workflowId: "w1",
      limit: 50,
      offset: 0,
    });

    assert.equal(listed.total, 1);
    assert.equal(listed.executions.length, 1);
    assert.equal(listed.executions[0]?.dataset, "sample-042");

    const detail = await readExecutionTrace(
      db,
      "u1",
      firstExecutionId,
    );

    assert.equal(detail.steps.length, 3);
    assert.equal(detail.execution.dataset, "sample-042");

    const serializedDetail = JSON.stringify(detail);
    assert.equal(serializedDetail.includes(redactionCanary), false);
    assert.match(serializedDetail, /\[REDACTED\]/);

    const failed = await createTestExecution(
      db,
      "u1",
      "w1",
      {
        dataset: "fail-branch",
        environment_id: "env1",
      },
    );

    assert.equal(failed.status, 201);
    assert.equal(failed.body.execution.status, "failed");
    assert.equal(failed.body.execution.error_class, "permanent");
    assert.equal(failed.body.execution.is_test, true);
    assert.equal(failed.body.execution.dataset, "fail-branch");

    assert.equal(countRows(db, "executions"), 2);
    assert.equal(countRows(db, "execution_steps"), 6);

    for (const tableName of protectedTableNames) {
      assert.equal(
        countRows(db, tableName),
        protectedCountsBefore.get(tableName),
        `Unexpected PM-P7-05 write to ${tableName}`,
      );
    }

    db.exec(`
      INSERT OR IGNORE INTO users
        (user_id, username, email, password_hash, created_at)
      VALUES
        ('u2', 'Viewer', 'viewer@example.test', 'hash', '2026-01-01');

      INSERT OR IGNORE INTO project_members
        (project_id, user_id, role, created_at)
      VALUES
        ('p1', 'u2', 'viewer', '2026-01-01');

      INSERT OR IGNORE INTO users
        (user_id, username, email, password_hash, created_at)
      VALUES
        ('u3', 'Outsider', 'outsider@example.test', 'hash', '2026-01-01');
    `);

    await assert.rejects(
      () => createTestExecution(
        db,
        "u2",
        "w1",
        {
          dataset: "sample-01",
          environment_id: "env1",
        },
      ),
      (error: unknown) =>
        error instanceof ServiceError && error.statusCode === 403,
    );

    await assert.rejects(
      () => readExecutionTrace(db, "u3", firstExecutionId),
      (error: unknown) =>
        error instanceof ServiceError && error.statusCode === 404,
    );

    const token = jwt.sign(
      {
        user_id: "u1",
        email: "u1@example.test",
        role: "viewer",
      },
      jwtSecret,
    );

    const app = express();
    app.use(express.json());
    app.use("/api/automation", createAutomationTestRouter(db));

    const listResponse = await request(app)
      .get("/api/automation/executions")
      .query({ workflow_id: "w1" })
      .set("Authorization", `Bearer ${token}`);

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.total, 2);

    const executionsBeforeReplay = countRows(db, "executions");
    const stepsBeforeReplay = countRows(db, "execution_steps");

    const replayResponse = await request(app)
      .post(`/api/automation/executions/${firstExecutionId}/replay`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(replayResponse.status, 423);
    assert.equal(
      replayResponse.body.error,
      "Replay is disabled in preview-only mode.",
    );
    assert.equal(typeof replayResponse.body.request_id, "string");
    assert.equal(countRows(db, "executions"), executionsBeforeReplay);
    assert.equal(countRows(db, "execution_steps"), stepsBeforeReplay);

    const originalAfterReplay = db.prepare(
      `SELECT replayed_from
       FROM executions
       WHERE execution_id = ?`,
    ).get(firstExecutionId) as { replayed_from: string | null };

    assert.equal(originalAfterReplay.replayed_from, null);
  });

  const migrationDb = new DatabaseSync(":memory:");

  try {
    migrationDb.exec(`PRAGMA foreign_keys = ON;`);

    // Migration 0004 is a version marker (no-op SQL). The replayed_from column
    // is added by schema.sql (fresh databases) and applyCompatibilityMigrations
    // (existing databases via getDb()). Verify via schema + compat path.
    migrationDb.exec(readFileSync(path.join(here, "../database/schema.sql"), "utf8"));
    applyCompatibilityMigrations(migrationDb);

    const afterUp = migrationDb.prepare(
      "PRAGMA table_info(executions)",
    ).all() as Array<{ name: string }>;

    assert.equal(
      afterUp.some((column) => column.name === "replayed_from"),
      true,
    );
  } finally {
    migrationDb.close();
  }
});