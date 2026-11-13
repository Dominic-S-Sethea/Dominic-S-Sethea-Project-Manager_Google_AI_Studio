import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "pm-rbac-owner";
const EDITOR_ID = "pm-rbac-editor";
const VIEWER_ID = "pm-rbac-viewer";
const COMMENTER_ID = "pm-rbac-commenter";
const PROJECT_ID = "pm-rbac-project";
const TASK_A_ID = "pm-rbac-task-a";
const TASK_B_ID = "pm-rbac-task-b";

const JWT_SECRET = "pm-rbac-test-secret-with-sufficient-length";

let app: Express;
let databaseDirectory = "";
let tokens: Record<string, string> = {};

function tokenFor(userId: string, email: string, role: string): string {
  return jwt.sign(
    { user_id: userId, email, role },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function auth(userId: string): { Authorization: string } {
  return { Authorization: `Bearer ${tokens[userId]}` };
}

function seedUser(userId: string, email: string, role: string): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO users (
        user_id, username, email, password_hash, role, status, created_at
      ) VALUES (?, ?, ?, 'test-hash', ?, 'active', ?)`,
    )
    .run(userId, userId, email, role, new Date().toISOString());
}

function seedProject(projectId: string, creatorId: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO projects (
        project_id, name, description, status, created_by, created_at, updated_at
      ) VALUES (?, ?, NULL, 'active', ?, ?, ?)`,
    )
    .run(projectId, projectId, creatorId, now, now);
}

function seedTask(taskId: string, projectId: string, creatorId: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO tasks (
        task_id, project_id, title, description, status, priority, assignee_id, created_by, metadata, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'todo', 'normal', NULL, ?, '{}', NULL, ?, ?)`,
    )
    .run(taskId, projectId, `Task ${taskId}`, "A test task", creatorId, now, now);
}

function reseedCore() {
  seedProject(PROJECT_ID, OWNER_ID);
  // Add project_members so non-creator users have project access (F1 scoping)
  getDb()
    .prepare(`INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`)
    .run(PROJECT_ID, EDITOR_ID, "editor");
  getDb()
    .prepare(`INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`)
    .run(PROJECT_ID, VIEWER_ID, "viewer");
  getDb()
    .prepare(`INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`)
    .run(PROJECT_ID, COMMENTER_ID, "commenter");
  seedTask(TASK_A_ID, PROJECT_ID, EDITOR_ID);
  seedTask(TASK_B_ID, PROJECT_ID, OWNER_ID);
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "pm-rbac-"));
  process.env.DB_PATH = path.join(databaseDirectory, "rbac.db");

  getDb();

  seedUser(OWNER_ID, "owner@rbac.example", "owner");
  seedUser(EDITOR_ID, "editor@rbac.example", "editor");
  seedUser(VIEWER_ID, "viewer@rbac.example", "viewer");
  seedUser(COMMENTER_ID, "commenter@rbac.example", "commenter");

  seedProject(PROJECT_ID, OWNER_ID);
  seedTask(TASK_A_ID, PROJECT_ID, EDITOR_ID);
  seedTask(TASK_B_ID, PROJECT_ID, OWNER_ID);

  const serverModule = await import("../index.ts");
  app = serverModule.app;

  tokens[OWNER_ID] = tokenFor(OWNER_ID, "owner@rbac.example", "owner");
  tokens[EDITOR_ID] = tokenFor(EDITOR_ID, "editor@rbac.example", "editor");
  tokens[VIEWER_ID] = tokenFor(VIEWER_ID, "viewer@rbac.example", "viewer");
  tokens[COMMENTER_ID] = tokenFor(COMMENTER_ID, "commenter@rbac.example", "commenter");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

describe("MC-006 RBAC enforcement", () => {
  // ── Projects ──
  describe("Projects routes", () => {
    test("viewer can GET projects (read-only)", async () => {
      const res = await request(app).get("/api/projects").set(auth(VIEWER_ID));
      assert.equal(res.status, 200);
    });

    test("viewer cannot POST project (403)", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set(auth(VIEWER_ID))
        .send({ name: "Viewer Project" });
      assert.equal(res.status, 403);
    });

    test("viewer cannot PUT project (403)", async () => {
      const res = await request(app)
        .put(`/api/projects/${PROJECT_ID}`)
        .set(auth(VIEWER_ID))
        .send({ name: "Changed" });
      assert.equal(res.status, 403);
    });

    test("viewer cannot DELETE project (403)", async () => {
      const res = await request(app)
        .delete(`/api/projects/${PROJECT_ID}`)
        .set(auth(VIEWER_ID));
      assert.equal(res.status, 403);
    });

    test("editor can POST project (201)", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set(auth(EDITOR_ID))
        .send({ name: "Editor Project" });
      assert.equal(res.status, 201);
    });

    test("editor cannot PUT project they do not own (403)", async () => {
      const res = await request(app)
        .put(`/api/projects/${PROJECT_ID}`)
        .set(auth(EDITOR_ID))
        .send({ name: "Changed" });
      assert.equal(res.status, 403);
    });

    test("owner can PUT any project (200)", async () => {
      const res = await request(app)
        .put(`/api/projects/${PROJECT_ID}`)
        .set(auth(OWNER_ID))
        .send({ name: "Owner Changed" });
      assert.equal(res.status, 200);
    });

    test("owner can DELETE any project (200)", async () => {
      const res = await request(app)
        .delete(`/api/projects/${PROJECT_ID}`)
        .set(auth(OWNER_ID));
      assert.equal(res.status, 200);
    });
  });

  // ── Tasks ──
  describe("Tasks routes", () => {
    before(() => {
      reseedCore();
    });

    test("viewer can GET tasks (read-only)", async () => {
      const res = await request(app).get("/api/tasks").set(auth(VIEWER_ID));
      assert.equal(res.status, 200);
    });

    test("viewer cannot POST task (403)", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set(auth(VIEWER_ID))
        .send({ project_id: PROJECT_ID, title: "Viewer Task" });
      assert.equal(res.status, 403);
    });

    test("editor can POST task (201)", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set(auth(EDITOR_ID))
        .send({ project_id: PROJECT_ID, title: "Editor Task" });
      assert.equal(res.status, 201);
    });

    test("editor cannot PUT task they do not own (403)", async () => {
      const res = await request(app)
        .put(`/api/tasks/${TASK_B_ID}`)
        .set(auth(EDITOR_ID))
        .send({ title: "Changed" });
      assert.equal(res.status, 403);
    });

    test("editor can PUT task they own (200)", async () => {
      const res = await request(app)
        .put(`/api/tasks/${TASK_A_ID}`)
        .set(auth(EDITOR_ID))
        .send({ title: "Editor Changed" });
      assert.equal(res.status, 200);
    });

    test("editor cannot DELETE task they do not own (403)", async () => {
      const res = await request(app)
        .delete(`/api/tasks/${TASK_B_ID}`)
        .set(auth(EDITOR_ID));
      assert.equal(res.status, 403);
    });

    test("owner can DELETE any task (200)", async () => {
      const res = await request(app)
        .delete(`/api/tasks/${TASK_A_ID}`)
        .set(auth(OWNER_ID));
      assert.equal(res.status, 200);
    });
  });

  // ── Comments ──
  describe("Comments routes", () => {
    before(() => {
      reseedCore();
    });

    test("viewer can GET comments (read-only)", async () => {
      const res = await request(app)
        .get("/api/comments")
        .query({ task_id: TASK_A_ID })
        .set(auth(VIEWER_ID));
      assert.equal(res.status, 200);
    });

    test("commenter can POST comment (201)", async () => {
      const res = await request(app)
        .post("/api/comments")
        .set(auth(COMMENTER_ID))
        .send({ task_id: TASK_A_ID, body: "A comment" });
      assert.equal(res.status, 201);
    });

    test("viewer cannot POST comment (403)", async () => {
      const res = await request(app)
        .post("/api/comments")
        .set(auth(VIEWER_ID))
        .send({ task_id: TASK_A_ID, body: "A comment" });
      assert.equal(res.status, 403);
    });

    test("commenter can update own comment (200)", async () => {
      const createRes = await request(app)
        .post("/api/comments")
        .set(auth(COMMENTER_ID))
        .send({ task_id: TASK_A_ID, body: "Original" });
      const commentId = createRes.body.comment.comment_id;

      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set(auth(COMMENTER_ID))
        .send({ body: "Updated" });
      assert.equal(res.status, 200);
    });

    test("commenter cannot update another user's comment (403)", async () => {
      const createRes = await request(app)
        .post("/api/comments")
        .set(auth(OWNER_ID))
        .send({ task_id: TASK_A_ID, body: "Owner comment" });
      const commentId = createRes.body.comment.comment_id;

      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set(auth(COMMENTER_ID))
        .send({ body: "Hacked" });
      assert.equal(res.status, 403);
    });

    test("owner can update any comment (200)", async () => {
      const createRes = await request(app)
        .post("/api/comments")
        .set(auth(COMMENTER_ID))
        .send({ task_id: TASK_A_ID, body: "For owner to edit" });
      const commentId = createRes.body.comment.comment_id;

      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set(auth(OWNER_ID))
        .send({ body: "Owner edited" });
      assert.equal(res.status, 200);
    });
  });

  // ── Dependencies ──
  describe("Dependencies routes", () => {
    before(() => {
      reseedCore();
    });

    test("viewer can GET dependencies (read-only)", async () => {
      const res = await request(app)
        .get("/api/dependencies")
        .set(auth(VIEWER_ID));
      assert.equal(res.status, 200);
    });

    test("viewer cannot POST dependency (403)", async () => {
      const res = await request(app)
        .post("/api/dependencies")
        .set(auth(VIEWER_ID))
        .send({ task_id: TASK_A_ID, depends_on_id: TASK_B_ID });
      assert.equal(res.status, 403);
    });
  });

  // ── Users ──
  describe("Users routes", () => {
    test("editor cannot assign owner role (403)", async () => {
      const res = await request(app)
        .post("/api/users")
        .set(auth(EDITOR_ID))
        .send({
          username: "newuser",
          email: "newuser@example.com",
          password: "password123",
          role: "owner",
        });
      assert.equal(res.status, 403);
    });

    test("owner can assign owner role (201)", async () => {
      const res = await request(app)
        .post("/api/users")
        .set(auth(OWNER_ID))
        .send({
          username: "owneduser",
          email: "owneduser@example.com",
          password: "password123",
          role: "owner",
        });
      assert.equal(res.status, 201);
    });

    test("editor cannot change another user's role (403)", async () => {
      const res = await request(app)
        .put(`/api/users/${VIEWER_ID}`)
        .set(auth(EDITOR_ID))
        .send({ role: "editor" });
      assert.equal(res.status, 403);
    });

    test("editor cannot self-promote to owner (403)", async () => {
      const res = await request(app)
        .put(`/api/users/${EDITOR_ID}`)
        .set(auth(EDITOR_ID))
        .send({ role: "owner" });
      assert.equal(res.status, 403);
    });
  });
});
