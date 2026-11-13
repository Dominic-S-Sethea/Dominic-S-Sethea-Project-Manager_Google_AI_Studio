import { Router } from "express";
import { UserService, VALID_ROLES } from "../services/user.service.ts";
import type { UserUpdate } from "../services/user.service.ts";
import { requireAuth, requireRole } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";

const router = Router();
const userService = new UserService();

function actorFrom(req: AuthRequest): Actor {
  const user = req.user!;
  return { actor_type: "user", actor_id: user.user_id };
}

/**
 * GET /api/users/me
 * Get current user's profile
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthRequest).user!.user_id;
    const user = await userService.get(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
});

/**
 * GET /api/users/me/login-history
 * Get recent login history for the current user
 */
router.get("/me/login-history", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthRequest).user!.user_id;
    const history = await userService.getLoginHistory(userId, 3);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch login history" });
  }
});

/**
 * GET /api/users
 * List all users (owner and editor)
 */
router.get("/", requireAuth, requireRole("owner", "editor"), async (req, res) => {
  try {
    const users = await userService.getAll();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * POST /api/users
 * Create a new user (owner and editor; editor cannot assign owner role)
 */
router.post("/", requireAuth, requireRole("owner", "editor"), async (req, res) => {
  try {
    const body = req.body as { username: string; email: string; password: string; role?: string };
    if (!body.username || !body.email || !body.password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    const actor = (req as AuthRequest).user!;
    const role = body.role || "viewer";

    // Editor cannot assign the owner role to anyone
    if (actor.role !== "owner" && role === "owner") {
      return res.status(403).json({ message: "Only owners can assign the owner role" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role: must be one of ${VALID_ROLES.join(", ")}` });
    }

    const user = await userService.create({
      username: body.username,
      email: body.email,
      password: body.password,
      role,
    });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "user.created",
        target_table: "users",
        target_id: user.user_id,
        new_value: user,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ user });
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      return res.status(409).json({ message: "User already exists" });
    }
    res.status(500).json({ message: "Failed to create user" });
  }
});

/**
 * PUT /api/users/:id — Update a user
 * Role changes are owner-only; editors can update non-role fields.
 * Self-promotion to owner is never allowed.
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id as string;
    const actor = (req as AuthRequest).user!;
    const body = req.body as Partial<UserUpdate>;

    // Role changes are owner-only
    if (body.role !== undefined) {
      if (actor.role !== "owner") {
        return res.status(403).json({ message: "Only owners can change user roles" });
      }
      if (!VALID_ROLES.includes(body.role)) {
        return res.status(400).json({ message: `Invalid role: must be one of ${VALID_ROLES.join(", ")}` });
      }
      // Prevent any user (including owner) from demoting themselves to non-owner? No — owner can self-manage.
      // Prevent self-promotion: an editor cannot promote themselves to owner
      if (actor.user_id === userId && actor.role !== "owner" && body.role === "owner") {
        return res.status(403).json({ message: "Self-promotion to owner is not allowed" });
      }
    }

    const existing = await userService.get(userId);
    if (!existing) return res.status(404).json({ message: "User not found" });
    const user = await userService.update(userId, body);
    if (!user) return res.status(404).json({ message: "User not found" });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "user.updated",
        target_table: "users",
        target_id: user.user_id,
        old_value: existing,
        new_value: user,
        trigger: "api",
      },
      req,
    );
    res.json({ user });
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      return res.status(409).json({ message: "User already exists" });
    }
    res.status(500).json({ message: "Failed to update user" });
  }
});

export default router;
