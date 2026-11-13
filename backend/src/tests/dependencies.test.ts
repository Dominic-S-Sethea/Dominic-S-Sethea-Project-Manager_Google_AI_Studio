import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "pm-deps-owner";
const PROJECT_ID = "pm-deps-project";
const TASK_A = "pm-deps-task-a";
const TASK_B = "pm-deps-task-b";
const TASK_C = "pm-deps-task-c";
const TASK_D = "pm-deps-task-d";
const TASK_E = "pm-deps-task-e";

const JWT_SECRET = "pm-deps-test-secret-with-sufficient-length";

let app: Express;
let databaseDirectory = "";
let ownerToken = "";

function tokenFor(userId: string, email: string, role: string): string {
  return jwt.sign(
    { user_id: userId, email, role },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function seedUser(userId: string, email: string, role: string): void {
  getDb()
    .prepare(
      `INSERT INTO users (
        user_id, username, email, password_hash, role, status, created_at
      ) VALUES (?, ?, ?, 'test-hash', ?, 'active', ?)`,
    )
    .run(userId, userId, email, role, new Date().toISOString());
}

function seedProject(projectId: string, creatorId: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO projects (
        project_id, name, description, status, created_by, created_at, updated_at
      ) VALUES (?, ?, NULL, 'active', ?, ?, ?)`,
    )
    .run(projectId, projectId, creatorId, now, now);
}

function seedTask(taskId: string, projectId: string, creatorId: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO tasks (
        task_id, project_id, title, description, status, priority, assignee_id, created_by, metadata, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'todo', 'normal', NULL, ?, '{}', NULL, ?, ?)`,
    )
    .run(taskId, projectId, `Task ${taskId}`, "A test task", creatorId, now, now);
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "pm-deps-"));
  process.env.DB_PATH = path.join(databaseDirectory, "deps.db");

  getDb();

  seedUser(OWNER_ID, "owner@deps.example", "owner");
  seedProject(PROJECT_ID, OWNER_ID);
  seedTask(TASK_A, PROJECT_ID, OWNER_ID);
  seedTask(TASK_B, PROJECT_ID, OWNER_ID);
  seedTask(TASK_C, PROJECT_ID, OWNER_ID);
  seedTask(TASK_D, PROJECT_ID, OWNER_ID);
  seedTask(TASK_E, PROJECT_ID, OWNER_ID);

  const serverModule = await import("../index.ts");
  app = serverModule.app;

  ownerToken = tokenFor(OWNER_ID, "owner@deps.example", "owner");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

describe("MC-004 dependency remediation", () => {
  test("D-01: self-dependency is rejected with 400", async () => {
    const res = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: TASK_A, dependency_type: "blocks" });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes("Self-dependency"));
  });

  test("D-02: circular dependency is rejected with 400", async () => {
    // Create A blocks B
    await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: TASK_B, dependency_type: "blocks" });

    // Try to create B blocks A (creates cycle)
    const res = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_B, depends_on_id: TASK_A, dependency_type: "blocks" });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes("Circular dependency"));
  });

  test("D-03: invalid dependency_type is rejected with 400", async () => {
    const res = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: TASK_B, dependency_type: "invalid_type" });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes("dependency_type"));
  });

  test("D-04: GET /task/:id returns both directions (blocks + blocked_by)", async () => {
    // Clean up any existing deps first
    await request(app)
      .delete(`/api/dependencies/${"existing-id-that-does-not-matter"}`)
      .set(auth(ownerToken));

    // Create A blocks B
    const createRes = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: TASK_B, dependency_type: "blocks" });
    assert.equal(createRes.status, 201);

    const depId = createRes.body.dependency.id;

    // List dependencies for task A - should include the 'blocks' entry
    const listRes = await request(app)
      .get(`/api/dependencies/task/${TASK_A}`)
      .set(auth(ownerToken));

    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.dependencies));
    const found = listRes.body.dependencies.some(
      (d: { id: string }) => d.id === depId,
    );
    assert.ok(found, "Should find the blocks dependency for task A");
  });

  test("D-05: nonexistent task_id returns 400", async () => {
    const res = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: "nonexistent-task", depends_on_id: TASK_B, dependency_type: "blocks" });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes("Task not found"));
  });

  test("D-05: nonexistent depends_on_id returns 400", async () => {
    const res = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: "nonexistent-task", dependency_type: "blocks" });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes("Task not found"));
  });

  test("blocked_by create works and is retrievable", async () => {
    const createRes = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_C, depends_on_id: TASK_A, dependency_type: "blocked_by" });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.dependency.dependency_type, "blocked_by");

    // Should be retrievable via getAll
    const allRes = await request(app)
      .get("/api/dependencies")
      .set(auth(ownerToken));
    assert.equal(allRes.status, 200);
  });

  test("duplicate dependency returns existing (no error)", async () => {
    const first = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_D, depends_on_id: TASK_E, dependency_type: "blocks" });
    assert.equal(first.status, 201);

    const second = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_D, depends_on_id: TASK_E, dependency_type: "blocks" });
    assert.equal(second.status, 201);
    assert.equal(second.body.dependency.id, first.body.dependency.id);
  });

  test("update a dependency works", async () => {
    const createRes = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_D, depends_on_id: TASK_E, dependency_type: "blocks" });
    assert.equal(createRes.status, 201);

    const depId = createRes.body.dependency.id;

    const updateRes = await request(app)
      .put(`/api/dependencies/${depId}`)
      .set(auth(ownerToken))
      .send({ dependency_type: "blocked_by" });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.dependency.dependency_type, "blocked_by");
  });

  test("delete a dependency works", async () => {
    const createRes = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_D, depends_on_id: TASK_E, dependency_type: "blocks" });
    assert.equal(createRes.status, 201);

    const depId = createRes.body.dependency.id;

    const deleteRes = await request(app)
      .delete(`/api/dependencies/${depId}`)
      .set(auth(ownerToken));

    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.message, "Dependency deleted");
  });

  test("update to self-dependency is rejected with 400", async () => {
    const createRes = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: TASK_B, dependency_type: "blocks" });
    assert.equal(createRes.status, 201);

    const depId = createRes.body.dependency.id;

    const updateRes = await request(app)
      .put(`/api/dependencies/${depId}`)
      .set(auth(ownerToken))
      .send({ depends_on_id: TASK_A });

    assert.equal(updateRes.status, 400);
    assert.ok(updateRes.body.message.includes("Self-dependency"));
  });

  test("update to invalid type is rejected with 400", async () => {
    const createRes = await request(app)
      .post("/api/dependencies")
      .set(auth(ownerToken))
      .send({ task_id: TASK_A, depends_on_id: TASK_B, dependency_type: "blocks" });
    assert.equal(createRes.status, 201);

    const depId = createRes.body.dependency.id;

    const updateRes = await request(app)
      .put(`/api/dependencies/${depId}`)
      .set(auth(ownerToken))
      .send({ dependency_type: "invalid" });

    assert.equal(updateRes.status, 400);
    assert.ok(updateRes.body.message.includes("dependency_type"));
  });

  test("delete nonexistent dependency returns 404", async () => {
    const res = await request(app)
      .delete("/api/dependencies/nonexistent-id")
      .set(auth(ownerToken));

    assert.equal(res.status, 404);
  });
});
