import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface Checklist {
  checklist_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  items?: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  item_id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  order_num: number;
  created_at: string;
}

export interface ChecklistCreate {
  task_id: string;
  title: string;
  items?: { content: string; is_completed?: boolean; order_num?: number }[];
}

export interface ChecklistUpdate {
  title?: string;
  items?: { item_id?: string; content: string; is_completed?: boolean; order_num?: number }[];
}

const db = getDb();

export class ChecklistService {
  async create(data: ChecklistCreate): Promise<Checklist> {
    const now = new Date().toISOString();
    const checklistId = uuidv4();

    const sql = `
      INSERT INTO checklists (checklist_id, task_id, title, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `;
    db.prepare(sql).run(checklistId, data.task_id, data.title, now, now);

    // Insert items if provided
    if (data.items && data.items.length > 0) {
      await this.addItems(checklistId, data.items);
    }

    const created = await this.get(checklistId);
    if (!created) throw new Error("Failed to create checklist");
    return created;
  }

  async get(checklistId: string): Promise<Checklist | null> {
    const rows = db.prepare("SELECT * FROM checklists WHERE checklist_id = ?").all(checklistId);
    if (rows.length === 0) return null;
    const checklist = this.rowToChecklist(rows[0]);
    checklist.items = await this.getItems(checklistId);
    return checklist;
  }

  async getByTask(taskId: string): Promise<Checklist[]> {
    const sql = "SELECT * FROM checklists WHERE task_id = ? ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(taskId);
    return rows.map(r => this.rowToChecklist(r));
  }

  async getAll(): Promise<Checklist[]> {
    const sql = "SELECT * FROM checklists ORDER BY created_at DESC";
    const rows = db.prepare(sql).all();
    return rows.map(r => this.rowToChecklist(r));
  }

  async update(checklistId: string, data: ChecklistUpdate): Promise<Checklist | null> {
    const existing = await this.get(checklistId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      params.push(data.title);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(now);
      params.push(checklistId);
      db.prepare(`UPDATE checklists SET ${updates.join(", ")} WHERE checklist_id = ?`).run(...params);
    }

    // Replace items if provided
    if (data.items !== undefined) {
      await this.replaceItems(checklistId, data.items);
    }

    return this.get(checklistId);
  }

  async delete(checklistId: string): Promise<boolean> {
    const existing = await this.get(checklistId);
    if (!existing) return false;
    // Delete child items first to respect FK constraint, then the parent row.
    // node:sqlite DatabaseSync runs in autocommit mode; ordering items-before-parent
    // avoids the FK violation without needing explicit transaction control.
    db.prepare("DELETE FROM checklist_items WHERE checklist_id = ?").run(checklistId);
    db.prepare("DELETE FROM checklists WHERE checklist_id = ?").run(checklistId);
    return true;
  }

  // ---- Checklist items ----
  async addItems(checklistId: string, items: { content: string; is_completed?: boolean; order_num?: number }[]): Promise<void> {
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO checklist_items (item_id, checklist_id, content, is_completed, order_num, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      insert.run(
        uuidv4(),
        checklistId,
        item.content,
        item.is_completed ? 1 : 0,
        item.order_num ?? i,
        now,
        now
      );
    }
  }

  async replaceItems(checklistId: string, items: { item_id?: string; content: string; is_completed?: boolean; order_num?: number }[]): Promise<void> {
    db.prepare("DELETE FROM checklist_items WHERE checklist_id = ?").run(checklistId);

    const insert = db.prepare(`
      INSERT INTO checklist_items (item_id, checklist_id, content, is_completed, order_num, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      insert.run(
        item.item_id || uuidv4(),
        checklistId,
        item.content,
        item.is_completed ? 1 : 0,
        item.order_num ?? i,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }
  }

  async getItems(checklistId: string): Promise<ChecklistItem[]> {
    const sql = "SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY order_num ASC";
    const rows = db.prepare(sql).all(checklistId);
    return rows.map(r => this.rowToItem(r));
  }

  private rowToChecklist(row: any): Checklist {
    return {
      checklist_id: row.checklist_id,
      task_id: row.task_id,
      title: row.title,
      is_completed: row.is_completed === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private rowToItem(row: any): ChecklistItem {
    return {
      item_id: row.item_id,
      checklist_id: row.checklist_id,
      content: row.content,
      is_completed: row.is_completed === 1,
      order_num: row.order_num,
      created_at: row.created_at,
    };
  }
}

export const checklistService = new ChecklistService();
