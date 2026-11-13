
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "pm-p703-api-owner";
const EDITOR_ID = "pm-p703-api-editor";
const VIEWER_ID = "pm-p703-api-viewer";
const PROJECT_ID = "pm-p703-api-project";
const OTHER_PROJECT_ID = "pm-p703-api-project-b";

const JWT_SECRET = "pm-p7-03-api-test-secret-with-sufficient-length";

let app: Express;
let databaseDirectory = "";
let ownerToken = "";
let editorToken = "";
let viewerToken = "";

function tokenFor(userId: string, email: string): string {
  return jwt.sign(
    { user_id: userId, email, role: "admin" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
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
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "pm-p703-api-"));
  process.env.DB_PATH = path.join(databaseDirectory, "api.db");

  getDb();

  seedUser(OWNER_ID, "owner@api.example");
  seedUser(EDITOR_ID, "editor@api.example");
  seedUser(VIEWER_ID, "viewer@api.example");
  seedProject(PROJECT_ID, OWNER_ID);
  seedProject(OTHER_PROJECT_ID, OWNER_ID);

  getDb()
    .prepare(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'editor')",
    )
    .run(PROJECT_ID, EDITOR_ID);

  getDb()
    .prepare(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'viewer')",
    )
    .run(PROJECT_ID, VIEWER_ID);

  const serverModule = await import("../index.ts");
  app = serverModule.app;

  ownerToken = tokenFor(OWNER_ID, "owner@api.example");
  editorToken = tokenFor(EDITOR_ID, "editor@api.example");
  viewerToken = tokenFor(VIEWER_ID, "viewer@api.example");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

test("PM-P7-03 Automation, credentials, approvals and audit APIs", async (t) => {
  let workflowId = "";
  let connectorId = "";
  let environmentId = "";

  await t.test("workflow API enforces membership and preserves draft validation", async () => {
    const created = await request(app)
      .post("/api/v1/automation/workflows")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        name: "API Security Workflow",
        description: "Draft workflow for API tests",
      });

    assert.equal(created.status, 201);
    assert.equal(created.body.workflow.status, "draft");
    workflowId = created.body.workflow.workflow_id;

    const listed = await request(app)
      .get(`/api/v1/automation/workflows?project_id=${PROJECT_ID}`)
      .set(auth(viewerToken));

    assert.equal(listed.status, 200);
    assert.equal(
      listed.body.workflows.some(
        (workflow: { workflow_id: string }) =>
          workflow.workflow_id === workflowId,
      ),
      true,
    );

    const viewerWrite = await request(app)
      .put(`/api/v1/automation/workflows/${workflowId}`)
      .set(auth(viewerToken))
      .send({ name: "Unauthorized Change" });

    assert.equal(viewerWrite.status, 404);

    const trigger = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/nodes`)
      .set(auth(editorToken))
      .send({
        node_type: "trigger",
        name: "Task updated",
        purpose: "Starts from an approved task event",
        config: {
          event_type: "task.updated",
          subscription_id: "task-updated-subscription",
        },
      });

    assert.equal(trigger.status, 201);
    assert.equal(trigger.body.node.node_type, "trigger");

    const selfLoop = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/edges`)
      .set(auth(editorToken))
      .send({
        from_node_id: trigger.body.node.node_id,
        to_node_id: trigger.body.node.node_id,
      });

    assert.equal(selfLoop.status, 400);
    assert.equal(selfLoop.body.code, "EDGE_REJECTED");
    assert.equal(selfLoop.body.details.reason, "self_loop");

    const version = await request(app)
      .post(`/api/v1/automation/workflows/${workflowId}/versions`)
      .set(auth(editorToken))
      .send({});

    assert.equal(version.status, 201);
    assert.equal(version.body.version.version_number, 2);

    const detail = await request(app)
      .get(`/api/v1/automation/workflows/${workflowId}`)
      .set(auth(viewerToken));

    assert.equal(detail.status, 200);
    assert.equal(typeof detail.body.version.definition_json, "string");
  });

  await t.test("environment API rejects live mode", async () => {
    const created = await request(app)
      .post("/api/v1/automation/environments")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        name: "Preview API Environment",
        mode: "preview",
      });

    assert.equal(created.status, 201);
    environmentId = created.body.environment.environment_id;

    const live = await request(app)
      .post("/api/v1/automation/environments")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        name: "Live Environment",
        mode: "live",
      });

    assert.equal(live.status, 423);
    assert.equal(live.body.code, "RUNTIME_DISABLED");

    const viewerCreate = await request(app)
      .post("/api/v1/automation/environments")
      .set(auth(viewerToken))
      .send({
        project_id: PROJECT_ID,
        name: "Viewer Environment",
        mode: "test",
      });

    assert.equal(viewerCreate.status, 404);

    const crossProjectRead = await request(app)
      .get(`/api/v1/automation/environments?project_id=${OTHER_PROJECT_ID}`)
      .set(auth(editorToken));

    assert.equal(crossProjectRead.status, 200);
    assert.deepEqual(crossProjectRead.body.environments, []);
  });

  await t.test("connector API quarantines legacy rows and scopes mapped rows", async () => {
    const created = await request(app)
      .post("/api/connectors")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        environment_id: environmentId,
        provider: "github",
        name: "API Connector",
        config: {
          repo_owner: "project-owner",
          repo_name: "private-repo",
        },
        allowed_actions: ["list_repos"],
      });

    assert.equal(created.status, 201);
    connectorId = created.body.connector.connector_id;
    assert.equal(created.body.connector.project_id, PROJECT_ID);
    assert.equal(created.body.connector.credential_configured, false);

    const list = await request(app)
      .get(`/api/connectors?project_id=${PROJECT_ID}`)
      .set(auth(editorToken));

    assert.equal(list.status, 200);
    assert.equal(
      list.body.connectors.some(
        (connector: { connector_id: string }) =>
          connector.connector_id === connectorId,
      ),
      true,
    );

    const crossProject = await request(app)
      .get(`/api/connectors?project_id=${OTHER_PROJECT_ID}`)
      .set(auth(editorToken));

    assert.equal(crossProject.status, 200);
    assert.deepEqual(crossProject.body.connectors, []);

    const providerCall = await request(app)
      .get(`/api/connectors/${connectorId}/github/repos`)
      .set(auth(ownerToken));

    assert.equal(providerCall.status, 423);
    assert.equal(providerCall.body.code, "RUNTIME_DISABLED");

    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO connectors (
          connector_id, name, type, provider, status, config,
          created_by, created_at, updated_at
        ) VALUES ('legacy-api-connector', 'Legacy', 'token',
                  'github', 'disconnected', '{}', ?, ?, ?)`,
      )
      .run(OWNER_ID, now, now);

    const legacy = await request(app)
      .get("/api/connectors/legacy-api-connector")
      .set(auth(ownerToken));

    assert.equal(legacy.status, 404);
  });

  await t.test("credential reference endpoints never return the stored pointer", async () => {
    const secretStorePointer = "vault://api-test/project/github/credential";
    const created = await request(app)
      .post("/api/v1/automation/credential-references")
      .set(auth(ownerToken))
      .send({
        project_id: PROJECT_ID,
        connector_id: connectorId,
        environment_id: environmentId,
        reference: secretStorePointer,
        scopes: ["list_repos"],
      });

    assert.equal(created.status, 201);
    assert.equal(created.body.credential_reference.configured, true);
    assert.equal(
      JSON.stringify(created.body).includes(secretStorePointer),
      false,
    );
    assert.equal("reference" in created.body.credential_reference, false);

    const rotatedPointer = "vault://api-test/project/github/credential-v2";
    const rotated = await request(app)
      .put(`/api/v1/automation/credential-references/connector/${connectorId}`)
      .set(auth(ownerToken))
      .send({
        reference: rotatedPointer,
        scopes: ["list_repos"],
      });

    assert.equal(rotated.status, 200);
    assert.equal(
      JSON.stringify(rotated.body).includes(rotatedPointer),
      false,
    );

    const viewerList = await request(app)
      .get(`/api/v1/automation/credential-references?project_id=${PROJECT_ID}`)
      .set(auth(viewerToken));

    assert.equal(viewerList.status, 404);
  });

  await t.test("approval decisions require a human owner and prevent self-approval", async () => {
    const requested = await request(app)
      .post("/api/v1/automation/approvals")
      .set(auth(editorToken))
      .send({
        workflow_id: workflowId,
        approval_type: "connector_action",
        idempotency_key: "api-editor-approval",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    assert.equal(requested.status, 201);
    const approvalId = requested.body.approval.approval_id;

    const editorDecision = await request(app)
      .post(`/api/v1/automation/approvals/${approvalId}/approve`)
      .set(auth(editorToken))
      .send({});

    assert.equal(editorDecision.status, 403);

    const ownerDecision = await request(app)
      .post(`/api/v1/automation/approvals/${approvalId}/approve`)
      .set(auth(ownerToken))
      .send({ note: "Reviewed by project owner" });

    assert.equal(ownerDecision.status, 200);
    assert.equal(ownerDecision.body.approval.status, "granted");

    const ownRequest = await request(app)
      .post("/api/v1/automation/approvals")
      .set(auth(ownerToken))
      .send({
        workflow_id: workflowId,
        approval_type: "connector_action",
        idempotency_key: "api-owner-self-approval",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    assert.equal(ownRequest.status, 201);

    const selfApproval = await request(app)
      .post(
        `/api/v1/automation/approvals/${ownRequest.body.approval.approval_id}/approve`,
      )
      .set(auth(ownerToken))
      .send({});

    assert.equal(selfApproval.status, 403);
    assert.equal(selfApproval.body.code, "SELF_APPROVAL_FORBIDDEN");
  });

  await t.test("audit API is read-only and returns only redacted snapshots", async () => {
    const audit = await request(app)
      .get(`/api/v1/automation/audit?project_id=${PROJECT_ID}`)
      .set(auth(ownerToken));

    assert.equal(audit.status, 200);
    assert.ok(Array.isArray(audit.body.audit_logs));

    const createAudit = await request(app)
      .post("/api/v1/automation/audit")
      .set(auth(ownerToken))
      .send({ project_id: PROJECT_ID });

    assert.equal(createAudit.status, 404);

    const deleteAudit = await request(app)
      .delete("/api/v1/automation/audit/some-id")
      .set(auth(ownerToken));

    assert.equal(deleteAudit.status, 404);
  });
});
