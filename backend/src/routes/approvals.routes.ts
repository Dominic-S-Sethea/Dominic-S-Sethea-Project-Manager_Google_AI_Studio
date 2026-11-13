
import { Router } from "express";
import { requireUserOrAgent } from "../middleware/agentAuthMiddleware.ts";
import {
  decideApproval,
  listApprovals,
  requestApproval,
} from "../services/approval.service.ts";
import {
  getRequestId,
  resolveActor,
  sendSafeError,
} from "../services/actor.service.ts";

const router = Router();

function objectBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

router.use(requireUserOrAgent);

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

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const allowedStatuses = new Set([
      "pending",
      "granted",
      "rejected",
      "expired",
      "cancelled",
    ]);

    if (status && !allowedStatuses.has(status)) {
      return res.status(400).json({
        error: "Invalid approval status",
        request_id: getRequestId(req),
      });
    }

    return res.json({
      approvals: listApprovals(
        projectId,
        resolveActor(req),
        status as
          | "pending"
          | "granted"
          | "rejected"
          | "expired"
          | "cancelled"
          | undefined,
      ),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Approval queue could not be read");
  }
});

router.post("/", (req, res) => {
  try {
    const body = objectBody(req.body);
    const approvalType =
      typeof body.approval_type === "string"
        ? body.approval_type
        : "";

    const approval = requestApproval(
      {
        workflow_id: typeof body.workflow_id === "string" ? body.workflow_id : "",
        version_id:
          typeof body.version_id === "string" ? body.version_id : null,
        execution_id:
          typeof body.execution_id === "string" ? body.execution_id : null,
        step_id: typeof body.step_id === "string" ? body.step_id : null,
        approval_type: approvalType as "connector_action",
        idempotency_key:
          typeof body.idempotency_key === "string" ? body.idempotency_key : "",
        expires_at:
          typeof body.expires_at === "string" ? body.expires_at : "",
        decision_note:
          typeof body.decision_note === "string" ? body.decision_note : null,
      },
      resolveActor(req),
    );

    return res.status(201).json({ approval });
  } catch (error) {
    return sendSafeError(req, res, error, "Approval request could not be created");
  }
});

router.post("/:approvalId/approve", (req, res) => {
  try {
    const body = objectBody(req.body);
    const approval = decideApproval(
      String(req.params.approvalId),
      "approve",
      resolveActor(req),
      typeof body.note === "string" ? body.note : undefined,
    );
    return res.json({ approval });
  } catch (error) {
    return sendSafeError(req, res, error, "Approval could not be granted");
  }
});

router.post("/:approvalId/reject", (req, res) => {
  try {
    const body = objectBody(req.body);
    const approval = decideApproval(
      String(req.params.approvalId),
      "reject",
      resolveActor(req),
      typeof body.note === "string" ? body.note : undefined,
    );
    return res.json({ approval });
  } catch (error) {
    return sendSafeError(req, res, error, "Approval could not be rejected");
  }
});

// No publish, execute, replay, or public expiry route is registered.

export default router;
