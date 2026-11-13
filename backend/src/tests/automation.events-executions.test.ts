import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { test } from "node:test";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { applyCompatibilityMigrations, closeDb, getDb } from "../database/index.ts";
import { runMigrations } from "../database/migrate.ts";
import { ingestEvent } from "../services/eventIngestion.service.ts";
import { createExecution, transitionExecution } from "../services/execution.service.ts";
import { createAutomationExecutionsRouter } from "../routes/automation.executions.ts";
import { createAutomationEventsRouter } from "../routes/automation.events.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(here, "../database");
const migrationsDir = path.join(databaseDir, "migrations");
const schemaPath = path.join(databaseDir, "schema.sql");
const jwtSecret = process.env.JWT_SECRET || "project-manager-jwt-secret";
const token = jwt.sign({ user_id: "u1", email: "u1@example.test", role: "viewer" }, jwtSecret);
const auth = { Authorization: `Bearer ${token}` };

function tempDbPath(): { directory: string; file: string } {
  const directory = mkdtempSync(path.join(tmpdir(), "pm-p702-"));
  return { directory, file: path.join(directory, "test.sqlite") };
}

function seedDomain(db: DatabaseSync): void {
  db.exec(`
    INSERT OR IGNORE INTO users(user_id, username, email, password_hash, created_at)
      VALUES ('u1','User One','u1@example.test','hash','2026-01-01');
    INSERT OR IGNORE INTO projects(project_id,name,created_by,created_at,updated_at)
      VALUES ('p1','Project One','u1','2026-01-01','2026-01-01');
    INSERT OR IGNORE INTO workflows(workflow_id,project_id,name,status,created_by,created_at,updated_at)
      VALUES ('w1','p1','Workflow One','draft','u1','2026-01-01','2026-01-01');
    INSERT OR IGNORE INTO workflow_versions(version_id,workflow_id,version_number,definition_json,definition_hash,schema_version,created_by,created_at)
      VALUES ('v1','w1',1,'{}','hash',1,'u1','2026-01-01');
    INSERT OR IGNORE INTO environments(environment_id,project_id,name,mode,is_live,created_by,created_at)
      VALUES ('env1','p1','Preview','preview',0,'u1','2026-01-01');
    INSERT OR IGNORE INTO workflow_versions(version_id,workflow_id,version_number,definition_json,definition_hash,schema_version,created_by,created_at)
      VALUES ('v2','w1',2,'{}','hash2',1,'u1','2026-01-02');
  `);
}

async function withAppDb<T>(run: (db: DatabaseSync) => Promise<T> | T): Promise<T> {
  const temp = tempDbPath();
  const previousDbPath = process.env.DB_PATH;
  process.env.DB_PATH = temp.file;
  closeDb();
  try {
    const db = getDb();
    seedDomain(db);
    return await run(db);
  } finally {
    closeDb();
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
    rmSync(temp.directory, { recursive: true, force: true });
  }
}

function runUpV3(db: DatabaseSync): void {
  runUpV2(db);
  const sql = requireMigration("0003_pm_p7_03_security.sql");
  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec(sql);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function runUpV2(db: DatabaseSync): void {
  const sql = requireMigration("0002_automation_events.sql");
  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec(sql);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function requireMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

test("Test 1–6: Condition A rebuild preserves execution data and foreign keys", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(requireMigration("0000_baseline.sql"));
  db.exec(requireMigration("0001_automation_domain.sql"));
  seedDomain(db);
  db.prepare(`INSERT INTO workflow_nodes
    (node_id,version_id,node_type,name,config_json,created_at)
    VALUES ('node1','v1','action','Action','{}','old-date')`).run();
  db.prepare(`INSERT INTO executions
    (execution_id,workflow_id,version_id,environment_id,status,trigger_type,trigger_actor_type,idempotency_key,trace_id,attempt_count,created_at)
    VALUES ('old-exec','w1','v1','env1','running','manual','user','old-key','trace',3,'old-date')`).run();
  db.prepare(`INSERT INTO execution_steps
    (step_id,execution_id,node_id,node_type,status,idempotency_key,created_at)
    VALUES ('step1','old-exec','node1','action','succeeded','step-key','old-date')`).run();
  db.prepare(`INSERT INTO approvals
    (approval_id,execution_id,workflow_id,approval_type,status,requested_by_type,requested_by_id,requested_at,expires_at,idempotency_key,created_at)
    VALUES ('approval1','old-exec','w1','execute','pending','user','u1','old-date','2099-01-01','approval-key','old-date')`).run();
  db.prepare("UPDATE executions SET approval_id='approval1' WHERE execution_id='old-exec'").run();
  runUpV2(db);
  const row = db.prepare("SELECT * FROM executions WHERE execution_id='old-exec'").get() as Record<string, unknown>;
  assert.equal(row.status, "running");
  assert.equal(row.attempt_count, 3);
  assert.equal(row.created_at, "old-date");
  assert.equal(row.preview, 1);
  assert.equal(row.approval_id, "approval1");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM execution_steps WHERE step_id='step1'").get()?.n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM approvals WHERE approval_id='approval1'").get()?.n, 1);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  db.close();
});

test("Test 7: Condition B final schema bootstrap migrates without losing rows", () => {
  const temp = tempDbPath();
  const db = new DatabaseSync(temp.file);
  db.exec(readFileSync(schemaPath, "utf8"));
  seedDomain(db);
  db.prepare(`INSERT INTO executions
    (execution_id,workflow_id,version_id,environment_id,status,trigger_type,trigger_actor_type,
     trigger_actor_id,idempotency_key,trace_id,attempt_count,created_at)
    VALUES ('condition-b-row','w1','v1','env1','pending','manual','user','u1','condition-b-key','condition-b-trace',4,'condition-b-created')`).run();
  db.close();

  // Use the real runner with an empty ledger over the already-bootstrapped schema.
  const result = runMigrations({ databasePath: temp.file, migrationsDir, schemaPath, log: () => undefined });
  assert.equal(result.currentVersion, 4);
  const migrated = new DatabaseSync(temp.file);
  assert.equal((migrated.prepare("PRAGMA table_info(executions)").all() as Array<{name:string}>).some((c) => c.name === "preview"), true);
  const copied = migrated.prepare("SELECT status,attempt_count,created_at,preview FROM executions WHERE execution_id='condition-b-row'").get() as {status:string;attempt_count:number;created_at:string;preview:number};
  assert.deepEqual({ ...copied }, {status:"pending",attempt_count:4,created_at:"condition-b-created",preview:1});
  assert.deepEqual(migrated.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((row) => (row as {version:number}).version), [0,1,2,3,4]);
  migrated.close();
  rmSync(temp.directory, { recursive: true, force: true });
});

test("Test 8–11: Condition C preserves event and outbox rows through migration", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(requireMigration("0000_baseline.sql"));
  db.exec(requireMigration("0001_automation_domain.sql"));
  seedDomain(db);
  const schema = readFileSync(schemaPath, "utf8");
  db.exec(schema);
  db.prepare("INSERT INTO event(event_id,project_id,payload,created_at) VALUES('ev1','p1','{\"preview\":true}','now')").run();
  db.prepare("INSERT INTO outbox(delivery_id,event_id,event_type,payload,received_at,preview,created_at) VALUES('d1','ev1','task.created','{\"preview\":true}','now',1,'now')").run();
  const eventBefore = db.prepare("SELECT * FROM event").all();
  const outboxBefore = db.prepare("SELECT * FROM outbox").all();
  runUpV2(db);
  assert.deepEqual(db.prepare("SELECT * FROM event").all(), eventBefore);
  assert.deepEqual(db.prepare("SELECT * FROM outbox").all(), outboxBefore);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  db.close();
});

test("Test 12–20: real migration runner applies 0000→0001→0002→0003 and records checksums", () => {
  const temp = tempDbPath();
  const result = runMigrations({ databasePath: temp.file, migrationsDir, schemaPath, log: () => undefined });
  assert.equal(result.currentVersion, 4);
  const db = new DatabaseSync(temp.file);
  assert.deepEqual(db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((r) => (r as {version:number}).version), [0,1,2,3,4]);
  const ledger = db.prepare("SELECT name,checksum FROM schema_migrations WHERE version=2").get() as {name:string;checksum:string};
  assert.equal(ledger.name,"automation_events");
  assert.equal(ledger.checksum,createHash("sha256").update(requireMigration("0002_automation_events.sql")).digest("hex"));
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  const columns = db.prepare("PRAGMA table_info(executions)").all() as Array<{name:string}>;
  assert.ok(columns.some((column) => column.name === "preview"));
  db.close();
  const again = runMigrations({ databasePath: temp.file, migrationsDir, schemaPath, log: () => undefined });
  assert.deepEqual(again.pendingVersions, []);
  rmSync(temp.directory, { recursive: true, force: true });

  // A2 regression: the transient executions_new table is promoted through
  // ALTER TABLE ... RENAME TO executions, so parity must require the final
  // quoted executions table in schema.sql while ignoring the scratch name.
  const schemaWithoutExecutions = tempDbPath();
  const originalSchema = readFileSync(schemaPath, "utf8");
  const strippedSchema = originalSchema.replace(
    /CREATE TABLE IF NOT EXISTS "executions"\s*\([\s\S]*?\);\s*/i,
    "",
  );
  assert.notEqual(strippedSchema, originalSchema, "quoted executions declaration must be found");
  const reducedSchemaPath = path.join(schemaWithoutExecutions.directory, "schema.sql");
  writeFileSync(reducedSchemaPath, strippedSchema);
  assert.throws(
    () => runMigrations({
      databasePath: schemaWithoutExecutions.file,
      migrationsDir,
      schemaPath: reducedSchemaPath,
      log: () => undefined,
    }),
    /executions/,
  );
  rmSync(schemaWithoutExecutions.directory, { recursive: true, force: true });
});

test("Test 14–17: checksum drift, failed migration rollback, and allow-listed FK suspension", () => {
  // A checksum change to an already-applied migration must stop before changes.
  const applied = tempDbPath();
  runMigrations({ databasePath: applied.file, migrationsDir, schemaPath, log: () => undefined });
  const altered = tempDbPath();
  for (const file of readdirSync(migrationsDir)) {
    if (file.endsWith(".sql")) copyFileSync(path.join(migrationsDir,file),path.join(altered.directory,file));
  }
  const v2Path = path.join(altered.directory,"0002_automation_events.sql");
  writeFileSync(v2Path,readFileSync(v2Path,"utf8") + "\n-- intentional checksum drift\n");
  assert.throws(() => runMigrations({ databasePath: applied.file, migrationsDir: altered.directory, schemaPath, log: () => undefined }),/checksum mismatch/);
  rmSync(applied.directory,{recursive:true,force:true});
  rmSync(altered.directory,{recursive:true,force:true});

  // A failure after the v2 rebuild must roll the entire v2 transaction back,
  // including the executions table rebuild and ledger insert.
  const failed = tempDbPath();
  const brokenTree = tempDbPath();
  for (const file of readdirSync(migrationsDir)) {
    if (file.endsWith(".sql")) copyFileSync(path.join(migrationsDir,file),path.join(brokenTree.directory,file));
  }
  const brokenV2 = path.join(brokenTree.directory,"0002_automation_events.sql");
  writeFileSync(brokenV2,readFileSync(brokenV2,"utf8") + "\nINSERT INTO __missing_pm_p7_02_table(value) VALUES ('fail');\n");
  assert.throws(() => runMigrations({ databasePath: failed.file, migrationsDir: brokenTree.directory, schemaPath, log: () => undefined }));
  const failedDb = new DatabaseSync(failed.file);
  assert.deepEqual(failedDb.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((r) => (r as {version:number}).version),[0,1]);
  assert.equal((failedDb.prepare("PRAGMA table_info(executions)").all() as Array<{name:string}>).some((column) => column.name === "preview"),false);
  assert.equal(failedDb.prepare("PRAGMA foreign_key_check").all().length,0);
  failedDb.close();
  rmSync(failed.directory,{recursive:true,force:true});
  rmSync(brokenTree.directory,{recursive:true,force:true});

  // A synthetic version 4 is not on the FK suspension allow-list.
  const v3 = tempDbPath();
  const v3Tree = tempDbPath();
  for (const file of readdirSync(migrationsDir)) {
    if (file.endsWith(".sql")) copyFileSync(path.join(migrationsDir,file),path.join(v3Tree.directory,file));
  }
  writeFileSync(path.join(v3Tree.directory,"0005_fk_probe.sql"),`CREATE TABLE fk_probe(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(user_id));\nINSERT INTO fk_probe(id,user_id) VALUES('bad','not-present');\n`);
  const v3Schema = path.join(v3Tree.directory,"schema.sql");
  writeFileSync(v3Schema,readFileSync(schemaPath,"utf8") + "\nCREATE TABLE IF NOT EXISTS fk_probe(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(user_id));\n");
  assert.throws(() => runMigrations({ databasePath:v3.file,migrationsDir:v3Tree.directory,schemaPath:v3Schema,log:()=>undefined }),/FOREIGN KEY constraint failed|Foreign-key check failed/);
  const v3Db = new DatabaseSync(v3.file);
  assert.deepEqual(v3Db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((r) => (r as {version:number}).version),[0,1,2,3,4]);
  v3Db.close();
  rmSync(v3.directory,{recursive:true,force:true});
  rmSync(v3Tree.directory,{recursive:true,force:true});
});

test("Test 21–22: fresh schema and migration path have exact sqlite_schema parity", () => {
  const fresh = new DatabaseSync(":memory:");
  fresh.exec(readFileSync(schemaPath, "utf8"));
  applyCompatibilityMigrations(fresh);
  const migrated = new DatabaseSync(":memory:");
  migrated.exec(requireMigration("0000_baseline.sql"));
  migrated.exec(requireMigration("0001_automation_domain.sql"));
  runUpV3(migrated);
  applyCompatibilityMigrations(migrated);
  const query = `SELECT type,name,tbl_name FROM sqlite_schema
    WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%'
    ORDER BY type,name`;
  assert.deepEqual(migrated.prepare(query).all(), fresh.prepare(query).all());
  fresh.close(); migrated.close();
});

test("Test 23–25: both down guards refuse independently; empty downgrade succeeds", () => {
  // Guard 1: a new execution status blocks downgrade.
  const statusCase = tempDbPath();
  runMigrations({ databasePath: statusCase.file, migrationsDir, schemaPath, log: () => undefined });
  let db = new DatabaseSync(statusCase.file);
  db.exec(`INSERT INTO users(user_id,username,email,password_hash,created_at) VALUES('u','u','u@x','h','now');
    INSERT INTO projects(project_id,name,created_by,created_at,updated_at) VALUES('p','p','u','now','now');
    INSERT INTO workflows(workflow_id,project_id,name,created_by,created_at,updated_at) VALUES('w','p','w','u','now','now');
    INSERT INTO workflow_versions(version_id,workflow_id,version_number,definition_json,definition_hash,schema_version,created_by,created_at) VALUES('v','w',1,'{}','h',1,'u','now');
    INSERT INTO environments(environment_id,project_id,name,mode,is_live,created_by,created_at) VALUES('e','p','e','preview',0,'u','now');
    INSERT INTO executions(execution_id,workflow_id,version_id,environment_id,status,trigger_type,trigger_actor_type,idempotency_key,trace_id,created_at) VALUES('x','w','v','e','created','manual','user','k','t','now');`);
  db.close();
  assert.throws(() => runMigrations({ databasePath: statusCase.file, migrationsDir, schemaPath, downToVersion: 1, log: () => undefined }));
  db = new DatabaseSync(statusCase.file);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM executions WHERE status='created'").get()?.n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name='__pm_p7_02_down_guard'").get()?.n, 0);
  db.close(); rmSync(statusCase.directory, { recursive: true, force: true });

  // Guard 2: any accepted event/outbox row blocks downgrade.
  const eventCase = tempDbPath();
  runMigrations({ databasePath: eventCase.file, migrationsDir, schemaPath, log: () => undefined });
  db = new DatabaseSync(eventCase.file);
  db.exec("INSERT INTO users(user_id,username,email,password_hash,created_at) VALUES('u','u','u@x','h','now'); INSERT INTO projects(project_id,name,created_by,created_at,updated_at) VALUES('p','p','u','now','now'); INSERT INTO event(event_id,project_id,payload,created_at) VALUES('ev','p','{}','now')");
  db.close();
  assert.throws(() => runMigrations({ databasePath: eventCase.file, migrationsDir, schemaPath, downToVersion: 1, log: () => undefined }));
  db = new DatabaseSync(eventCase.file);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event").get()?.n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name='__pm_p7_02_down_guard'").get()?.n, 0);
  db.close(); rmSync(eventCase.directory, { recursive: true, force: true });

  // An outbox row alone is independently sufficient to refuse the downgrade.
  // FK enforcement is disabled only in this corruption-oriented guard test so
  // event can remain empty while the outbox guard is exercised in isolation.
  const outboxCase = tempDbPath();
  runMigrations({ databasePath: outboxCase.file, migrationsDir, schemaPath, log: () => undefined });
  db = new DatabaseSync(outboxCase.file);
  db.exec("PRAGMA foreign_keys=OFF;");
  db.exec("INSERT INTO outbox(delivery_id,event_id,event_type,payload,received_at,preview,created_at) VALUES('orphan','missing-event','task.created','{}','now',1,'now')");
  db.close();
  assert.throws(() => runMigrations({ databasePath: outboxCase.file, migrationsDir, schemaPath, downToVersion: 1, log: () => undefined }));
  db = new DatabaseSync(outboxCase.file);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE delivery_id='orphan'").get()?.n,1);
  db.close(); rmSync(outboxCase.directory,{recursive:true,force:true});

  // With no blocking states or event data, downgrade succeeds.
  const cleanCase = tempDbPath();
  runMigrations({ databasePath: cleanCase.file, migrationsDir, schemaPath, log: () => undefined });
  const result = runMigrations({ databasePath: cleanCase.file, migrationsDir, schemaPath, downToVersion: 1, log: () => undefined });
  assert.deepEqual(result.rolledBackVersions, [4, 3, 2]);
  db = new DatabaseSync(cleanCase.file);
  assert.equal((db.prepare("PRAGMA table_info(executions)").all() as Array<{name:string}>).some((column) => column.name === "preview"), false);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  db.close(); rmSync(cleanCase.directory, { recursive: true, force: true });
});

test("Test 26–34: event validation and atomic preview-only persistence", async () => {
  await withAppDb(async (db) => {
    const missingId = await ingestEvent(db, "u1", { project_id:"p1", event_type:"task.created", payload:{} });
    assert.equal(missingId.status, 400);
    const badId = await ingestEvent(db, "u1", { project_id:"p1", delivery_id:"bad", event_type:"task.created", payload:{} });
    assert.equal(badId.status, 400);
    const authApp = express(); authApp.use("/api/automation/events",createAutomationEventsRouter(db));
    const unauthenticated = await request(authApp).post("/api/automation/events/").send({});
    assert.equal(unauthenticated.status,401);
    const badType = await ingestEvent(db, "u1", { project_id:"p1", delivery_id:"00000000-0000-4000-8000-000000000001", event_type:"unknown", payload:{} });
    assert.equal(badType.status, 400);
    const badPayload = await ingestEvent(db, "u1", { project_id:"p1", delivery_id:"00000000-0000-4000-8000-000000000001", event_type:"task.created", payload:[] });
    assert.equal(badPayload.status, 400);
    const result = await ingestEvent(db, "u1", { project_id:"p1", delivery_id:"00000000-0000-4000-8000-000000000001", event_type:"task.created", payload:{preview:false,a:1} });
    assert.equal(result.status, 202);
    const stored = db.prepare("SELECT payload FROM event").get() as {payload:string};
    assert.equal(JSON.parse(stored.payload).preview, true);
    assert.equal(db.prepare("SELECT preview FROM outbox").get()?.preview, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox").get()?.n, 1);
    const denied = await ingestEvent(db,"not-a-member",{project_id:"p1",delivery_id:"00000000-0000-4000-8000-000000000034",event_type:"task.created",payload:{}});
    assert.equal(denied.status,403);
    db.exec(`CREATE TRIGGER fail_outbox_insert BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'forced test failure'); END;`);
    const beforeEvents = Number((db.prepare("SELECT COUNT(*) AS n FROM event").get() as {n:number}).n);
    await assert.rejects(() => ingestEvent(db,"u1",{project_id:"p1",delivery_id:"00000000-0000-4000-8000-000000000035",event_type:"task.created",payload:{}}));
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM event").get() as {n:number}).n,beforeEvents);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE delivery_id='00000000-0000-4000-8000-000000000035'").get()?.n,0);
  });
});

test("Test 35–39: event idempotency, conflict, and key-order normalization", async () => {
  await withAppDb(async (db) => {
    const id = "00000000-0000-4000-8000-000000000002";
    const first = await ingestEvent(db,"u1",{project_id:"p1",delivery_id:id,event_type:"task.created",payload:{b:2,a:1}});
    const duplicate = await ingestEvent(db,"u1",{project_id:"p1",delivery_id:id,event_type:"task.created",payload:{a:1,b:2}});
    const conflictPayload = await ingestEvent(db,"u1",{project_id:"p1",delivery_id:id,event_type:"task.created",payload:{a:99,b:2}});
    const conflictType = await ingestEvent(db,"u1",{project_id:"p1",delivery_id:id,event_type:"task.updated",payload:{a:1,b:2}});
    assert.equal(first.status,202); assert.equal(duplicate.status,202);
    assert.equal(conflictPayload.status,409); assert.equal(conflictType.status,409);
    assert.equal(duplicate.body.event_id,first.body.event_id);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event").get()?.n,1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox").get()?.n,1);
    db.exec(`INSERT INTO users(user_id,username,email,password_hash,created_at) VALUES('u2','U2','u2@example.test','hash','now'),('u3','U3','u3@example.test','hash','now');
      INSERT INTO projects(project_id,name,created_by,created_at,updated_at) VALUES('p2','Project Two','u2','now','now');
      INSERT INTO project_members(project_id,user_id,role) VALUES('p1','u3','editor'),('p2','u3','editor');`);
    const delivery = "00000000-0000-4000-8000-000000000039";
    assert.equal((await ingestEvent(db,"u3",{project_id:"p1",delivery_id:delivery,event_type:"task.created",payload:{}})).status,202);
    assert.equal((await ingestEvent(db,"u3",{project_id:"p2",delivery_id:delivery,event_type:"task.created",payload:{}})).status,409);
    assert.equal((await ingestEvent(db,"u1",{project_id:"p2",delivery_id:delivery,event_type:"task.created",payload:{}})).status,403);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE delivery_id=?").get(delivery)?.n,1);
    const special = await ingestEvent(db,"u1",{project_id:"p1",delivery_id:"00000000-0000-4000-8000-000000000040",event_type:"task.created",payload:{["__proto__"]:"literal",z:1}});
    assert.equal(special.status,202);
    const specialEventId = special.body.event_id as string;
    const specialPayload = JSON.parse(
      (db.prepare("SELECT payload FROM event WHERE event_id=?").get(specialEventId) as {payload:string}).payload
    ) as Record<string,unknown>;
    assert.equal(Object.prototype.hasOwnProperty.call(specialPayload,"__proto__"),true);
    assert.equal(specialPayload["__proto__"],"literal");
  });
});

test("Test 38: concurrent identical event deliveries create one event/outbox pair", async () => {
  await withAppDb(async (db) => {
    const app = express(); app.use(express.json());
    app.use("/api/automation/events",createAutomationEventsRouter(db));
    const payload = {project_id:"p1",delivery_id:"00000000-0000-4000-8000-000000000038",event_type:"task.created",payload:{nested:{b:2,a:1}}};
    const responses = await Promise.all([
      request(app).post("/api/automation/events/").set(auth).send(payload),
      request(app).post("/api/automation/events/").set(auth).send(payload),
    ]);
    assert.deepEqual(responses.map((response) => response.status),[202,202]);
    assert.equal(responses[0]?.body.event_id,responses[1]?.body.event_id);
    const concurrentEventId = responses[0]?.body.event_id as string;
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM event WHERE event_id=?").get(concurrentEventId)?.n),1);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE delivery_id=?").get(payload.delivery_id)?.n),1);
  });
});

test("Test 40–49: preview execution creation, validation, and idempotency", async () => {
  await withAppDb(async (db) => {
    const input = {workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"exec-key"};
    const created = await createExecution(db,"u1",input);
    assert.equal(created.status,201);
    assert.equal(created.body.execution?.status,"created");
    assert.equal(created.body.execution?.preview,1);
    assert.equal(created.body.execution?.trigger_type,"manual");
    assert.equal(created.body.execution?.trigger_actor_type,"user");
    assert.equal(created.body.execution?.trigger_actor_id,"u1");
    assert.ok(created.body.execution?.trace_id);
    const duplicate = await createExecution(db,"u1",input);
    assert.equal(duplicate.status,200);
    assert.equal(duplicate.body.execution?.execution_id,created.body.execution?.execution_id);
    const conflict = await createExecution(db,"u1",{...input,version_id:"v2"});
    assert.equal(conflict.status,409);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM executions WHERE idempotency_key='exec-key'").get()?.n,1);
    const forbidden = await createExecution(db,"other-user",{...input,version_id:"does-not-exist",environment_id:"does-not-exist",idempotency_key:"other-key"});
    assert.equal(forbidden.status,403);
    assert.equal((await createExecution(db,"u1",{...input,workflow_id:"missing",idempotency_key:"missing-workflow"})).status,404);
    db.exec(`INSERT INTO workflows(workflow_id,project_id,name,created_by,created_at,updated_at) VALUES('w2','p1','Workflow Two','u1','now','now');
      INSERT INTO workflow_versions(version_id,workflow_id,version_number,definition_json,definition_hash,schema_version,created_by,created_at) VALUES('v3','w2',1,'{}','h3',1,'u1','now');
      INSERT INTO users(user_id,username,email,password_hash,created_at) VALUES('u2','u2','u2@x','h','now');
      INSERT INTO projects(project_id,name,created_by,created_at,updated_at) VALUES('p2','p2','u2','now','now');
      INSERT INTO environments(environment_id,project_id,name,mode,is_live,created_by,created_at) VALUES
        ('env2','p2','Other Project','preview',0,'u2','now'),('env-test','p1','Test','test',0,'u1','now'),('env-live','p1','Live','live',1,'u1','now');`);
    assert.equal((await createExecution(db,"u1",{...input,version_id:"v3",idempotency_key:"version-mismatch"})).status,400);
    assert.equal((await createExecution(db,"u1",{...input,environment_id:"env2",idempotency_key:"env-project-mismatch"})).status,400);
    assert.equal((await createExecution(db,"u1",{...input,environment_id:"env-test",idempotency_key:"test-env"})).status,400);
    assert.equal((await createExecution(db,"u1",{...input,environment_id:"env-live",idempotency_key:"live-env"})).status,400);
    assert.equal((await createExecution(db,"u1",{...input,idempotency_key:"client-preview",preview:false})).status,400);
  });
});

test("Test 49: concurrent identical execution creates return one record", async () => {
  await withAppDb(async (db) => {
    const app = express(); app.use(express.json());
    app.use("/api/automation/executions",createAutomationExecutionsRouter(db));
    const input = {workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"concurrent-create"};
    const responses = await Promise.all([
      request(app).post("/api/automation/executions/").set(auth).send(input),
      request(app).post("/api/automation/executions/").set(auth).send(input),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(),[200,201]);
    assert.equal(responses[0]?.body.execution.execution_id,responses[1]?.body.execution.execution_id);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM executions WHERE idempotency_key='concurrent-create'").get()?.n),1);
  });
});

test("Test 50–61: transition state machine and timestamp invariants", async () => {
  await withAppDb(async (db) => {
    const created = await createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"transition-key"});
    const id = created.body.execution!.execution_id;
    assert.equal((await transitionExecution(db,"u1",id,"pause")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"resume")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"complete")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"rollback")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"start")).status,200);
    const started = db.prepare("SELECT started_at FROM executions WHERE execution_id=?").get(id) as {started_at:string};
    assert.ok(started.started_at);
    assert.equal((await transitionExecution(db,"u1",id,"pause")).status,200);   // running -> paused
    assert.equal((await transitionExecution(db,"u1",id,"pause")).status,200);   // idempotent (already paused)
    assert.equal((await transitionExecution(db,"u1",id,"resume")).status,200);  // paused -> running
    assert.equal((await transitionExecution(db,"u1",id,"resume")).status,200);  // idempotent (already running)
    assert.equal((await transitionExecution(db,"u1",id,"start")).status,200);
    const startedAgain = db.prepare("SELECT started_at FROM executions WHERE execution_id=?").get(id) as {started_at:string};
    assert.equal(startedAgain.started_at,started.started_at);
    assert.equal((await transitionExecution(db,"u1",id,"pause")).status,200);
    assert.equal((await transitionExecution(db,"u1",id,"pause")).status,200);
    assert.equal((await transitionExecution(db,"u1",id,"resume")).status,200);
    assert.equal((await transitionExecution(db,"u1",id,"resume")).status,200);
    assert.equal((await transitionExecution(db,"u1",id,"complete")).status,200);
    assert.equal((await transitionExecution(db,"u1",id,"complete")).status,200);
    const completed = db.prepare("SELECT completed_at FROM executions WHERE execution_id=?").get(id) as {completed_at:string};
    assert.ok(completed.completed_at);
    assert.equal((await transitionExecution(db,"u1",id,"rollback")).status,200);
    assert.equal((await transitionExecution(db,"u1",id,"rollback")).status,200);
    const rolled = db.prepare("SELECT status,completed_at FROM executions WHERE execution_id=?").get(id) as {status:string;completed_at:string};
    assert.equal(rolled.status,"rolled_back"); assert.equal(rolled.completed_at,completed.completed_at);
    assert.equal((await transitionExecution(db,"u1",id,"complete")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"pause")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"start")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"resume")).status,409);
    assert.equal((await transitionExecution(db,"u1",id,"rollback")).status,200);
    const statuses = ["pending","running","awaiting_approval","succeeded","failed","cancelled","timed_out","created","paused","rolled_back","error"] as const;
    const actions = ["start","pause","resume","complete","rollback"] as const;
    const targets = {start:"running",pause:"paused",resume:"running",complete:"succeeded",rollback:"rolled_back"} as const;
    const sources = {start:["created"],pause:["running"],resume:["paused"],complete:["running"],rollback:["running","succeeded"]} as const;
    for (const state of statuses) {
      for (const action of actions) {
        db.prepare("UPDATE executions SET status=? WHERE execution_id=?").run(state,id);
        const before = db.prepare("SELECT status,started_at,completed_at FROM executions WHERE execution_id=?").get(id);
        const expected = state === targets[action] || (sources[action] as readonly string[]).includes(state) ? 200 : 409;
        const actual = await transitionExecution(db,"u1",id,action);
        assert.equal(actual.status,expected,`${action} from ${state}`);
        const after = db.prepare("SELECT status,started_at,completed_at FROM executions WHERE execution_id=?").get(id);
        if (expected === 409 || state === targets[action]) assert.deepEqual(after,before,`${action} from ${state} must not mutate an invalid/idempotent state`);
      }
    }
    db.prepare("UPDATE executions SET status='error' WHERE execution_id=?").run(id);
    const reserved = db.prepare("SELECT status FROM executions WHERE execution_id=?").get(id) as {status:string};
    assert.equal(reserved.status,"error");
    const columns = (db.prepare("PRAGMA table_info(executions)").all() as Array<{name:string}>).map((column) => column.name);
    assert.equal(columns.some((name) => ["paused_at","rollback_at","error_at"].includes(name)),false);
    assert.equal(columns.length,23);
    const executionsSql = (db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='executions'").get() as {sql:string}).sql;
    for (const status of ["pending","running","awaiting_approval","succeeded","failed","cancelled","timed_out","created","paused","rolled_back","error"]) {
      assert.ok(executionsSql.includes(`'${status}'`));
    }

    db.exec("CREATE TRIGGER fail_execution_insert BEFORE INSERT ON executions BEGIN SELECT RAISE(ABORT,'forced execution insert failure'); END;");
    await assert.rejects(() => createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"forced-create-failure"}));
    db.exec("DROP TRIGGER fail_execution_insert;");
    const failureCreate = await createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"failure-transition"});
    const failureId = failureCreate.body.execution!.execution_id;
    await transitionExecution(db,"u1",failureId,"start");
    db.exec("CREATE TRIGGER fail_execution_update BEFORE UPDATE OF status ON executions BEGIN SELECT RAISE(ABORT,'forced execution update failure'); END;");
    await assert.rejects(() => transitionExecution(db,"u1",failureId,"pause"));
    db.exec("DROP TRIGGER fail_execution_update;");
    assert.equal((db.prepare("SELECT status FROM executions WHERE execution_id=?").get(failureId) as {status:string}).status,"running");
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM executions WHERE idempotency_key='forced-create-failure'").get()?.n),0);
  });
});

test("Test 62–66: concurrent transition serialization and duplicate idempotency", async () => {
  await withAppDb(async (db) => {
    const created = await createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"race-key"});
    const id = created.body.execution!.execution_id;
    db.exec("CREATE TABLE transition_audit(execution_id TEXT, from_status TEXT, to_status TEXT);");
    db.exec(`CREATE TRIGGER audit_execution_status AFTER UPDATE OF status ON executions
      BEGIN INSERT INTO transition_audit VALUES(OLD.execution_id,OLD.status,NEW.status); END;`);
    await transitionExecution(db,"u1",id,"start");
    db.exec("DELETE FROM transition_audit;");
    const app = express();
    app.use("/api/automation/executions", createAutomationExecutionsRouter(db));
    const same = await Promise.all([
      request(app).post(`/api/automation/executions/${id}/pause`).set(auth),
      request(app).post(`/api/automation/executions/${id}/pause`).set(auth),
    ]);
    assert.deepEqual(same.map((response) => response.status).sort(),[200,200]);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM transition_audit WHERE execution_id=?").get(id)?.n,1);
    const state = db.prepare("SELECT status FROM executions WHERE execution_id=?").get(id) as {status:string};
    assert.equal(state.status,"paused");

    const competing = await createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"competing-key"});
    const competingId = competing.body.execution!.execution_id;
    await transitionExecution(db,"u1",competingId,"start");
    db.exec("DELETE FROM transition_audit;");
    const app2 = express(); app2.use("/api/automation/executions",createAutomationExecutionsRouter(db));
    const different = await Promise.all([
      request(app2).post(`/api/automation/executions/${competingId}/pause`).set(auth),
      request(app2).post(`/api/automation/executions/${competingId}/complete`).set(auth),
    ]);
    assert.deepEqual(different.map((response) => response.status).sort(),[200,409]);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM transition_audit WHERE execution_id=?").get(competingId)?.n,1);
    const competingState = db.prepare("SELECT status FROM executions WHERE execution_id=?").get(competingId) as {status:string};
    assert.ok(["paused","succeeded"].includes(competingState.status));

    const rollbackFirst = await createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"rollback-first"});
    const rollbackFirstId = rollbackFirst.body.execution!.execution_id;
    await transitionExecution(db,"u1",rollbackFirstId,"start");
    assert.equal((await transitionExecution(db,"u1",rollbackFirstId,"rollback")).status,200);
    assert.equal((await transitionExecution(db,"u1",rollbackFirstId,"complete")).status,409);

    const completeFirst = await createExecution(db,"u1",{workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"complete-first"});
    const completeFirstId = completeFirst.body.execution!.execution_id;
    await transitionExecution(db,"u1",completeFirstId,"start");
    assert.equal((await transitionExecution(db,"u1",completeFirstId,"complete")).status,200);
    const completionTime = (db.prepare("SELECT completed_at FROM executions WHERE execution_id=?").get(completeFirstId) as {completed_at:string}).completed_at;
    assert.equal((await transitionExecution(db,"u1",completeFirstId,"rollback")).status,200);
    const finalRow = db.prepare("SELECT status,completed_at FROM executions WHERE execution_id=?").get(completeFirstId) as {status:string;completed_at:string};
    assert.equal(finalRow.status,"rolled_back"); assert.equal(finalRow.completed_at,completionTime);
  });
});

test("Test 65: post-downgrade bootstrap gates executions but keeps event ingestion available", async () => {
  const temp = tempDbPath();
  const previousDbPath = process.env.DB_PATH;
  try {
    runMigrations({databasePath:temp.file,migrationsDir,schemaPath,log:()=>undefined});
    let direct = new DatabaseSync(temp.file);
    seedDomain(direct);
    direct.close();
    runMigrations({databasePath:temp.file,migrationsDir,schemaPath,downToVersion:1,log:()=>undefined});

    closeDb(); process.env.DB_PATH = temp.file;
    const db = getDb();
    seedDomain(db);
    assert.equal((db.prepare("PRAGMA table_info(executions)").all() as Array<{name:string}>).some((column) => column.name === "preview"),false);
    assert.ok(db.prepare("SELECT name FROM sqlite_schema WHERE name='event'").get());
    assert.ok(db.prepare("SELECT name FROM sqlite_schema WHERE name='outbox'").get());

    const app = express(); app.use(express.json());
    app.use("/api/automation/executions",createAutomationExecutionsRouter(db));
    app.use("/api/automation/events",createAutomationEventsRouter(db));
    for (const route of ["/","/x/start","/x/pause","/x/resume","/x/rollback","/x/complete"]) {
      assert.equal((await request(app).post(`/api/automation/executions${route}`).set(auth).send({})).status,503);
      assert.equal((await request(app).post(`/api/automation/executions${route}`).send({})).status,401);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM executions").get()?.n,0);
    const event = await request(app).post("/api/automation/events/").set(auth).send({
      project_id:"p1",delivery_id:"00000000-0000-4000-8000-000000000065",event_type:"task.created",payload:{post_downgrade:true},
    });
    assert.equal(event.status,202);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM executions").get()?.n,0);

    runMigrations({databasePath:temp.file,migrationsDir,schemaPath,log:()=>undefined});
    const execution = await request(app).post("/api/automation/executions/").set(auth).send({
      workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"post-downgrade-ready",
    });
    assert.equal(execution.status,201);
    const acceptedEventId = event.body.event_id as string;
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event WHERE event_id=?").get(acceptedEventId)?.n,1);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
  } finally {
    closeDb();
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
    rmSync(temp.directory,{recursive:true,force:true});
  }
});

test("Test 67: Condition C readiness is checked per request and auth runs first", async () => {
  const temp = tempDbPath();
  const previousDbPath = process.env.DB_PATH;
  try {
  const old = new DatabaseSync(temp.file);
  old.exec(requireMigration("0000_baseline.sql"));
  old.exec(requireMigration("0001_automation_domain.sql"));
  old.close();
  process.env.DB_PATH = temp.file;
  closeDb();
  const db = getDb();
  seedDomain(db);
  const app = express(); app.use(express.json());
  app.use("/api/automation/executions", createAutomationExecutionsRouter(db));
  app.use("/api/automation/events", createAutomationEventsRouter(db));
  for (const pathName of ["/", "/missing/start", "/missing/pause", "/missing/resume", "/missing/rollback", "/missing/complete"]) {
    const unauthenticated = await request(app).post(`/api/automation/executions${pathName}`).send({});
    assert.equal(unauthenticated.status,401);
    const response = await request(app).post(`/api/automation/executions${pathName}`).set(auth).send({});
    assert.equal(response.status,503);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM executions").get()?.n,0);
  const event = await request(app).post("/api/automation/events/").set(auth).send({
    project_id:"p1",delivery_id:"00000000-0000-4000-8000-000000000067",event_type:"task.created",payload:{x:1},
  });
  assert.equal(event.status,202);
  runMigrations({databasePath:temp.file,migrationsDir,schemaPath,log:()=>undefined});
  const ready = await request(app).post("/api/automation/executions/").set(auth).send({
    workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"after-migration",
  });
  assert.equal(ready.status,201);
  const otherToken = jwt.sign({ user_id: "not-a-member", email: "other@example.test", role: "owner" }, jwtSecret);
  const otherAuth = { Authorization: `Bearer ${otherToken}` };
  const executionId = ready.body.execution.execution_id as string;
  const deniedCreate = await request(app).post("/api/automation/executions/").set(otherAuth).send({
    workflow_id:"w1",version_id:"v1",environment_id:"env1",idempotency_key:"unauthorized-create",
  });
  assert.equal(deniedCreate.status,403);
  for (const action of ["start","pause","resume","rollback","complete"]) {
    const denied = await request(app).post(`/api/automation/executions/${executionId}/${action}`).set(otherAuth);
    assert.equal(denied.status,403);
  }
  } finally {
    closeDb();
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
    rmSync(temp.directory,{recursive:true,force:true});
  }
});

