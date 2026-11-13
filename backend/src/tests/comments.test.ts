import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "pm-comments-owner";
const EDITOR_ID = "pm-comments-editor";
const VIEWER_ID = "pm-comments-viewer";
const PROJECT_ID = "pm-comments-project";
const TASK_ID = "pm-comments-task";

const JWT_SECRET = "pm-comments-test-secret-with-sufficient-length";

let app: Express;
let databaseDirectory = "";
let ownerToken = "";
let editorToken = "";
let viewerToken = "";

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
    .run(taskId, projectId, "Test Task", "A test task", creatorId, now, now);
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "pm-comments-"));
  process.env.DB_PATH = path.join(databaseDirectory, "comments.db");

  getDb();

  seedUser(OWNER_ID, "owner@comments.example", "owner");
  seedUser(EDITOR_ID, "editor@comments.example", "editor");
  seedUser(VIEWER_ID, "viewer@comments.example", "viewer");
  seedProject(PROJECT_ID, OWNER_ID);
  // Add project_members so non-creator users have project access (F1 scoping)
  getDb()
    .prepare(`INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`)
    .run(PROJECT_ID, EDITOR_ID, "editor");
  getDb()
    .prepare(`INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`)
    .run(PROJECT_ID, VIEWER_ID, "viewer");
  seedTask(TASK_ID, PROJECT_ID, OWNER_ID);

  const serverModule = await import("../index.ts");
  app = serverModule.app;

  ownerToken = tokenFor(OWNER_ID, "owner@comments.example", "owner");
  editorToken = tokenFor(EDITOR_ID, "editor@comments.example", "editor");
  viewerToken = tokenFor(VIEWER_ID, "viewer@comments.example", "viewer");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

describe("MC-005 comment CRUD", () => {
  test("unauthenticated requests are rejected", async () => {
    const create = await request(app)
      .post("/api/comments")
      .send({ task_id: TASK_ID, body: "hello" });
    assert.equal(create.status, 401);

    const list = await request(app).get("/api/comments?task_id=" + TASK_ID);
    assert.equal(list.status, 401);
  });

  test("create a comment on a task", async () => {
    const created = await request(app)
      .post("/api/comments")
      .set(auth(ownerToken))
      .send({ task_id: TASK_ID, body: "First comment" });

    assert.equal(created.status, 201);
    assert.equal(created.body.comment.task_id, TASK_ID);
    assert.equal(created.body.comment.body, "First comment");
    assert.equal(created.body.comment.author_id, OWNER_ID);
    assert.ok(created.body.comment.comment_id);
  });

  test("list comments for a task", async () => {
    await request(app)
      .post("/api/comments")
      .set(auth(editorToken))
      .send({ task_id: TASK_ID, body: "Second comment" });

    const listed = await request(app)
      .get("/api/comments?task_id=" + TASK_ID)
      .set(auth(viewerToken));

    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.body.comments));
    assert.equal(listed.body.comments.length, 2);
    const bodies = listed.body.comments.map((c: { body: string }) => c.body);
    assert.ok(bodies.includes("First comment"));
    assert.ok(bodies.includes("Second comment"));
  });

  test("returns empty list for a task with no comments", async () => {
    const emptyTaskId = "pm-comments-empty-task";
    const listed = await request(app)
      .get("/api/comments?task_id=" + emptyTaskId)
      .set(auth(viewerToken));
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.comments, []);
  });

  test("rejects comment for a non-existent task", async () => {
    const created = await request(app)
      .post("/api/comments")
      .set(auth(ownerToken))
      .send({ task_id: "non-existent-task", body: "orphan comment" });

    // Comments table has FK to tasks; inserting a non-existent task_id should fail or be rejected
    // We assert the API handles this gracefully (400 or 500 with no comment created)
    assert.ok(created.status >= 400);
  });

  test("update a comment (author can edit)", async () => {
    const created = await request(app)
      .post("/api/comments")
      .set(auth(ownerToken))
      .send({ task_id: TASK_ID, body: "Original body" });

    const commentId = created.body.comment.comment_id;

    const updated = await request(app)
      .put("/api/comments/" + commentId)
      .set(auth(ownerToken))
      .send({ body: "Updated body" });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.comment.body, "Updated body");
  });

  test("update a non-existent comment returns 404", async () => {
    const updated = await request(app)
      .put("/api/comments/non-existent-comment-id")
      .set(auth(ownerToken))
      .send({ body: "nope" });

    assert.equal(updated.status, 404);
  });

  test("delete a comment", async () => {
    const created = await request(app)
      .post("/api/comments")
      .set(auth(editorToken))
      .send({ task_id: TASK_ID, body: "To be deleted" });

    const commentId = created.body.comment.comment_id;

    const deleted = await request(app)
      .delete("/api/comments/" + commentId)
      .set(auth(editorToken));

    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.message, "Comment deleted");

    const listed = await request(app)
      .get("/api/comments?task_id=" + TASK_ID)
      .set(auth(viewerToken));
    assert.equal(listed.status, 200);
    assert.ok(
      !listed.body.comments.some((c: { comment_id: string }) => c.comment_id === commentId),
    );
  });

  test("delete a non-existent comment returns 404", async () => {
    const deleted = await request(app)
      .delete("/api/comments/non-existent-comment-id")
      .set(auth(ownerToken));

    assert.equal(deleted.status, 404);
  });

  test("comments remain scoped to their task (cross-task isolation)", async () => {
    // Create a comment on TASK_ID
    const created = await request(app)
      .post("/api/comments")
      .set(auth(ownerToken))
      .send({ task_id: TASK_ID, body: "Isolation test comment" });

    // Try to list with a different task_id - should not return this comment
    const listed = await request(app)
      .get("/api/comments?task_id=other-task")
      .set(auth(viewerToken));
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.comments, []);
  });
});
