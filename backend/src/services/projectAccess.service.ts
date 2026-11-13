
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { Actor } from "./actor.service.ts";

export type ProjectRole =
  | "owner"
  | "editor"
  | "viewer"
  | "commenter"
  | "agent";

export interface ProjectAccess {
  role: ProjectRole;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export type AuthorizationResource =
  | "workflow"
  | "workflow_version"
  | "execution"
  | "trace"
  | "approval"
  | "credential_reference"
  | "audit"
  | "environment"
  | "connector";

export type AuthorizationAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "request"
  | "approve"
  | "reject"
  | "cancel"
  | "test";

interface ProjectCreatorRow {
  created_by: string;
}

interface ProjectMemberRow {
  role: string;
}

interface ProjectUserStatusRow {
  status: string;
}

interface AgentPermissionsRow {
  permissions: string;
  status: string;
  expires_at: string | null;
}

interface AgentGrant {
  project_id: string;
  scopes: string[];
  signature: string;
}

interface AgentGrantEnvelope {
  version: 1;
  grants: AgentGrant[];
}

const PROJECT_ROLES = new Set<ProjectRole>([
  "owner",
  "editor",
  "viewer",
  "commenter",
  "agent",
]);

function isProjectRole(role: string): role is ProjectRole {
  return PROJECT_ROLES.has(role as ProjectRole);
}

function accessForRole(role: ProjectRole): ProjectAccess {
  const canManage = role === "owner" || role === "editor";

  return {
    role,
    canRead: true,
    canWrite: canManage,
    canDelete: canManage,
  };
}

export function projectExists(projectId: string): boolean {
  if (!projectId.trim()) return false;

  const row = getDb()
    .prepare("SELECT project_id FROM projects WHERE project_id = ?")
    .get(projectId);

  return row !== undefined;
}

export function getProjectCreatorId(projectId: string): string | null {
  if (!projectId.trim()) return null;

  const row = getDb()
    .prepare("SELECT created_by FROM projects WHERE project_id = ?")
    .get(projectId) as ProjectCreatorRow | undefined;

  return row?.created_by ?? null;
}

/**
 * Existing export retained for current route/service consumers.
 *
 * Project creator is always considered owner. For non-creators, access comes
 * only from project_members; users.role is never consulted.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string,
): Promise<ProjectAccess | null> {
  if (!projectId.trim() || !userId.trim()) return null;

  const db = getDb();

  const project = db
    .prepare("SELECT created_by FROM projects WHERE project_id = ?")
    .get(projectId) as ProjectCreatorRow | undefined;

  if (!project) return null;

  if (project.created_by === userId) {
    return accessForRole("owner");
  }

  const membership = db
    .prepare(
      `SELECT role
       FROM project_members
       WHERE project_id = ? AND user_id = ?`,
    )
    .get(projectId, userId) as ProjectMemberRow | undefined;

  if (!membership || !isProjectRole(membership.role)) {
    return null;
  }

  return accessForRole(membership.role);
}

function getActiveUserRole(
  projectId: string,
  userId: string,
): ProjectRole | null {
  const db = getDb();

  const project = db
    .prepare(
      `SELECT p.created_by, u.status
       FROM projects p
       JOIN users u ON u.user_id = ?
       WHERE p.project_id = ?`,
    )
    .get(userId, projectId) as
    | (ProjectCreatorRow & ProjectUserStatusRow)
    | undefined;

  if (!project || project.status !== "active") return null;

  if (project.created_by === userId) return "owner";

  const membership = db
    .prepare(
      `SELECT pm.role, u.status
       FROM project_members pm
       JOIN users u ON u.user_id = pm.user_id
       WHERE pm.project_id = ? AND pm.user_id = ?`,
    )
    .get(projectId, userId) as
    | { role: string; status: string }
    | undefined;

  if (
    !membership ||
    membership.status !== "active" ||
    !isProjectRole(membership.role)
  ) {
    return null;
  }

  return membership.role;
}

function grantSigningSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  return typeof secret === "string" && secret.length >= 32
    ? secret
    : null;
}

function signaturePayload(projectId: string, scopes: string[]): string {
  return JSON.stringify({
    project_id: projectId,
    scopes: [...new Set(scopes)].sort(),
  });
}

/**
 * Trusted server-side utility for provisioning an agent grant. This does not
 * expose a route and cannot be invoked through a client-supplied permissions
 * field. Grant records are signed with the configured JWT_SECRET; unsigned
 * permissions stored by the legacy agent-registration endpoint are ignored.
 */
export function signAgentProjectGrant(
  projectId: string,
  scopes: string[],
): AgentGrant {
  const secret = grantSigningSecret();
  if (!secret) {
    throw new Error("JWT_SECRET must be configured before granting agent access");
  }

  if (
    !projectId ||
    scopes.length === 0 ||
    scopes.some(
      (scope) =>
        typeof scope !== "string" ||
        !scope ||
        scope.includes("*"),
    )
  ) {
    throw new Error("Agent grants require a project and explicit scopes");
  }

  const normalizedScopes = [...new Set(scopes)].sort();
  const payload = signaturePayload(projectId, normalizedScopes);
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return {
    project_id: projectId,
    scopes: normalizedScopes,
    signature,
  };
}

function validSignature(grant: AgentGrant): boolean {
  const secret = grantSigningSecret();
  if (!secret) return false;

  if (
    !grant.project_id ||
    !Array.isArray(grant.scopes) ||
    grant.scopes.length === 0 ||
    grant.scopes.some(
      (scope) =>
        typeof scope !== "string" ||
        scope.length === 0 ||
        scope.includes("*"),
    ) ||
    !/^[a-f0-9]{64}$/i.test(grant.signature)
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(signaturePayload(grant.project_id, [...grant.scopes].sort()))
    .digest();

  const supplied = Buffer.from(grant.signature, "hex");
  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

function getAgentScopes(
  agentId: string,
  projectId: string,
): Set<string> {
  const row = getDb()
    .prepare(
      `SELECT permissions, status, expires_at
       FROM agents
       WHERE agent_id = ?`,
    )
    .get(agentId) as AgentPermissionsRow | undefined;

  if (!row || row.status !== "active") return new Set();

  if (
    row.expires_at &&
    Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) <= Date.now()
  ) {
    return new Set();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.permissions);
  } catch {
    return new Set();
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return new Set();
  }

  const envelope = parsed as Partial<AgentGrantEnvelope>;
  if (envelope.version !== 1 || !Array.isArray(envelope.grants)) {
    return new Set();
  }

  const scopes = new Set<string>();

  for (const value of envelope.grants) {
    if (
      typeof value !== "object" ||
      value === null ||
      !("project_id" in value) ||
      !("scopes" in value) ||
      !("signature" in value)
    ) {
      continue;
    }

    const grant = value as AgentGrant;
    if (
      grant.project_id === projectId &&
      validSignature(grant)
    ) {
      for (const scope of grant.scopes) scopes.add(scope);
    }
  }

  return scopes;
}

function requiredAgentScope(
  resource: AuthorizationResource,
  action: AuthorizationAction,
): string | null {
  if (resource === "workflow" && action === "read") return "workflow.read";
  if (resource === "workflow" && action === "create") return "workflow.draft.create";
  if (resource === "workflow" && action === "update") return "workflow.draft.update";
  if (resource === "workflow" && action === "delete") return "workflow.draft.delete";

  if (resource === "workflow_version" && action === "read") return "workflow.read";
  if (resource === "workflow_version" && action === "create") return "workflow.version.create";

  if (resource === "execution" && action === "read") return "execution.read";
  if (resource === "execution" && action === "create") return "workflow.test.execute";

  if (resource === "trace" && action === "read") return "trace.read";
  if (resource === "approval" && action === "read") return "approval.read";
  if (resource === "approval" && action === "request") return "approval.request";

  if (resource === "environment" && action === "read") return "environment.read";
  if (resource === "environment" && action === "create") return "environment.create";
  if (resource === "environment" && action === "update") return "environment.update";
  if (resource === "environment" && action === "delete") return "environment.delete";

  return null;
}

function roleAllows(
  role: ProjectRole,
  resource: AuthorizationResource,
  action: AuthorizationAction,
): boolean {
  const readEveryMember =
    resource === "workflow" ||
    resource === "workflow_version" ||
    resource === "execution" ||
    resource === "trace";

  if (action === "read" && readEveryMember) {
    return (
      role === "owner" ||
      role === "editor" ||
      role === "viewer" ||
      role === "commenter"
    );
  }

  if (resource === "workflow") {
    return (
      (role === "owner" || role === "editor") &&
      ["create", "update", "delete"].includes(action)
    );
  }

  if (resource === "workflow_version") {
    return (
      (role === "owner" || role === "editor") &&
      action === "create"
    );
  }

  if (resource === "execution") {
    return (
      (role === "owner" || role === "editor") &&
      action === "create"
    );
  }

  if (resource === "approval") {
    if (action === "read" || action === "request") {
      return role === "owner" || role === "editor";
    }
    return role === "owner" && (action === "approve" || action === "reject");
  }

  if (resource === "credential_reference") {
    if (action === "read") return role === "owner" || role === "editor";
    if (action === "request") return role === "editor";
    return role === "owner" &&
      ["create", "update", "delete"].includes(action);
  }

  if (resource === "audit") {
    return action === "read" && (role === "owner" || role === "editor");
  }

  if (resource === "environment") {
    if (action === "read") return role === "owner" || role === "editor";
    return (
      (role === "owner" || role === "editor") &&
      ["create", "update", "delete"].includes(action)
    );
  }

  if (resource === "connector") {
    if (action === "read") return role === "owner" || role === "editor";
    return role === "owner" &&
      ["create", "update", "delete", "test"].includes(action);
  }

  return false;
}

/**
 * True when the actor holds an active project role, either as the project
 * creator or through an active project_members row (or a valid agent grant).
 *
 * List endpoints use this to distinguish "no relationship to the project"
 * from "member without the required permission": the former receives an empty
 * listing so the endpoint cannot be used to probe for project existence.
 */
export function isProjectMember(actor: Actor, projectId: string): boolean {
  if (!projectId || !projectExists(projectId)) return false;

  if (actor.actor_type === "user") {
    return getActiveUserRole(projectId, actor.actor_id) !== null;
  }

  if (actor.actor_type === "agent") {
    return getAgentScopes(actor.actor_id, projectId).size > 0;
  }

  return false;
}

/**
 * Project-scoped authorization used at the service boundary.
 *
 * User roles are read only from active project membership or the project's
 * creator record. users.role and agent.role never grant project access.
 */
export function authorize(
  actor: Actor,
  projectId: string,
  resource: AuthorizationResource,
  action: AuthorizationAction,
): boolean {
  if (!projectId || !projectExists(projectId)) return false;

  if (actor.actor_type === "user") {
    const role = getActiveUserRole(projectId, actor.actor_id);
    return role ? roleAllows(role, resource, action) : false;
  }

  if (actor.actor_type === "agent") {
    const requiredScope = requiredAgentScope(resource, action);
    if (!requiredScope) return false;

    const scopes = getAgentScopes(actor.actor_id, projectId);
    return scopes.has(requiredScope);
  }

  // System/automation actors receive no project API privileges. Internal
  // expiry and maintenance routines use dedicated service paths.
  return false;
}
