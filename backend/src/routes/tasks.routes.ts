import { Router } from "express";
import { taskService, type TaskCreate, type TaskUpdate } from "../services/task.service.ts";
import { requireAuth, requireRole } from "../middleware/auth.middleware.ts";
import { getProjectAccess } from "../services/projectAccess.service.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";

const router = Router();

function actorFrom(req: AuthRequest): Actor {
  const user = req.user!;
  return { actor_type: "user", actor_id: user.user_id };
}

// GET /api/tasks — read-only for tasks in projects the caller is a member of
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const status = (req.query.status as "todo" | "in_progress" | "done" | "blocked") || undefined;
    const projectId = (req.query.project_id as string) || undefined;
    let tasks;
    if (projectId) {
      const access = await getProjectAccess(projectId, user.user_id);
      if (!access || !access.canRead) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      tasks = await taskService.getByProject(projectId);
      if (status) tasks = tasks.filter((t) => t.status === status);
    } else {
      tasks = await taskService.getAll(status);
      const accessible: typeof tasks = [];
      for (const t of tasks) {
        const access = await getProjectAccess(t.project_id, user.user_id);
        if (access !== null && access.canRead) {
          accessible.push(t);
        }
      }
      tasks = accessible;
      if (status) tasks = tasks.filter((t) => t.status === status);
    }
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

// GET /api/tasks/:id — read-only for task project members
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const task = await taskService.get(req.params.id as string);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const access = await getProjectAccess(task.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    res.json({ task });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch task" });
  }
});

// POST /api/tasks — owner and editor can create
router.post("/", requireAuth, requireRole("owner", "editor"), async (req, res) => {
  try {
    const body = req.body as TaskCreate;
    if (!body.project_id || !body.title) {
      return res.status(400).json({ message: "project_id and title are required" });
    }
    const user = (req as AuthRequest).user!;
    const task = await taskService.create({
      project_id: body.project_id,
      title: body.title,
      description: body.description || "",
      status: body.status || "todo",
      priority: body.priority || "normal",
      assignee_id: body.assignee_id || null,
      created_by: user.user_id,
      metadata: body.metadata || {},
      due_date: body.due_date || null,
    });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: task.project_id,
        action: "task.created",
        target_table: "tasks",
        target_id: task.task_id,
        new_value: task,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create task";
    if (
      message.startsWith("Invalid status") ||
      message.startsWith("Invalid priority")
    ) {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: "Failed to create task" });
  }
});

// PUT /api/tasks/:id — owner all, editor own content only
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const task = await taskService.get(req.params.id as string);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (user.role !== "owner" && task.created_by !== user.user_id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const body = req.body as TaskUpdate;
    const updated = await taskService.update(req.params.id as string, body);
    if (!task) return res.status(404).json({ message: "Task not found" });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: task.project_id,
        action: "task.updated",
        target_table: "tasks",
        target_id: task.task_id,
        old_value: task,
        new_value: updated,
        trigger: "api",
      },
      req,
    );
    res.json({ task: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update task";
    if (
      message === "Project not found" ||
      message === "Cannot assign task to an archived project" ||
      message.startsWith("Invalid status") ||
      message.startsWith("Invalid priority")
    ) {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: "Failed to update task" });
  }
});

// DELETE /api/tasks/:id — owner all, editor own content only
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const task = await taskService.get(req.params.id as string);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (user.role !== "owner" && task.created_by !== user.user_id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const deleted = await taskService.delete(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: "Task not found" });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: task.project_id,
        action: "task.deleted",
        target_table: "tasks",
        target_id: task.task_id,
        old_value: task,
        trigger: "api",
      },
      req,
    );
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete task" });
  }
});

export default router;
