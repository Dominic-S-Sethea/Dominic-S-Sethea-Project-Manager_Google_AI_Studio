import { Router } from "express";
import { dependencyService } from "../services/dependency.service.ts";
import { taskService } from "../services/task.service.ts";
import { requireAuth, requireRole } from "../middleware/auth.middleware.ts";
import { getProjectAccess } from "../services/projectAccess.service.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";

const router = Router();

function actorFrom(req: AuthRequest): Actor {
  const user = req.user!;
  return { actor_type: "user", actor_id: user.user_id };
}

// Helper: check if caller can write a dependency (owner role, or editor who owns the task)
async function canWriteDependency(req: AuthRequest, taskId: string): Promise<boolean> {
  const user = req.user!;
  if (user.role === "owner") return true;

  const task = await taskService.get(taskId);
  if (!task) return false;

  if (user.role === "editor") return task.created_by === user.user_id;
  return false;
}

// GET /api/dependencies — read-only for dependencies in projects the caller is a member of
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const dependencies = await dependencyService.getAll();
    const accessible: typeof dependencies = [];
    for (const d of dependencies) {
      const access = await getProjectAccess(d.task_id, user.user_id);
      if (access !== null && access.canRead) {
        accessible.push(d);
      }
    }
    res.json({ dependencies: accessible });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dependencies" });
  }
});

// GET /api/dependencies/task/:taskId — read-only for task project members
router.get("/task/:taskId", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const task = await taskService.get(req.params.taskId as string);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const access = await getProjectAccess(task.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const dependencies = await dependencyService.findByTask(req.params.taskId as string);
    res.json({ dependencies });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dependencies" });
  }
});

// GET /api/dependencies/:id — read-only for task project members
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const dependency = await dependencyService.get(req.params.id as string);
    if (!dependency) return res.status(404).json({ message: "Dependency not found" });
    const task = await taskService.get(dependency.task_id);
    if (!task) return res.status(404).json({ message: "Dependency not found" });
    const access = await getProjectAccess(task.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    res.json({ dependency });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dependency" });
  }
});

// POST /api/dependencies — owner and editor can create
router.post("/", requireAuth, requireRole("owner", "editor"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.task_id || !body.depends_on_id) {
      return res.status(400).json({ message: "task_id and depends_on_id are required" });
    }

    const user = (req as AuthRequest).user!;
    if (user.role === "editor") {
      const task = await taskService.get(body.task_id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.created_by !== user.user_id) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
    }

    const dep = await dependencyService.create({
      task_id: body.task_id,
      depends_on_id: body.depends_on_id,
      dependency_type: body.dependency_type || "blocks",
    });
    const depTask = await taskService.get(dep.task_id);
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: depTask?.project_id ?? null,
        action: "dependency.created",
        target_table: "task_dependencies",
        target_id: dep.id,
        new_value: dep,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ dependency: dep });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create dependency";
    if (
      message === "Self-dependency is not allowed" ||
      message === "Circular dependency detected" ||
      message.startsWith("Invalid dependency_type") ||
      message.startsWith("Task not found")
    ) {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: "Failed to create dependency" });
  }
});

// PUT /api/dependencies/:id — owner all, editor own content only
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const dep = await dependencyService.get(req.params.id as string);
    if (!dep) return res.status(404).json({ message: "Dependency not found" });

    const owned = await canWriteDependency(req as AuthRequest, dep.task_id);
    if (!owned) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const body = req.body;
    const updated = await dependencyService.update(req.params.id as string, {
      depends_on_id: body.depends_on_id,
      dependency_type: body.dependency_type,
    });
    if (!updated) return res.status(404).json({ message: "Dependency not found" });
    const updatedTask = await taskService.get(updated.task_id);
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: updatedTask?.project_id ?? null,
        action: "dependency.updated",
        target_table: "task_dependencies",
        target_id: updated.id,
        new_value: updated,
        trigger: "api",
      },
      req,
    );
    res.json({ dependency: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update dependency";
    if (
      message === "Self-dependency is not allowed" ||
      message === "Circular dependency detected" ||
      message.startsWith("Invalid dependency_type") ||
      message.startsWith("Task not found")
    ) {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: "Failed to update dependency" });
  }
});

// DELETE /api/dependencies/:id — owner all, editor own content only
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const dep = await dependencyService.get(req.params.id as string);
    if (!dep) return res.status(404).json({ message: "Dependency not found" });

    const owned = await canWriteDependency(req as AuthRequest, dep.task_id);
    if (!owned) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const depTask = await taskService.get(dep.task_id);
    const deleted = await dependencyService.delete(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: "Dependency not found" });
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: depTask?.project_id ?? null,
        action: "dependency.deleted",
        target_table: "task_dependencies",
        target_id: dep.id,
        old_value: dep,
        trigger: "api",
      },
      req,
    );
    res.json({ message: "Dependency deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete dependency" });
  }
});

export default router;
