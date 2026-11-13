import { Router } from "express";
import { registerAgent } from "../services/agentAuthService.ts";
import { loginAgent } from "../services/agentLoginService.ts";
import { verifyAgentAuth, verifyAgentRole } from "../middleware/agentAuthMiddleware.ts";

const router = Router();

/**
 * POST /api/agents/register
 * Register a new agent with API key
 */
router.post("/register", registerAgent);

/**
 * POST /api/agents/login
 * Agent login endpoint
 */
router.post("/login", loginAgent);

/**
 * GET /api/agents/me
 * Get current agent information
 */
router.get("/me", verifyAgentAuth, (req: any, res) => {
  res.json({ agent: req.agent });
});

export default router;
