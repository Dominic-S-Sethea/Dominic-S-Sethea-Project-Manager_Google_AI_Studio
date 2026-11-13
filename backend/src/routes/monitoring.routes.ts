import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import * as monitoringService from "../services/monitoring.service.ts";

const router = Router();

// Health check (no auth required)
router.get("/health", (_req, res) => {
  const health = monitoringService.getHealthStatus();
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics (auth required)
router.get("/metrics", requireAuth, (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    res.json({ metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
