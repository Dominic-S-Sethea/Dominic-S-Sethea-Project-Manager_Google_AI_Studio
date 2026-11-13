import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface Task {
  task_id: string;
  project_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "normal" | "high" | "urgent";
  assignee_id: string | null;
  created_by: string;
  metadata: Record<string, unknown>;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  project_id: string;
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done" | "blocked";
  priority?: "low" | "normal" | "high" | "urgent";
  assignee_id?: string | null;
  created_by: string;
  metadata?: Record<string, unknown>;
  due_date?: string | null;
}

export interface TaskUpdate {
  project_id?: string;
  title?: string;
  description?: string;
  status?: "todo" | "in_progress" | "done" | "blocked";
  priority?: "low" | "normal" | "high" | "urgent";
  assignee_id?: string | null;
  metadata?: Record<string, unknown>;
  due_date?: string | null;
}

const VALID_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function validateStatus(status: string): void {
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new Error(`Invalid status: ${status}`);
  }
}

function validatePriority(priority: string): void {
  if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
    throw new Error(`Invalid priority: ${priority}`);
  }
}

const db = getDb();

export class TaskService {
  async create(data: TaskCreate): Promise<Task> {
    const now = new Date().toISOString();
    const taskId = uuidv4();
    const metadata: Record<string, unknown> = data.metadata || {};

    const sql = `
      INSERT INTO tasks (task_id, project_id, title, description, status, priority, assignee_id, created_by, metadata, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.prepare(sql).run(
      taskId,
      data.project_id,
      data.title,
      data.description || null,
      (() => { const s = data.status || "todo"; validateStatus(s); return s; })(),
      (() => { const p = data.priority || "normal"; validatePriority(p); return p; })(),
      data.assignee_id || null,
      data.created_by,
      JSON.stringify(metadata),
      data.due_date || null,
      now,
      now,
    );

    const created = await this.get(taskId);
    if (!created) throw new Error("Failed to create task");
    return created;
  }

  async get(taskId: string): Promise<Task | null> {
    const rows = db.prepare("SELECT * FROM tasks WHERE task_id = ?").all(taskId);
    if (rows.length === 0) return null;
    return this.rowToTask(rows[0]);
  }

  async getByProject(projectId: string): Promise<Task[]> {
    const sql = "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(projectId);
    return rows.map(r => this.rowToTask(r));
  }

  async getAll(status?: "todo" | "in_progress" | "done" | "blocked"): Promise<Task[]> {
    let sql = "SELECT * FROM tasks";
    const params: string[] = [];
    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...params);
    return rows.map(r => this.rowToTask(r));
  }

  async update(taskId: string, data: TaskUpdate): Promise<Task | null> {
    const existing = await this.get(taskId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      params.push(data.description || null);
    }
    if (data.status !== undefined) {
      validateStatus(data.status);
      updates.push("status = ?");
      params.push(data.status);
    }
    if (data.priority !== undefined) {
      validatePriority(data.priority);
      updates.push("priority = ?");
      params.push(data.priority);
    }
    if (data.assignee_id !== undefined) {
      updates.push("assignee_id = ?");
      params.push(data.assignee_id || null);
    }
    if (data.due_date !== undefined) {
      updates.push("due_date = ?");
      params.push(data.due_date || null);
    }
    if (data.metadata !== undefined) {
      const current = existing.metadata;
      updates.push("metadata = ?");
      params.push(JSON.stringify({ ...current, ...data.metadata }) as string);
    }

    if (data.project_id !== undefined && data.project_id !== null && data.project_id !== "") {
      // Validate project exists and is not archived
      const projectRows = db.prepare("SELECT status FROM projects WHERE project_id = ?").all(data.project_id);
      if (projectRows.length === 0) {
        throw new Error("Project not found");
      }
      if ((projectRows[0] as { status: string }).status === "archived") {
        throw new Error("Cannot assign task to an archived project");
      }
      updates.push("project_id = ?");
      params.push(data.project_id);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(now);
    params.push(taskId);

    const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE task_id = ?`;
    db.prepare(sql).run(...params);

    return this.get(taskId);
  }

  async delete(taskId: string): Promise<boolean> {
    const existing = await this.get(taskId);
    if (!existing) return false;
    db.prepare("DELETE FROM tasks WHERE task_id = ?").run(taskId);
    return true;
  }

  private rowToTask(row: any): Task {
    return {
      task_id: row.task_id,
      project_id: row.project_id,
      title: row.title,
      description: row.description ?? "",
      status: row.status as "todo" | "in_progress" | "done" | "blocked",
      priority: row.priority as "low" | "normal" | "high" | "urgent",
      assignee_id: row.assignee_id ?? null,
      created_by: row.created_by,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      due_date: row.due_date ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const taskService = new TaskService();
