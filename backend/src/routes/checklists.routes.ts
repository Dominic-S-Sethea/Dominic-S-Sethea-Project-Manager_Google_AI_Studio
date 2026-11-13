import { Router } from "express";
import { checklistService } from "../services/checklist.service.ts";
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

// Helper: check if caller can write a checklist (owner role, or editor who owns the parent task)
async function canWriteChecklist(req: AuthRequest, checklistId: string): Promise<boolean> {
  const user = req.user!;
  if (user.role === "owner") return true;

  const checklist = await checklistService.get(checklistId);
  if (!checklist) return false;

  const task = await taskService.get(checklist.task_id);
  if (!task) return false;

  if (user.role === "editor") return task.created_by === user.user_id;
  return false;
}

// GET /api/checklists — read-only for checklists in projects the caller is a member of
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const checklists = await checklistService.getAll();
    const accessible: typeof checklists = [];
    for (const c of checklists) {
      const access = await getProjectAccess(c.task_id, user.user_id);
      if (access !== null && access.canRead) {
        accessible.push(c);
      }
    }
    res.json({ checklists: accessible });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch checklists" });
  }
});

// GET /api/checklists/task/:taskId — read-only for task project members
router.get("/task/:taskId", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const task = await taskService.get(req.params.taskId as string);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const access = await getProjectAccess(task.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const checklists = await checklistService.getByTask(req.params.taskId as string);
    res.json({ checklists });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch checklists" });
  }
});

// GET /api/checklists/:id — read-only for task project members
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const checklist = await checklistService.get(req.params.id as string);
    if (!checklist) return res.status(404).json({ message: "Checklist not found" });
    const task = await taskService.get(checklist.task_id);
    if (!task) return res.status(404).json({ message: "Checklist not found" });
    const access = await getProjectAccess(task.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    res.json({ checklist });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch checklist" });
  }
});

// POST /api/checklists — owner and editor can create
router.post("/", requireAuth, requireRole("owner", "editor"), async (req, res) => {
  try {
    const body = req.body;
    if (!body.task_id || !body.title) {
      return res.status(400).json({ message: "task_id and title are required" });
    }

    const user = (req as AuthRequest).user!;
    if (user.role === "editor") {
      const task = await taskService.get(body.task_id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.created_by !== user.user_id) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
    }

    const checklist = await checklistService.create({
      task_id: body.task_id,
      title: body.title,
      items: body.items || [],
    });
    const checklistTask = await taskService.get(checklist.task_id);
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: checklistTask?.project_id ?? null,
        action: "checklist.created",
        target_table: "checklists",
        target_id: checklist.checklist_id,
        new_value: checklist,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ checklist });
  } catch (err) {
    res.status(500).json({ message: "Failed to create checklist" });
  }
});

// PUT /api/checklists/:id — owner all, editor own content only
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const owned = await canWriteChecklist(req as AuthRequest, req.params.id as string);
    if (!owned) {
      const checklist = await checklistService.get(req.params.id as string);
      if (!checklist) return res.status(404).json({ message: "Checklist not found" });
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const body = req.body;
    const checklist = await checklistService.update(req.params.id as string, {
      title: body.title,
      items: body.items,
    });
    if (!checklist) return res.status(404).json({ message: "Checklist not found" });
    const checklistTask = await taskService.get(checklist.task_id);
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: checklistTask?.project_id ?? null,
        action: "checklist.updated",
        target_table: "checklists",
        target_id: checklist.checklist_id,
        new_value: checklist,
        trigger: "api",
      },
      req,
    );
    res.json({ checklist });
  } catch (err) {
    res.status(500).json({ message: "Failed to update checklist" });
  }
});

// DELETE /api/checklists/:id — owner all, editor own content only
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const owned = await canWriteChecklist(req as AuthRequest, req.params.id as string);
    if (!owned) {
      const checklist = await checklistService.get(req.params.id as string);
      if (!checklist) return res.status(404).json({ message: "Checklist not found" });
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const existing = await checklistService.get(req.params.id as string);
    const existingTask = existing
      ? await taskService.get(existing.task_id)
      : null;
    const deleted = await checklistService.delete(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: "Checklist not found" });
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: existingTask?.project_id ?? null,
        action: "checklist.deleted",
        target_table: "checklists",
        target_id: existing!.checklist_id,
        old_value: existing,
        trigger: "api",
      },
      req,
    );
    res.json({ message: "Checklist deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete checklist" });
  }
});

export default router;
