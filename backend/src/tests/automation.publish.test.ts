import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "pm-p706-api-owner";
const VIEWER_ID = "pm-p706-api-viewer";
const PROJECT_ID = "pm-p706-api-project";
const JWT_SECRET = "***";

let app: Express;
let databaseDirectory = "";
let ownerToken = "";
let viewerToken = "";

function tokenFor(userId: string, email: string): string {
  return jwt.sign({ user_id: userId, email, role: "admin" }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function seedUser(userId: string, email: string): void {
  getDb()
    .prepare(
      `INSERT INTO users (
        user_id, username, email, password_hash, role, status, created_at
      ) VALUES (?, ?, ?, 'test-hash', 'admin', 'active', ?)`,
    )
    .run(userId, userId, email, new Date().toISOString());
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

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "pm-p706-publish-"));
  process.env.DB_PATH = path.join(databaseDirectory, "publish.db");

  getDb();

  seedUser(OWNER_ID, "owner@publish.example");
  seedUser(VIEWER_ID, "viewer@publish.example");
  seedProject(PROJECT_ID, OWNER_ID);

  const serverModule = await import("../index.ts");
  app = serverModule.app;

  ownerToken = tokenFor(OWNER_ID, "owner@publish.example");
  viewerToken = tokenFor(VIEWER_ID, "viewer@publish.example");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

test("PM-P7-06 publish workflow returns 423 in preview-only mode", async (t) => {
  await t.test("publish on draft workflow returns 423 RUNTIME_DISABLED", async () => {
    const created = await request(app)
      .post("/api/v1/automation/workflows")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        name: "PM-P7-06 Publish Test",
        description: "Draft workflow for publish lifecycle test",
      });

    assert.equal(created.status, 201);
    assert.equal(created.body.workflow.status, "draft");
    const workflowId = created.body.workflow.workflow_id;

    const version = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/versions`)
      .set(auth(ownerToken))
      .send({});

    assert.equal(version.status, 201);

    const publish = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/publish`)
      .set(auth(ownerToken));

    assert.equal(publish.status, 423);
    assert.equal(publish.body.code, "RUNTIME_DISABLED");
  });

  await t.test("publish returns 409 when workflow is not draft", async () => {
    const created = await request(app)
      .post("/api/v1/automation/workflows")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        name: "PM-P7-06 Non-Draft Publish",
        description: "Workflow already published",
      });

    assert.equal(created.status, 201);
    const workflowId = created.body.workflow.workflow_id;

    const version = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/versions`)
      .set(auth(ownerToken))
      .send({});

    assert.equal(version.status, 201);

    // First publish attempt returns 423 (preview-only), so status stays draft
    const publish1 = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/publish`)
      .set(auth(ownerToken));
    assert.equal(publish1.status, 423);

    // Manually set status to published to test non-draft rejection
    getDb()
      .prepare(`UPDATE workflows SET status = 'published' WHERE workflow_id = ?`)
      .run(workflowId);

    const publish2 = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/publish`)
      .set(auth(ownerToken));
    assert.equal(publish2.status, 409);
    assert.equal(publish2.body.code, "WORKFLOW_NOT_DRAFT");
  });

  await t.test("publish rejects viewer (no write access)", async () => {
    const created = await request(app)
      .post("/api/v1/automation/workflows")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        name: "PM-P7-06 Viewer Publish",
        description: "Viewer should not publish",
      });

    assert.equal(created.status, 201);
    const workflowId = created.body.workflow.workflow_id;

    const version = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/versions`)
      .set(auth(ownerToken))
      .send({});

    assert.equal(version.status, 201);

    const publish = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/publish`)
      .set(auth(viewerToken));

    assert.equal(publish.status, 404);
  });

  await t.test("publish returns 404 for missing workflow", async () => {
    const publish = await request(app)
      .post("/api/v1/automation/workflows/pm-p706-missing-workflow/publish")
      .set(auth(ownerToken));

    assert.equal(publish.status, 404);
  });
});

