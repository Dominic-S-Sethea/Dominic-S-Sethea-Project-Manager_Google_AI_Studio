import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware.ts";
import { ingestEvent } from "../services/eventIngestion.service.ts";

export function createAutomationEventsRouter(db: DatabaseSync): Router {
  const router = Router();
  router.use(requireAuth);
  router.post("/", async (req, res) => {
    const userId = (req as AuthRequest).user?.user_id;
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    try {
      const result = await ingestEvent(db, userId, req.body);
      return res.status(result.status).json(result.body);
    } catch {
      return res.status(500).json({ message: "Unable to ingest event" });
    }
  });
  return router;
}

