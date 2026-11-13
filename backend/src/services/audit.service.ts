
import { randomUUID } from "node:crypto";
import { getDb } from "../database/index.ts";
import type { DatabaseSync } from "node:sqlite";
import type { Actor } from "./actor.service.ts";
import { getRequestId } from "./actor.service.ts";
import { redactForAudit, redact } from "./redaction.service.ts";
import type { Request } from "express";

export type AuditTrigger =
  | "ui"
  | "api"
  | "agent"
  | "automation"
  | "system"
  | "import"
  | "migration"
  | "backup";

export type AuditAction =
  | "workflow.created"
  | "workflow.updated"
  | "workflow.archived"
  | "version.created"
  | "workflow.published"
  | "workflow.paused"
  | "execution.started"
  | "execution.step_completed"
  | "execution.step_failed"
  | "execution.completed"
  | "execution.failed"
  | "execution.cancelled"
  | "execution.timed_out"
  | "execution.created"
  | "execution.paused"
  | "execution.resumed"
  | "execution.rolled_back"
  | "approval.requested"
  | "approval.granted"
  | "approval.rejected"
  | "approval.expired"
  | "credential_reference.created"
  | "credential_reference.rotated"
  | "credential_reference.revoked"
  | "credential_reference.used"
  | "replay.requested"
  | "replay.denied"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "checklist.created"
  | "checklist.updated"
  | "checklist.deleted"
  | "dependency.created"
  | "dependency.updated"
  | "dependency.deleted"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "connector.created"
  | "connector.updated"
  | "connector.deleted"
  | "agent.registered"
  | "auth.login"
  | "import.completed"
  | "export.completed"
  | "migration.applied"
  | "backup.created"
  | "backup.deleted";

export interface AuditEntry {
  actor: Actor;
  /** Null for global events (e.g. user administration) with no project scope. */
  project_id: string | null;
  action: AuditAction;
  target_table: string;
  target_id: string;
  target_sub_id?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  trigger: AuditTrigger;
  outcome?: "success" | "denied" | "failure";
  request_id?: string;
  trace_id?: string | null;
  ip_address?: string | null;
}

function boundedText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  return value.slice(0, maxLength);
}

function safeIpAddress(value: string | null | undefined): string | null {
  if (!value) return null;

  const result = redact({ ip_address: value }) as {
    ip_address?: unknown;
  };

  return typeof result.ip_address === "string"
    ? result.ip_address
    : null;
}

/**
 * Append-only audit writer. It intentionally does not start its own
 * transaction: callers performing a domain mutation call record() before
 * committing their transaction, so the domain change and audit row commit
 * or roll back together.
 */
export function record(entry: AuditEntry, dbOverride?: InstanceType<typeof DatabaseSync>): void {
  const actorType = entry.actor.actor_type;
  const userId = actorType === "user" ? entry.actor.actor_id : null;
  const agentId = actorType === "agent" ? entry.actor.actor_id : null;

  const requestId = boundedText(entry.request_id, 128) ??
    (entry.actor.actor_type === "anonymous" ? randomUUID() : null);

  (dbOverride ?? getDb())
    .prepare(
      `INSERT INTO audit_logs (
        log_id, user_id, agent_id, action, target_table, target_id,
        old_value, new_value, trigger, ip_address, created_at,
        actor_type, actor_id, project_id, request_id, trace_id,
        target_sub_id, outcome
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      userId,
      agentId,
      entry.action,
      entry.target_table,
      entry.target_id,
      redactForAudit(entry.old_value),
      redactForAudit(entry.new_value),
      entry.trigger,
      safeIpAddress(entry.ip_address),
      new Date().toISOString(),
      actorType,
      entry.actor.actor_id,
      entry.project_id,
      requestId,
      entry.trace_id ?? null,
      entry.target_sub_id ?? null,
      entry.outcome ?? "success",
    );
}

export function recordRequestAction(
  entry: Omit<AuditEntry, "request_id" | "ip_address">,
  req: Request,
): void {
  record({
    ...entry,
    request_id: getRequestId(req),
    ip_address: req.ip,
  });
}
