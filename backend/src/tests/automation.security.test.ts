
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Request } from "express";
import { getDb, closeDb } from "../database/index.ts";
import {
  containsSecretMaterial,
  redact,
  redactForAudit,
} from "../services/redaction.service.ts";
import {
  fingerprintKey,
  resolveActor,
} from "../services/actor.service.ts";
import {
  authorize,
  signAgentProjectGrant,
} from "../services/projectAccess.service.ts";
import {
  createEnvironment,
} from "../services/environment.service.ts";
import {
  createCredentialReference,
} from "../services/credentialReference.service.ts";
import {
  createWorkflow,
} from "../services/workflow.service.ts";
import {
  decideApproval,
  requestApproval,
} from "../services/approval.service.ts";
import { record } from "../services/audit.service.ts";
import { connectorService } from "../services/connector.service.ts";

const OWNER_ID = "pm-p703-owner";
const EDITOR_ID = "pm-p703-editor";
const VIEWER_ID = "pm-p703-viewer";
const COMMENTER_ID = "pm-p703-commenter";
const INACTIVE_ID = "pm-p703-inactive";
const AGENT_ID = "pm-p703-agent";
const PROJECT_ID = "pm-p703-project";
const SECOND_PROJECT_ID = "pm-p703-project-b";

const ownerActor = {
  actor_type: "user" as const,
  actor_id: OWNER_ID,
};

const editorActor = {
  actor_type: "user" as const,
  actor_id: EDITOR_ID,
};

let databaseDirectory = "";

function seedUser(userId: string, email: string, status = "active"): void {
  getDb()
    .prepare(
      `INSERT INTO users (
        user_id, username, email, password_hash, role, status, created_at
      ) VALUES (?, ?, ?, 'test-hash', 'viewer', ?, ?)`,
    )
    .run(userId, userId, email, status, new Date().toISOString());
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

function addMember(
  projectId: string,
  userId: string,
  role: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES (?, ?, ?)`,
    )
    .run(projectId, userId, role);
}

before(() => {
  process.env.JWT_SECRET =
    "pm-p7-03-security-test-secret-with-sufficient-length";
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "pm-p703-security-"));
  process.env.DB_PATH = path.join(databaseDirectory, "security.db");

  const db = getDb();
  void db;

  seedUser(OWNER_ID, "owner@security.example");
  seedUser(EDITOR_ID, "editor@security.example");
  seedUser(VIEWER_ID, "viewer@security.example");
  seedUser(COMMENTER_ID, "commenter@security.example");
  seedUser(INACTIVE_ID, "inactive@security.example", "inactive");

  seedProject(PROJECT_ID, OWNER_ID);
  seedProject(SECOND_PROJECT_ID, OWNER_ID);

  addMember(PROJECT_ID, EDITOR_ID, "editor");
  addMember(PROJECT_ID, VIEWER_ID, "viewer");
  addMember(PROJECT_ID, COMMENTER_ID, "commenter");
  addMember(PROJECT_ID, INACTIVE_ID, "owner");

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO agents (
        agent_id, name, role, api_key_hash, provider, model,
        permissions, status, created_at, updated_at, expires_at
      ) VALUES (?, 'Security Test Agent', 'admin', 'not-a-real-hash',
                'test', 'test', '[]', 'active', ?, ?, NULL)`,
    )
    .run(AGENT_ID, now, now);
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

test("PM-P7-03 security contract", async (t) => {
  await t.test("redaction masks secrets, PII and canary token values", () => {
    const canary = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const input = {
      password_hash: "private-password-hash",
      reference: "vault://private/connector/credential-1",
      email: "person@example.com",
      ip_address: "192.168.10.20",
      nested: {
        token_value: canary,
        note: `Canary ${canary} must not be serialized`,
      },
    };

    const output = JSON.stringify(redact(input));
    assert.equal(output.includes(canary), false);
    assert.equal(output.includes("private-password-hash"), false);
    assert.equal(output.includes("vault://private/connector/credential-1"), false);
    assert.equal(output.includes("person@example.com"), false);
    assert.equal(containsSecretMaterial({ api_key: "ordinary-value" }), true);
    assert.equal(redactForAudit(input)?.includes(canary), false);
  });

  await t.test("actor identity comes from authenticated request properties", () => {
    const userRequest = {
      headers: { "x-request-id": "request-security-001" },
      user: { user_id: OWNER_ID, email: "owner@security.example", role: "viewer" },
    } as unknown as Request;

    const agentRequest = {
      headers: { authorization: "Bearer agent-private-key" },
      agent: { agent_id: AGENT_ID },
    } as unknown as Request;

    const systemRequest = {
      headers: {},
      service_actor: { actor_type: "system", actor_id: "maintenance" },
    } as unknown as Request;

    assert.equal(resolveActor(userRequest).actor_type, "user");
    assert.equal(resolveActor(userRequest).actor_id, OWNER_ID);
    assert.equal(resolveActor(agentRequest).actor_type, "agent");
    assert.equal(resolveActor(agentRequest).actor_id, AGENT_ID);
    assert.equal(resolveActor(systemRequest).actor_type, "system");
    assert.equal(fingerprintKey("agent-private-key").length, 12);
    assert.notEqual(fingerprintKey("agent-private-key"), "agent-private-key");
  });

  await t.test("authorization matrix is project-scoped and fails closed", () => {
    const readRoles = [
      [ownerActor, true],
      [editorActor, true],
      [{ actor_type: "user" as const, actor_id: VIEWER_ID }, true],
      [{ actor_type: "user" as const, actor_id: COMMENTER_ID }, true],
    ] as const;

    for (const [actor, expected] of readRoles) {
      assert.equal(
        authorize(actor, PROJECT_ID, "workflow", "read"),
        expected,
      );
    }

    assert.equal(
      authorize(editorActor, PROJECT_ID, "workflow", "update"),
      true,
    );
    assert.equal(
      authorize(
        { actor_type: "user", actor_id: VIEWER_ID },
        PROJECT_ID,
        "workflow",
        "update",
      ),
      false,
    );
    assert.equal(
      authorize(
        { actor_type: "user", actor_id: COMMENTER_ID },
        PROJECT_ID,
        "credential_reference",
        "create",
      ),
      false,
    );
    assert.equal(
      authorize(
        { actor_type: "user", actor_id: INACTIVE_ID },
        PROJECT_ID,
        "workflow",
        "read",
      ),
      false,
    );
    assert.equal(
      authorize(ownerActor, SECOND_PROJECT_ID, "workflow", "create"),
      true,
    );
  });

  await t.test("unsigned client-supplied agent permissions grant nothing", () => {
    const agentActor = {
      actor_type: "agent" as const,
      actor_id: AGENT_ID,
    };

    getDb()
      .prepare("UPDATE agents SET permissions = ? WHERE agent_id = ?")
      .run(JSON.stringify(["workflow.draft.*", "approval.read"]), AGENT_ID);

    assert.equal(
      authorize(agentActor, PROJECT_ID, "workflow", "read"),
      false,
    );

    const grant = signAgentProjectGrant(PROJECT_ID, [
      "workflow.read",
      "workflow.draft.create",
    ]);

    getDb()
      .prepare("UPDATE agents SET permissions = ? WHERE agent_id = ?")
      .run(
        JSON.stringify({ version: 1, grants: [grant] }),
        AGENT_ID,
      );

    assert.equal(
      authorize(agentActor, PROJECT_ID, "workflow", "read"),
      true,
    );
    assert.equal(
      authorize(agentActor, PROJECT_ID, "workflow", "create"),
      true,
    );
    assert.equal(
      authorize(agentActor, SECOND_PROJECT_ID, "workflow", "read"),
      false,
    );
    assert.equal(
      authorize(agentActor, PROJECT_ID, "approval", "approve"),
      false,
    );
  });

  await t.test("credential reference create and rotate are write-only", () => {
    const environment = createEnvironment(
      {
        project_id: PROJECT_ID,
        name: "Security Test Environment",
        mode: "test",
      },
      ownerActor,
    );

    const connector = connectorService.createInstance(
      {
        project_id: PROJECT_ID,
        environment_id: environment.environment_id,
        provider: "github",
        name: "Security Test Connector",
        config: { repo_owner: "project-owner", repo_name: "private-repo" },
        allowed_actions: ["list_repos"],
      },
      ownerActor,
    );

    const referenceValue = "vault://pm/security/github-credential";
    const metadata = createCredentialReference(
      {
        project_id: PROJECT_ID,
        connector_id: connector.connector_id,
        environment_id: environment.environment_id,
        reference: referenceValue,
        scopes: ["list_repos"],
      },
      ownerActor,
    );

    assert.equal(metadata.configured, true);
    assert.equal(metadata.status, "active");
    assert.deepEqual(metadata.scopes, ["list_repos"]);
    assert.equal("reference" in metadata, false);
    assert.equal(JSON.stringify(metadata).includes(referenceValue), false);

    const canary = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    assert.throws(
      () =>
        createCredentialReference(
          {
            project_id: PROJECT_ID,
            connector_id: connector.connector_id,
            environment_id: environment.environment_id,
            reference: canary,
            scopes: ["list_repos"],
          },
          ownerActor,
        ),
      /raw credential/i,
    );
  });

  await t.test("connector allowlist rejects unsafe actions and legacy rows stay hidden", () => {
    const environment = createEnvironment(
      {
        project_id: PROJECT_ID,
        name: "Connector Allowlist Environment",
        mode: "preview",
      },
      ownerActor,
    );

    assert.throws(
      () =>
        connectorService.createInstance(
          {
            project_id: PROJECT_ID,
            environment_id: environment.environment_id,
            provider: "github",
            name: "Unsafe Connector",
            allowed_actions: ["delete_everything"],
          },
          ownerActor,
        ),
      /allowlist/i,
    );

    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO connectors (
          connector_id, name, type, provider, status, config,
          created_by, created_at, updated_at
        ) VALUES ('legacy-unscoped', 'Legacy', 'token', 'github',
                  'disconnected', '{}', ?, ?, ?)`,
      )
      .run(OWNER_ID, now, now);

    assert.equal(
      connectorService.getInstance("legacy-unscoped", ownerActor),
      null,
    );
    assert.equal(
      connectorService.listInstances(PROJECT_ID, ownerActor)
        .some((item) => item.connector_id === "legacy-unscoped"),
      false,
    );
  });

  await t.test("approval separation of duties and expiry are enforced", () => {
    const workflow = createWorkflow(
      ownerActor,
      PROJECT_ID,
      "Approval Separation Test",
    );

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const editorRequest = requestApproval(
      {
        workflow_id: workflow.workflow_id,
        approval_type: "connector_action",
        idempotency_key: "editor-approval-request-1",
        expires_at: future,
      },
      editorActor,
    );

    assert.throws(
      () => decideApproval(
        editorRequest.approval_id,
        "approve",
        editorActor,
      ),
      /human project owner/i,
    );

    const ownerRequest = requestApproval(
      {
        workflow_id: workflow.workflow_id,
        approval_type: "connector_action",
        idempotency_key: "owner-self-approval-request",
        expires_at: future,
      },
      ownerActor,
    );

    assert.throws(
      () => decideApproval(
        ownerRequest.approval_id,
        "approve",
        ownerActor,
      ),
      /own approval request/i,
    );

    const approved = decideApproval(
      editorRequest.approval_id,
      "approve",
      ownerActor,
    );
    assert.equal(approved.status, "granted");

    const expiring = requestApproval(
      {
        workflow_id: workflow.workflow_id,
        approval_type: "connector_action",
        idempotency_key: "expired-approval-request",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      editorActor,
    );

    getDb()
      .prepare("UPDATE approvals SET expires_at = ? WHERE approval_id = ?")
      .run(
        new Date(Date.now() - 60 * 1000).toISOString(),
        expiring.approval_id,
      );

    assert.throws(
      () => decideApproval(expiring.approval_id, "approve", ownerActor),
      /expired/i,
    );

    const expired = getDb()
      .prepare("SELECT status FROM approvals WHERE approval_id = ?")
      .get(expiring.approval_id) as { status: string };

    assert.equal(expired.status, "expired");
  });

  await t.test("audit rows contain redacted snapshots and reject mutation", () => {
    const canary = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    record({
      actor: ownerActor,
      project_id: PROJECT_ID,
      action: "workflow.updated",
      target_table: "security_test",
      target_id: "security-target",
      new_value: {
        password: canary,
        safe_value: "visible",
      },
      trigger: "api",
      request_id: "audit-security-request-9",
    });

    const row = getDb()
      .prepare(
        `SELECT log_id, new_value, request_id
         FROM audit_logs
         WHERE target_id = 'security-target'
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get() as {
        log_id: string;
        new_value: string | null;
        request_id: string | null;
      };

    assert.ok(row.log_id);
    assert.equal(row.new_value?.includes(canary), false);
    assert.equal(row.request_id, "audit-security-request-9");

    assert.throws(() => {
      getDb()
        .prepare("UPDATE audit_logs SET action = 'changed' WHERE log_id = ?")
        .run(row.log_id);
    });

    assert.throws(() => {
      getDb()
        .prepare("DELETE FROM audit_logs WHERE log_id = ?")
        .run(row.log_id);
    });
  });
});
