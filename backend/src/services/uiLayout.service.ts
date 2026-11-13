import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

export interface LayoutElement {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
  style: Record<string, any>;
  action?: string;
}

export interface UILayout {
  layout_id: string;
  user_id: string;
  page: string;
  elements: LayoutElement[];
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export class UILayoutService {
  getLayout(userId: string, page: string): UILayout | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM ui_layouts WHERE user_id = ? AND page = ?").get(userId, page) as any;
    if (!row) return null;
    return {
      layout_id: row.layout_id,
      user_id: row.user_id,
      page: row.page,
      elements: JSON.parse(row.elements || "[]"),
      is_locked: !!row.is_locked,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  saveLayout(userId: string, page: string, elements: LayoutElement[], isLocked: boolean): UILayout {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getLayout(userId, page);

    if (existing) {
      db.prepare(`
        UPDATE ui_layouts SET elements = ?, is_locked = ?, updated_at = ? WHERE layout_id = ?
      `).run(JSON.stringify(elements), isLocked ? 1 : 0, now, existing.layout_id);
      return this.getLayout(userId, page)!;
    }

    const layoutId = randomUUID();
    db.prepare(`
      INSERT INTO ui_layouts (layout_id, user_id, page, elements, is_locked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(layoutId, userId, page, JSON.stringify(elements), isLocked ? 1 : 0, now, now);
    return this.getLayout(userId, page)!;
  }

  deleteLayout(userId: string, page: string): boolean {
    const db = getDb();
    const result = db.prepare("DELETE FROM ui_layouts WHERE user_id = ? AND page = ?").run(userId, page);
    return (result as any).changes > 0;
  }
}

export const uiLayoutService = new UILayoutService();
