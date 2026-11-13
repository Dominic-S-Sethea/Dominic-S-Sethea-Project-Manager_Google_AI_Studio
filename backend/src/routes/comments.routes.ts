import { Router } from "express";
import { commentService, type CommentCreate, type CommentUpdate } from "../services/comment.service.ts";
import { requireAuth, requireRole } from "../middleware/auth.middleware.ts";
import { getProjectAccess } from "../services/projectAccess.service.ts";
import { taskService } from "../services/task.service.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";

const router = Router();

function actorFrom(req: AuthRequest): Actor {
  const user = req.user!;
  return { actor_type: "user", actor_id: user.user_id };
}

// List comments for a task — read-only for task project members
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const taskId = (req.query.task_id as string) || undefined;
    if (!taskId) {
      return res.status(400).json({ message: "task_id is required" });
    }
    const task = await taskService.get(taskId);
    if (!task) {
      // Non-existent task: return empty list (preserves cross-task isolation behavior)
      return res.json({ comments: [] });
    }
    const access = await getProjectAccess(task.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const comments = await commentService.getByTask(taskId);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

// Create a comment — owner, editor, commenter
router.post("/", requireAuth, requireRole("owner", "editor", "commenter"), async (req, res) => {
  try {
    const body = req.body as CommentCreate;
    if (!body.task_id || !body.body) {
      return res.status(400).json({ message: "task_id and body are required" });
    }
    const comment = await commentService.create({
      task_id: body.task_id,
      body: body.body,
      author_id: (req as AuthRequest).user!.user_id,
    });
    const commentTask = await taskService.get(comment.task_id);
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: commentTask?.project_id ?? null,
        action: "comment.created",
        target_table: "comments",
        target_id: comment.comment_id,
        new_value: comment,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ message: "Failed to create comment" });
  }
});

// Update a comment — owner/editor all, commenter own only
router.put("/:commentId", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const comment = await commentService.get(req.params.commentId as string);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (user.role !== "owner" && user.role !== "editor" && comment.author_id !== user.user_id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const body = req.body as CommentUpdate;
    const updated = await commentService.update(req.params.commentId as string, {
      body: body.body,
    });
    if (!updated) return res.status(404).json({ message: "Comment not found" });
    const updatedTask = await taskService.get(updated.task_id);
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: updatedTask?.project_id ?? null,
        action: "comment.updated",
        target_table: "comments",
        target_id: updated.comment_id,
        new_value: updated,
        trigger: "api",
      },
      req,
    );
    res.json({ comment: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update comment" });
  }
});

// Delete a comment — owner/editor all, commenter own only
router.delete("/:commentId", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const comment = await commentService.get(req.params.commentId as string);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (user.role !== "owner" && user.role !== "editor" && comment.author_id !== user.user_id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const commentTask = await taskService.get(comment.task_id);
    const deleted = await commentService.delete(req.params.commentId as string);
    if (!deleted) return res.status(404).json({ message: "Comment not found" });
    recordRequestAction(
      {
        actor: actorFrom(req as AuthRequest),
        project_id: commentTask?.project_id ?? null,
        action: "comment.deleted",
        target_table: "comments",
        target_id: comment.comment_id,
        old_value: comment,
        trigger: "api",
      },
      req,
    );
    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

export default router;
