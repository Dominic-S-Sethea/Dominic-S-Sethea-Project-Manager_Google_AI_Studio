import { Router, type Request } from "express";
import type { DatabaseSync } from "node:sqlite";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware.ts";
import { createExecution, transitionExecution } from "../services/execution.service.ts";

interface TableInfoRow { name: string }

function executionSchemaReady(db: DatabaseSync): boolean {
  try {
    const columns = db.prepare("PRAGMA table_info(executions)").all() as unknown as TableInfoRow[];
    return columns.some((column) => column.name === "preview");
  } catch {
    return false;
  }
}

function userId(req: Request): string | undefined {
  return (req as AuthRequest).user?.user_id;
}

export function createAutomationExecutionsRouter(db: DatabaseSync): Router {
  const router = Router();
  router.use(requireAuth);
  // Request-time check: the migration CLI can update the schema without a restart.
  router.use((_req, res, next) => {
    if (!executionSchemaReady(db)) {
      return res.status(503).json({ message: "Execution service temporarily unavailable" });
    }
    return next();
  });

  router.post("/", async (req, res) => {
    const actor = userId(req);
    if (!actor) return res.status(401).json({ message: "Authentication required" });
    try {
      const result = await createExecution(db, actor, req.body);
      return res.status(result.status).json(result.body);
    } catch {
      return res.status(500).json({ message: "Unable to create execution" });
    }
  });

  const actions = ["start", "pause", "resume", "rollback", "complete"] as const;
  for (const action of actions) {
    router.post(`/:id/${action}`, async (req, res) => {
      const actor = userId(req);
      if (!actor) return res.status(401).json({ message: "Authentication required" });
      try {
        const result = await transitionExecution(db, actor, req.params.id ?? "", action);
        return res.status(result.status).json(result.body);
      } catch {
        return res.status(500).json({ message: "Unable to update execution" });
      }
    });
  }
  return router;
}

