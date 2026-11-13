import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface Comment {
  comment_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface CommentCreate {
  task_id: string;
  body: string;
  author_id: string;
}

export interface CommentUpdate {
  body?: string;
}

const db = getDb();

export class CommentService {
  async create(data: CommentCreate): Promise<Comment> {
    const now = new Date().toISOString();
    const commentId = uuidv4();

    const sql = `
      INSERT INTO comments (comment_id, task_id, author_id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.prepare(sql).run(
      commentId,
      data.task_id,
      data.author_id,
      data.body,
      now,
      now,
    );

    const created = await this.get(commentId);
    if (!created) throw new Error("Failed to create comment");
    return created;
  }

  async get(commentId: string): Promise<Comment | null> {
    const rows = db.prepare("SELECT * FROM comments WHERE comment_id = ?").all(commentId);
    if (rows.length === 0) return null;
    return this.rowToComment(rows[0]);
  }

  async getByTask(taskId: string): Promise<Comment[]> {
    const sql = "SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC";
    const rows = db.prepare(sql).all(taskId);
    return rows.map((r) => this.rowToComment(r));
  }

  async update(commentId: string, data: CommentUpdate): Promise<Comment | null> {
    const existing = await this.get(commentId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.body !== undefined) {
      updates.push("body = ?");
      params.push(data.body);
    }

    if (updates.length === 0) return existing;

    updates.push("updated_at = ?");
    params.push(now);
    params.push(commentId);

    const sql = `UPDATE comments SET ${updates.join(", ")} WHERE comment_id = ?`;
    db.prepare(sql).run(...params);

    return this.get(commentId);
  }

  async delete(commentId: string): Promise<boolean> {
    const existing = await this.get(commentId);
    if (!existing) return false;
    db.prepare("DELETE FROM comments WHERE comment_id = ?").run(commentId);
    return true;
  }

  private rowToComment(row: any): Comment {
    return {
      comment_id: row.comment_id,
      task_id: row.task_id,
      author_id: row.author_id,
      body: row.body ?? "",
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const commentService = new CommentService();
