/**
 * PHASE2_03 §6.6 coverage matrix — verifies that the audit trail is actually
 * written for the domains the matrix marks as required.
 *
 * Covered here: checklists/items (create/update/delete), dependencies
 * (create/delete), comments (create/update/delete) and auth/login.
 *
 * Runs against an isolated temporary SQLite database (DB_PATH).
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "audit-coverage-owner";
const JWT_SECRET = "audit-coverage-test-secret-with-sufficient-length";

let app: Express;
let databaseDirectory = "";
let ownerToken = "";
let projectId = "";
let taskId = "";

function tokenFor(userId: string, role: string): string {
  return jwt.sign(
    { user_id: userId, email: `${userId}@test.local`, role },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function actionsFor(action: string): number {
  return (getDb()
    .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = ?")
    .get(action) as { n: number }).n;
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "audit-coverage-"));
  process.env.DB_PATH = path.join(databaseDirectory, "audit-coverage.db");

  getDb();
  getDb()
    .prepare(
      `INSERT INTO users (user_id, username, email, password_hash, role, status, created_at)
       VALUES (?, ?, ?, 'test-hash', ?, 'active', ?)`,
    )
    .run(OWNER_ID, "auditowner", `${OWNER_ID}@test.local`, "owner", new Date().toISOString());

  const serverModule = await import("../index.ts");
  app = serverModule.app;
  ownerToken = tokenFor(OWNER_ID, "owner");

  const project = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Audit Coverage Project" });
  projectId = project.body.project.project_id;

  const task = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ project_id: projectId, title: "Audit Coverage Task" });
  taskId = task.body.task.task_id;
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

test("§6.6 checklists/items: create, update and delete are audited", async () => {
  const created = await request(app)
    .post("/api/checklists")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ task_id: taskId, title: "Coverage checklist", items: [{ content: "item" }] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const checklistId = created.body.checklist.checklist_id;
  assert.ok(actionsFor("checklist.created") >= 1, "checklist.created must be audited");

  const updated = await request(app)
    .put(`/api/checklists/${checklistId}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Coverage checklist v2" });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.ok(actionsFor("checklist.updated") >= 1, "checklist.updated must be audited");

  const deleted = await request(app)
    .delete(`/api/checklists/${checklistId}`)
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.ok(actionsFor("checklist.deleted") >= 1, "checklist.deleted must be audited");
});

test("§6.6 dependencies: create and delete are audited", async () => {
  const other = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ project_id: projectId, title: "Dependency target" });
  const otherTaskId = other.body.task.task_id;

  const created = await request(app)
    .post("/api/dependencies")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ task_id: taskId, depends_on_id: otherTaskId, dependency_type: "blocked_by" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const dependencyId = created.body.dependency.id;
  assert.ok(actionsFor("dependency.created") >= 1, "dependency.created must be audited");

  const deleted = await request(app)
    .delete(`/api/dependencies/${dependencyId}`)
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.ok(actionsFor("dependency.deleted") >= 1, "dependency.deleted must be audited");
});

test("§6.6 comments: create, update and delete are audited", async () => {
  const created = await request(app)
    .post("/api/comments")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ task_id: taskId, body: "Coverage comment" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const commentId = created.body.comment.comment_id;
  assert.ok(actionsFor("comment.created") >= 1, "comment.created must be audited");

  const updated = await request(app)
    .put(`/api/comments/${commentId}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ body: "Coverage comment v2" });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.ok(actionsFor("comment.updated") >= 1, "comment.updated must be audited");

  const deleted = await request(app)
    .delete(`/api/comments/${commentId}`)
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.ok(actionsFor("comment.deleted") >= 1, "comment.deleted must be audited");
});

test("§6.6 auth/login: a successful login is audited", async () => {
  const email = `audit-login-${Date.now()}@test.local`;
  const password = "Audit-Login-Pw-1";
  const registered = await request(app)
    .post("/api/auth/register")
    .send({ username: "auditlogin", email, password });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));

  const before = actionsFor("auth.login");
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(actionsFor("auth.login"), before + 1, "auth.login must be audited once");
});

test("§6.6 import: a JSON import is audited", async () => {
  const before = actionsFor("import.completed");
  const result = await request(app)
    .post("/api/import-export/import/json")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ projects: [], tasks: [], users: [] });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(
    actionsFor("import.completed"),
    before + 1,
    "import.completed must be audited once",
  );
});
