/**
 * QA-009 — MC-009 Human approval flow verification.
 *
 * Contract under test: PHASE4_02 §7 (approval states) and PHASE4_03 §4.7
 * (approvals table, separation of duties), decision AD-05 (single owner, no
 * self-approval) and AD-01 (preview-only runtime boundary).
 *
 * Expected state machine:
 *   pending ──approve──▶ granted
 *     ├──reject───────▶ rejected
 *     └──no decision──▶ expired
 *
 * The suite runs against an isolated temporary SQLite database (DB_PATH), so
 * the live backend/data/app.db is never read or written.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";
import { createWorkflow } from "../services/workflow.service.ts";
import { signAgentProjectGrant } from "../services/projectAccess.service.ts";
import {
  decideApproval,
  expireApproval,
  listApprovals,
  requestApproval,
} from "../services/approval.service.ts";
import type { Actor } from "../services/actor.service.ts";

const OWNER_ID = "qa009-owner";
const SECOND_OWNER_ID = "qa009-owner-b";
const EDITOR_ID = "qa009-editor";
const VIEWER_ID = "qa009-viewer";
const OUTSIDER_ID = "qa009-outsider";
const AGENT_ID = "qa009-agent";
const AUTOMATION_ID = "qa009-automation";
const PROJECT_ID = "qa009-project";
const OTHER_PROJECT_ID = "qa009-project-b";
const AGENT_API_KEY = "qa009-agent-api-key";

const JWT_SECRET =
  "qa009-approval-flow-test-secret-with-sufficient-length";

const ownerActor: Actor = { actor_type: "user", actor_id: OWNER_ID };
const secondOwnerActor: Actor = {
  actor_type: "user",
  actor_id: SECOND_OWNER_ID,
};
const editorActor: Actor = { actor_type: "user", actor_id: EDITOR_ID };
const viewerActor: Actor = { actor_type: "user", actor_id: VIEWER_ID };
const outsiderActor: Actor = { actor_type: "user", actor_id: OUTSIDER_ID };
const agentActor: Actor = { actor_type: "agent", actor_id: AGENT_ID };
const automationActor: Actor = {
  actor_type: "automation",
  actor_id: AUTOMATION_ID,
};

interface RawApproval {
  approval_id: string;
  status: string;
  requested_by_type: string;
  requested_by_id: string;
  reviewer_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string;
  idempotency_key: string;
}

interface AuditRow {
  action: string;
  actor_type: string;
  actor_id: string;
  target_id: string;
  outcome: string;
}

let app: Express;
let databaseDirectory = "";
let ownerToken = "";
let secondOwnerToken = "";
let editorToken = "";
let viewerToken = "";
let workflowCounter = 0;

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

function futureExpiry(milliseconds = 60 * 60 * 1000): string {
  return new Date(Date.now() + milliseconds).toISOString();
}

function seedUser(
  userId: string,
  email: string,
  role = "viewer",
  status = "active",
): void {
  getDb()
    .prepare(
      `INSERT INTO users (
        user_id, username, email, password_hash, role, status, created_at
      ) VALUES (?, ?, ?, 'test-hash', ?, ?, ?)`,
    )
    .run(userId, userId, email, role, status, new Date().toISOString());
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

function addMember(projectId: string, userId: string, role: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
    )
    .run(projectId, userId, role);
}

/** Creates a fresh draft workflow in PROJECT_ID with a unique name. */
function makeWorkflow(): { workflow_id: string } {
  workflowCounter += 1;
  return createWorkflow(
    ownerActor,
    PROJECT_ID,
    `QA-009 Workflow ${workflowCounter}`,
  );
}

function rawApproval(approvalId: string): RawApproval | undefined {
  return getDb()
    .prepare("SELECT * FROM approvals WHERE approval_id = ?")
    .get(approvalId) as RawApproval | undefined;
}

function auditRows(action: string, targetId: string): AuditRow[] {
  return getDb()
    .prepare(
      `SELECT action, actor_type, actor_id, target_id, outcome
       FROM audit_logs WHERE action = ? AND target_id = ?`,
    )
    .all(action, targetId) as unknown as AuditRow[];
}

interface CapturedError {
  statusCode: number;
  code: string;
  message: string;
}

function captureError(fn: () => unknown): CapturedError {
  try {
    fn();
  } catch (error) {
    const candidate = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    return {
      statusCode: candidate.statusCode ?? 0,
      code: candidate.code ?? "",
      message: candidate.message ?? "",
    };
  }
  throw new Error("Expected the operation to throw, but it succeeded");
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "qa009-approval-"));
  process.env.DB_PATH = path.join(databaseDirectory, "approval-flow.db");

  getDb();

  seedUser(OWNER_ID, "owner@qa009.example", "owner");
  seedUser(SECOND_OWNER_ID, "owner2@qa009.example", "viewer");
  seedUser(EDITOR_ID, "editor@qa009.example", "editor");
  seedUser(VIEWER_ID, "viewer@qa009.example", "viewer");
  seedUser(OUTSIDER_ID, "outsider@qa009.example", "viewer");

  seedProject(PROJECT_ID, OWNER_ID);
  seedProject(OTHER_PROJECT_ID, OWNER_ID);

  addMember(PROJECT_ID, OWNER_ID, "owner");
  addMember(PROJECT_ID, SECOND_OWNER_ID, "owner");
  addMember(PROJECT_ID, EDITOR_ID, "editor");
  addMember(PROJECT_ID, VIEWER_ID, "viewer");

  const now = new Date().toISOString();
  const apiKeyHash = createHash("sha256")
    .update(AGENT_API_KEY)
    .digest("hex");
  // Agents require a signed project grant; an empty permissions array grants
  // no scopes, so every project-scoped request would be denied.
  const agentPermissions = JSON.stringify({
    version: 1,
    grants: [signAgentProjectGrant(PROJECT_ID, ["approval.request"])],
  });
  getDb()
    .prepare(
      `INSERT INTO agents (
        agent_id, name, role, api_key_hash, provider, model,
        permissions, status, created_at, updated_at, expires_at
      ) VALUES (?, 'QA-009 Agent', 'admin', ?, 'test', 'test', ?, 'active', ?, ?, NULL)`,
    )
    .run(AGENT_ID, apiKeyHash, agentPermissions, now, now);

  const serverModule = await import("../index.ts");
  app = serverModule.app;

  ownerToken = tokenFor(OWNER_ID, "owner@qa009.example");
  secondOwnerToken = tokenFor(SECOND_OWNER_ID, "owner2@qa009.example");
  editorToken = tokenFor(EDITOR_ID, "editor@qa009.example");
  viewerToken = tokenFor(VIEWER_ID, "viewer@qa009.example");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

test("MC-009 human approval flow", async (t) => {
  await t.test("agent proposal creates a pending approval record", () => {
    const workflow = makeWorkflow();
    const approval = requestApproval(
      {
        workflow_id: workflow.workflow_id,
        approval_type: "connector_action",
        idempotency_key: "qa009-agent-proposal-1",
        expires_at: futureExpiry(),
      },
      agentActor,
    );

    assert.equal(approval.status, "pending");
    assert.equal(approval.requested_by_type, "agent");
    assert.equal(approval.requested_by_id, AGENT_ID);
    assert.equal(approval.reviewer_id, null);
    assert.equal(approval.decided_at, null);
    assert.equal(approval.approval_type, "connector_action");

    const stored = rawApproval(approval.approval_id);
    assert.ok(stored, "approval row must be persisted");
    assert.equal(stored.status, "pending");
    assert.equal(stored.requested_by_type, "agent");
  });

  await t.test("human proposals record their actor type; automation actors are denied", () => {
    const workflow = makeWorkflow();

    const editorApproval = requestApproval(
      {
        workflow_id: workflow.workflow_id,
        approval_type: "connector_action",
        idempotency_key: "qa009-editor-proposal-1",
        expires_at: futureExpiry(),
      },
      editorActor,
    );
    assert.equal(editorApproval.requested_by_type, "user");
    assert.equal(editorApproval.requested_by_id, EDITOR_ID);

    // Automation actors hold no project API privileges; internal routines use
    // dedicated service paths rather than the project authorization gate.
    const automationRequest = captureError(() =>
      requestApproval(
        {
          workflow_id: workflow.workflow_id,
          approval_type: "connector_action",
          idempotency_key: "qa009-automation-proposal-1",
          expires_at: futureExpiry(),
        },
        automationActor,
      ),
    );
    assert.equal(automationRequest.statusCode, 404);
  });

  await t.test("identical idempotency key returns the same approval", () => {
    const workflow = makeWorkflow();
    const input = {
      workflow_id: workflow.workflow_id,
      approval_type: "connector_action" as const,
      idempotency_key: "qa009-idempotent-key-1",
      expires_at: futureExpiry(),
    };

    const first = requestApproval(input, agentActor);
    const second = requestApproval(input, agentActor);

    assert.equal(second.approval_id, first.approval_id);
    const count = getDb()
      .prepare("SELECT COUNT(*) AS n FROM approvals WHERE idempotency_key = ?")
      .get(input.idempotency_key) as { n: number };
    assert.equal(count.n, 1);
  });

  await t.test("idempotency key reuse with a different payload is rejected", () => {
    const workflow = makeWorkflow();
    requestApproval(
      {
        workflow_id: workflow.workflow_id,
        approval_type: "connector_action",
        idempotency_key: "qa009-idempotent-key-2",
        expires_at: futureExpiry(),
      },
      agentActor,
    );

    const otherWorkflow = makeWorkflow();
    const result = captureError(() =>
      requestApproval(
        {
          workflow_id: otherWorkflow.workflow_id,
          approval_type: "connector_action",
          idempotency_key: "qa009-idempotent-key-2",
          expires_at: futureExpiry(),
        },
        agentActor,
      ),
    );

    assert.equal(result.statusCode, 409);
    assert.equal(result.code, "IDEMPOTENCY_CONFLICT");
  });

  await t.test("missing workflow or idempotency key is rejected", () => {
    const workflow = makeWorkflow();

    const missingWorkflow = captureError(() =>
      requestApproval(
        {
          workflow_id: "",
          approval_type: "connector_action",
          idempotency_key: "qa009-missing-workflow",
          expires_at: futureExpiry(),
        },
        agentActor,
      ),
    );
    assert.equal(missingWorkflow.statusCode, 400);

    const missingKey = captureError(() =>
      requestApproval(
        {
          workflow_id: workflow.workflow_id,
          approval_type: "connector_action",
          idempotency_key: "",
          expires_at: futureExpiry(),
        },
        agentActor,
      ),
    );
    assert.equal(missingKey.statusCode, 400);
  });

  await t.test("a past expiry time is rejected", () => {
    const workflow = makeWorkflow();
    const result = captureError(() =>
      requestApproval(
        {
          workflow_id: workflow.workflow_id,
          approval_type: "connector_action",
          idempotency_key: "qa009-past-expiry",
          expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
        },
        agentActor,
      ),
    );
    assert.equal(result.statusCode, 400);
  });

  await t.test("an unknown workflow is concealed as not found", () => {
    const result = captureError(() =>
      requestApproval(
        {
          workflow_id: "qa009-does-not-exist",
          approval_type: "connector_action",
          idempotency_key: "qa009-unknown-workflow",
          expires_at: futureExpiry(),
        },
        agentActor,
      ),
    );
    assert.equal(result.statusCode, 404);
  });

  await t.test("a non-member cannot request an approval", () => {
    const workflow = makeWorkflow();
    const result = captureError(() =>
      requestApproval(
        {
          workflow_id: workflow.workflow_id,
          approval_type: "connector_action",
          idempotency_key: "qa009-outsider-request",
          expires_at: futureExpiry(),
        },
        outsiderActor,
      ),
    );
    assert.equal(result.statusCode, 404);
  });

  await t.test("publish, execute and replay types are disabled in preview-only mode", () => {
    const workflow = makeWorkflow();

    for (const approvalType of [
      "publish",
      "execute",
      "replay_side_effect",
    ] as const) {
      const result = captureError(() =>
        requestApproval(
          {
            workflow_id: workflow.workflow_id,
            approval_type: approvalType,
            idempotency_key: `qa009-disabled-${approvalType}`,
            expires_at: futureExpiry(),
          },
          agentActor,
        ),
      );
      assert.equal(result.statusCode, 423, `${approvalType} must be disabled`);
      assert.equal(result.code, "RUNTIME_DISABLED");
    }
  });
});
