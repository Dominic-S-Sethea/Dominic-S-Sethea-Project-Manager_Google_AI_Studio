import { Router } from "express";
import { taskService } from "../services/task.service.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import { getProjectAccess } from "../services/projectAccess.service.ts";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const allTasks = await taskService.getAll();
    const tasks: typeof allTasks = [];
    for (const t of allTasks) {
      const access = await getProjectAccess(t.project_id, user.user_id);
      if (access !== null && access.canRead) {
        tasks.push(t);
      }
    }
    const total = tasks.length;
    const statusCounts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, blocked: 0 };
    const priorityCounts: Record<string, number> = { low: 0, normal: 0, high: 0, urgent: 0 };
    const today = new Date();
    const dueSoon: { task_id: string; title: string; due_date: string | null; days_until_due: number }[] = [];
    const overdue: { task_id: string; title: string; due_date: string | null }[] = [];

    for (const task of tasks) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;

      if (task.due_date) {
        const due = new Date(task.due_date);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) {
          overdue.push({ task_id: task.task_id, title: task.title, due_date: task.due_date });
        } else if (diff <= 14) {
          dueSoon.push({
            task_id: task.task_id,
            title: task.title,
            due_date: task.due_date,
            days_until_due: diff,
          });
        }
      }
    }

    res.json({
      total_tasks: total,
      status_counts: statusCounts,
      priority_counts: priorityCounts,
      due_soon: dueSoon,
      due_soon_count: dueSoon.length,
      overdue_count: overdue.length,
      overdue: overdue,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dashboard" });
  }
});

export default router;
