import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface Project {
  project_id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  created_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description: string;
  status?: "active" | "archived";
  created_by: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: "active" | "archived";
  metadata?: Record<string, unknown>;
}

const db = getDb();

export class ProjectService {
  async create(data: ProjectCreate): Promise<Project> {
    const now = new Date().toISOString();
    const projectId = uuidv4();
    const metadata: Record<string, unknown> = data.metadata || {};

    const sql = `
      INSERT INTO projects (project_id, name, description, status, created_by, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.prepare(sql).run(
      projectId,
      data.name,
      data.description || null,
      data.status || "active",
      data.created_by,
      JSON.stringify(metadata),
      now,
      now,
    );

    const project = await this.get(projectId);
    if (!project) throw new Error("Failed to create project");
    return project;
  }

  async get(projectId: string): Promise<Project | null> {
    const rows = db.prepare("SELECT * FROM projects WHERE project_id = ?").all(projectId);
    if (rows.length === 0) return null;
    return this.rowToProject(rows[0] as any);
  }

  async getAll(status?: "active" | "archived"): Promise<Project[]> {
    let sql = "SELECT * FROM projects";
    const params: string[] = [];
    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...params);
    return rows.map((r: any) => this.rowToProject(r));
  }

  async update(projectId: string, data: ProjectUpdate): Promise<Project | null> {
    const existing = await this.get(projectId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      params.push(data.description || null);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);
    }
    if (data.metadata !== undefined) {
      const current = existing.metadata;
      const mergedMetadata = { ...current, ...data.metadata };
      updates.push("metadata = ?");
      params.push(JSON.stringify(mergedMetadata) as string);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(now);
    params.push(projectId);

    const sql = `UPDATE projects SET ${updates.join(", ")} WHERE project_id = ?`;
    db.prepare(sql).run(...params);
    return this.get(projectId);
  }

  async delete(projectId: string): Promise<boolean> {
    const existing = await this.get(projectId);
    if (!existing) return false;
    const now = new Date().toISOString();
    db.prepare("UPDATE projects SET status = 'archived', updated_at = ? WHERE project_id = ?").run(now, projectId);
    return true;
  }

  private rowToProject(row: any): Project {
    return {
      project_id: row.project_id,
      name: row.name,
      description: row.description ?? "",
      status: row.status as "active" | "archived",
      created_by: row.created_by,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const projectService = new ProjectService();
