import { Router, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { requireAuth } from "../middleware/auth.middleware.ts";
import {
  getRequestId,
  resolveActor,
  sendSafeError,
  ServiceError,
} from "../services/actor.service.ts";
import { createTestExecution } from "../services/automationTestRun.ts";
import {
  listExecutionTraces,
  readExecutionTrace,
  replayExecution,
} from "../services/automationTrace.ts";

function requireUserId(req: Request): string {
  const actor = resolveActor(req);

  if (actor.actor_type !== "user" || !actor.actor_id.trim()) {
    throw new ServiceError(
      401,
      "A signed-in user is required.",
      "USER_AUTH_REQUIRED",
    );
  }

  return actor.actor_id;
}

function optionalQueryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalQueryInteger(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (typeof value === "undefined") return undefined;

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ServiceError(
      400,
      `${fieldName} must be a non-negative integer.`,
      "INVALID_QUERY_PARAMETER",
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ServiceError(
      400,
      `${fieldName} is outside the supported range.`,
      "INVALID_QUERY_PARAMETER",
    );
  }

  return parsed;
}

function handleSafeError(
  req: Request,
  res: Response,
  error: unknown,
  fallbackMessage: string,
): void {
  sendSafeError(req, res, error, fallbackMessage);
}

export function createAutomationTestRouter(db: DatabaseSync): Router {
  const router = Router();

  router.post("/workflows/:id/test", requireAuth, async (req, res) => {
    try {
      getRequestId(req);
      const userId = requireUserId(req);
      const workflowId = String(req.params.id ?? "");

      const result = await createTestExecution(
        db,
        userId,
        workflowId,
        req.body,
      );

      return res.status(result.status).json(result.body);
    } catch (error) {
      return handleSafeError(
        req,
        res,
        error,
        "Unable to run the pinned test execution.",
      );
    }
  });

  router.get("/executions", requireAuth, async (req, res) => {
    try {
      getRequestId(req);
      const userId = requireUserId(req);
      const workflowId = optionalQueryString(req.query.workflow_id);

      if (!workflowId) {
        throw new ServiceError(
          400,
          "workflow_id is required.",
          "WORKFLOW_ID_REQUIRED",
        );
      }

      const result = await listExecutionTraces(db, userId, {
        workflowId,
        limit: optionalQueryInteger(req.query.limit, "limit"),
        offset: optionalQueryInteger(req.query.offset, "offset"),
        status: optionalQueryString(req.query.status),
      });

      return res.status(200).json(result);
    } catch (error) {
      return handleSafeError(
        req,
        res,
        error,
        "Unable to list execution traces.",
      );
    }
  });

  router.get("/executions/:id", requireAuth, async (req, res) => {
    try {
      getRequestId(req);
      const userId = requireUserId(req);
      const result = await readExecutionTrace(
        db,
        userId,
        String(req.params.id ?? ""),
      );

      return res.status(200).json(result);
    } catch (error) {
      return handleSafeError(
        req,
        res,
        error,
        "Unable to read the execution trace.",
      );
    }
  });

  router.post("/executions/:id/replay", requireAuth, (req, res) => {
    try {
      getRequestId(req);
      const userId = requireUserId(req);

      replayExecution(
        db,
        userId,
        String(req.params.id ?? ""),
      );

      return res.status(423).json({
        error: "Replay is disabled in preview-only mode.",
        code: "REPLAY_DISABLED",
        request_id: getRequestId(req),
      });
    } catch (error) {
      return handleSafeError(
        req,
        res,
        error,
        "Replay is disabled in preview-only mode.",
      );
    }
  });

  return router;
}