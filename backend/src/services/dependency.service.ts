import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  dependency_type: "blocks" | "blocked_by";
  created_at: string;
}

export interface DependencyCreate {
  task_id: string;
  depends_on_id: string;
  dependency_type: "blocks" | "blocked_by";
}

export interface DependencyUpdate {
  depends_on_id?: string;
  dependency_type?: "blocks" | "blocked_by";
}

const VALID_TYPES: ReadonlyArray<"blocks" | "blocked_by"> = ["blocks", "blocked_by"];

const db = getDb();

export class DependencyService {
  async create(data: DependencyCreate): Promise<TaskDependency> {
    // D-01: Reject self-dependency
    if (data.task_id === data.depends_on_id) {
      throw new Error("Self-dependency is not allowed");
    }

    // D-03: Validate dependency_type
    if (!VALID_TYPES.includes(data.dependency_type)) {
      throw new Error(`Invalid dependency_type: must be one of ${VALID_TYPES.join(", ")}`);
    }

    // D-05: Validate both task IDs exist
    const taskExists = db
      .prepare("SELECT 1 FROM tasks WHERE task_id = ?")
      .get(data.task_id);
    if (!taskExists) {
      throw new Error(`Task not found: ${data.task_id}`);
    }
    const targetExists = db
      .prepare("SELECT 1 FROM tasks WHERE task_id = ?")
      .get(data.depends_on_id);
    if (!targetExists) {
      throw new Error(`Task not found: ${data.depends_on_id}`);
    }

    // Prevent duplicate dependencies
    const existing = await this.findByTaskAndTarget(data.task_id, data.depends_on_id);
    if (existing) {
      return existing as TaskDependency;
    }

    // D-02: Reject circular dependencies
    if (await this.wouldCreateCycle(data.task_id, data.depends_on_id)) {
      throw new Error("Circular dependency detected");
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    const sql = `
      INSERT INTO task_dependencies (id, task_id, depends_on_id, dependency_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.prepare(sql).run(id, data.task_id, data.depends_on_id, data.dependency_type, now);

    const created = await this.get(id);
    if (!created) throw new Error("Failed to create dependency");
    return created;
  }

  /**
   * D-02: Check whether adding an edge from `source` to `target` would create
   * a cycle in the dependency graph. A cycle exists if `target` can reach
   * `source` through existing dependency edges (task_id -> depends_on_id).
   */
  private async wouldCreateCycle(source: string, target: string): Promise<boolean> {
    // BFS from target following edges where target is the task_id, i.e.,
    // target depends on X, X depends on Y, ... looking for source.
    const visited = new Set<string>();
    const queue = [target];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === source) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const rows = db
        .prepare("SELECT depends_on_id FROM task_dependencies WHERE task_id = ?")
        .all(current) as Array<{ depends_on_id: string }>;

      for (const row of rows) {
        if (!visited.has(row.depends_on_id)) queue.push(row.depends_on_id);
      }
    }

    return false;
  }

  async get(id: string): Promise<TaskDependency | null> {
    const rows = db.prepare("SELECT * FROM task_dependencies WHERE id = ?").all(id);
    if (rows.length === 0) return null;
    return this.rowToDependency(rows[0]);
  }

  async findByTaskAndTarget(taskId: string, targetId: string): Promise<TaskDependency | null> {
    const rows = db.prepare(
      "SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?"
    ).all(taskId, targetId);
    if (rows.length === 0) return null;
    return this.rowToDependency(rows[0]);
  }

  // D-04: Return all dependencies for a task (both directions), not just type='blocks'.
  async findByTask(taskId: string, includeSelf: boolean = false): Promise<TaskDependency[]> {
    if (includeSelf) {
      const sql = "SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY created_at DESC";
      const rows = db.prepare(sql).all(taskId);
      return rows.map((r) => this.rowToDependency(r));
    }
    const sql =
      "SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(taskId);
    return rows.map((r) => this.rowToDependency(r));
  }

  async findBlockingTasks(taskId: string): Promise<TaskDependency[]> {
    const sql =
      "SELECT * FROM task_dependencies WHERE depends_on_id = ? AND dependency_type = 'blocked_by' ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(taskId);
    return rows.map((r) => this.rowToDependency(r));
  }

  async findBlockedByTasks(taskId: string): Promise<TaskDependency[]> {
    const sql =
      "SELECT * FROM task_dependencies WHERE task_id = ? AND dependency_type = 'blocks' ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(taskId);
    return rows.map((r) => this.rowToDependency(r));
  }

  async findByTaskId(taskId: string): Promise<TaskDependency[]> {
    const sql = "SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(taskId);
    return rows.map((r) => this.rowToDependency(r));
  }

  async getAll(): Promise<TaskDependency[]> {
    const sql = "SELECT * FROM task_dependencies ORDER BY created_at DESC";
    const rows = db.prepare(sql).all();
    return rows.map((r) => this.rowToDependency(r));
  }

  async update(id: string, data: DependencyUpdate): Promise<TaskDependency | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    // D-03: Validate dependency_type if provided
    if (data.dependency_type !== undefined && !VALID_TYPES.includes(data.dependency_type)) {
      throw new Error(`Invalid dependency_type: must be one of ${VALID_TYPES.join(", ")}`);
    }

    const updates: string[] = [];
    const params: (string | null)[] = [];

    let newDependsOnId = existing.depends_on_id;
    let newDependencyType = existing.dependency_type;

    if (data.depends_on_id !== undefined) {
      newDependsOnId = data.depends_on_id;
      updates.push("depends_on_id = ?");
      params.push(data.depends_on_id);
    }
    if (data.dependency_type !== undefined) {
      newDependencyType = data.dependency_type;
      updates.push("dependency_type = ?");
      params.push(data.dependency_type);
    }

    // D-01: Reject self-dependency on update
    if (existing.task_id === newDependsOnId) {
      throw new Error("Self-dependency is not allowed");
    }

    // D-05: Validate target task exists on update
    if (data.depends_on_id !== undefined) {
      const targetExists = db
        .prepare("SELECT 1 FROM tasks WHERE task_id = ?")
        .get(data.depends_on_id);
      if (!targetExists) {
        throw new Error(`Task not found: ${data.depends_on_id}`);
      }
    }

    // D-02: Reject circular dependency on update
    if (data.depends_on_id !== undefined && data.depends_on_id !== existing.depends_on_id) {
      if (await this.wouldCreateCycle(existing.task_id, data.depends_on_id)) {
        throw new Error("Circular dependency detected");
      }
    }

    if (updates.length === 0) return existing;

    params.push(id);
    db.prepare(`UPDATE task_dependencies SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) return false;
    db.prepare("DELETE FROM task_dependencies WHERE id = ?").run(id);
    return true;
  }

  async deleteByTask(taskId: string): Promise<number> {
    const result = db.prepare("DELETE FROM task_dependencies WHERE task_id = ?").run(taskId);
    return result.changes as number;
  }

  private rowToDependency(row: any): TaskDependency {
    return {
      id: row.id,
      task_id: row.task_id,
      depends_on_id: row.depends_on_id,
      dependency_type: row.dependency_type as "blocks" | "blocked_by",
      created_at: row.created_at,
    };
  }
}

export const dependencyService = new DependencyService();
