import { Router } from "express";
import { gitService } from "../services/git.service.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";

const router = Router();

/**
 * POST /api/git/commits
 * Record a git commit and optionally link to tasks (auto-close if task ref found)
 */
router.post("/commits", requireAuth, async (req, res) => {
  try {
    const { commit_hash, commit_message, author, committed_at, auto_close } = req.body;
    if (!commit_hash || !commit_message) {
      return res.status(400).json({ message: "commit_hash and commit_message are required" });
    }

    const result = await gitService.recordCommit(
      commit_hash,
      commit_message,
      author,
      committed_at,
      auto_close !== false
    );

    res.status(201).json({
      commit: result.commit,
      linked_tasks: result.linkedTasks,
      closed_tasks: result.closedTasks,
      message: result.closedTasks.length > 0
        ? `Commit recorded. Auto-closed ${result.closedTasks.length} task(s).`
        : result.linkedTasks.length > 0
        ? `Commit recorded. Linked to ${result.linkedTasks.length} task(s).`
        : "Commit recorded. No task references found.",
    });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to record commit", error: err.message });
  }
});

/**
 * GET /api/git/commits
 * List all recorded commits
 */
router.get("/commits", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const commits = await gitService.getAllCommits(limit);
    res.json({ commits });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch commits", error: err.message });
  }
});

/**
 * GET /api/git/commits/task/:taskId
 * Get commits linked to a specific task
 */
router.get("/commits/task/:taskId", requireAuth, async (req, res) => {
  try {
    const commits = await gitService.getCommitsByTask(req.params.taskId as string);
    res.json({ commits });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch commits", error: err.message });
  }
});

/**
 * POST /api/git/commits/:commitId/link
 * Manually link a commit to a task
 */
router.post("/commits/:commitId/link", requireAuth, async (req, res) => {
  try {
    const { task_id } = req.body;
    if (!task_id) {
      return res.status(400).json({ message: "task_id is required" });
    }
    const success = await gitService.linkCommitToTask(req.params.commitId as string, task_id);
    if (!success) {
      return res.status(404).json({ message: "Commit not found" });
    }
    res.json({ message: "Commit linked to task", task_id });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to link commit", error: err.message });
  }
});

/**
 * POST /api/git/parse
 * Parse a commit message for task references (preview, no DB write)
 */
router.post("/parse", requireAuth, async (req, res) => {
  try {
    const { commit_message } = req.body;
    if (!commit_message) {
      return res.status(400).json({ message: "commit_message is required" });
    }
    const taskRefs = gitService.parseTaskReferences(commit_message);
    res.json({ task_references: taskRefs });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to parse message", error: err.message });
  }
});

export default router;
