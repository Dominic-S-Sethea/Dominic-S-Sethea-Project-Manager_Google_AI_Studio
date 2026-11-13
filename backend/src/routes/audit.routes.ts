
import { Router } from "express";
import { getDb } from "../database/index.ts";
import { requireUserOrAgent } from "../middleware/agentAuthMiddleware.ts";
import {
  getRequestId,
  resolveActor,
  sendSafeError,
} from "../services/actor.service.ts";
import { authorize } from "../services/projectAccess.service.ts";
import { maskEmail, redact } from "../services/redaction.service.ts";

interface AuditRow {
  log_id: string;
  user_id: string | null;
  agent_id: string | null;
  action: string;
  target_table: string;
  target_id: string;
  old_value: string | null;
  new_value: string | null;
  trigger: string;
  ip_address: string | null;
  created_at: string;
  actor_type: string | null;
  actor_id: string | null;
  project_id: string | null;
  request_id: string | null;
  trace_id: string | null;
  target_sub_id: string | null;
  outcome: string | null;
  user_email: string | null;
  user_name: string | null;
  agent_name: string | null;
}

const router = Router();

function parseSnapshot(value: string | null): unknown {
  if (value === null) return null;

  try {
    return redact(JSON.parse(value) as unknown);
  } catch {
    return "[REDACTED]";
  }
}

router.use(requireUserOrAgent);

// Read-only audit history. Authorization is checked against the project,
// and owner/editor is required by the policy service.
router.get("/", (req, res) => {
  try {
    const projectId =
      typeof req.query.project_id === "string" ? req.query.project_id : "";

    if (!projectId) {
      return res.status(400).json({
        error: "project_id is required",
        request_id: getRequestId(req),
      });
    }

    const actor = resolveActor(req);
    if (!authorize(actor, projectId, "audit", "read")) {
      return res.status(404).json({
        error: "Audit history not found",
        request_id: getRequestId(req),
      });
    }

    const requestedLimit =
      typeof req.query.limit === "string"
        ? Number.parseInt(req.query.limit, 10)
        : 50;

    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 50;

    const rows = getDb()
      .prepare(
        `SELECT
           a.log_id, a.user_id, a.agent_id, a.action, a.target_table,
           a.target_id, a.old_value, a.new_value, a.trigger, a.ip_address,
           a.created_at, a.actor_type, a.actor_id, a.project_id, a.request_id,
           a.trace_id, a.target_sub_id, a.outcome,
           u.email AS user_email, u.username AS user_name,
           ag.name AS agent_name
         FROM audit_logs a
         LEFT JOIN users u ON u.user_id = a.user_id
         LEFT JOIN agents ag ON ag.agent_id = a.agent_id
         WHERE a.project_id = ?
         ORDER BY a.created_at DESC, a.log_id DESC
         LIMIT ?`,
      )
      .all(projectId, limit) as unknown as AuditRow[];

    const entries = rows.map((row) => ({
      log_id: row.log_id,
      actor_type: row.actor_type ?? (row.agent_id ? "agent" : "user"),
      actor_id: row.actor_id ?? row.user_id ?? row.agent_id,
      actor_display: row.user_email
        ? maskEmail(row.user_email)
        : row.user_name
          ? "***"
          : row.agent_name
            ? row.agent_name
            : "Unknown actor",
      action: row.action,
      target_table: row.target_table,
      target_id: row.target_id,
      target_sub_id: row.target_sub_id,
      project_id: row.project_id,
      old_value: parseSnapshot(row.old_value),
      new_value: parseSnapshot(row.new_value),
      trigger: row.trigger,
      request_id: row.request_id,
      trace_id: row.trace_id,
      outcome: row.outcome,
      ip_address: row.ip_address
        ? (redact({ ip_address: row.ip_address }) as {
            ip_address?: unknown;
          }).ip_address
        : null,
      created_at: row.created_at,
    }));

    return res.json({ audit_logs: entries });
  } catch (error) {
    return sendSafeError(req, res, error, "Audit history could not be read");
  }
});

// No update or delete handlers are intentionally registered.

export default router;
