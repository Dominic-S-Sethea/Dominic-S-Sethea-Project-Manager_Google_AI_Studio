import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getDb } from "../database/index.ts";

export const VALID_ROLES: ReadonlyArray<string> = ["owner", "editor", "viewer", "commenter"];

function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role);
}

const db = getDb();

export interface User {
  user_id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  role?: string;
  status?: string;
  [key: string]: string | undefined;
}

export class UserService {
  async create(data: UserCreate): Promise<User> {
    const now = new Date().toISOString();
    const userId = uuidv4();
    const role = data.role && isValidRole(data.role) ? data.role : "viewer";
    const email = data.email.toLowerCase();

    // Check if user already exists
    const existing = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    // Hash before storage; plaintext passwords must never reach password_hash.
    const passwordHash = await bcrypt.hash(data.password, 10);

    const sql = `
      INSERT INTO users (user_id, username, email, password_hash, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `;
    db.prepare(sql).run(userId, data.username, email, passwordHash, role, now);
    const user = await this.get(userId);
    if (!user) throw new Error("User not found");
    return user;
  }

  async get(userId: string): Promise<User | null> {
    const rows = db.prepare("SELECT * FROM users WHERE user_id = ?").all(userId);
    if (rows.length === 0) return null;
    return this.rowToUser(rows[0] as any);
  }

  async getByEmail(email: string): Promise<User | null> {
    const rows = db.prepare("SELECT * FROM users WHERE email = ?").all(email.toLowerCase());
    if (rows.length === 0) return null;
    return this.rowToUser(rows[0] as any);
  }

  async getAll(): Promise<User[]> {
    const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    return rows.map((r: any) => this.rowToUser(r));
  }

  async update(userId: string, data: UserUpdate): Promise<User | null> {
    const allowed = ["username", "email", "role", "status"];
    const updates: string[] = [];
    const params: (string | null)[] = [];

    for (const field of allowed) {
      if (data[field] !== undefined) {
        // Validate role value if provided
        if (field === "role" && data.role !== undefined && !isValidRole(data.role)) {
          throw new Error(`Invalid role: must be one of ${VALID_ROLES.join(", ")}`);
        }
        updates.push(`${field} = ?`);
        params.push(data[field] as string);
      }
    }

    if (updates.length === 0) return this.get(userId);

    params.push(userId);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`;
    db.prepare(sql).run(...params);

    return this.get(userId);
  }

  async recordLogin(userId: string, ip: string, fingerprint: string): Promise<void> {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users SET last_login_at = ?, ip_address = ?, device_fingerprint = ? WHERE user_id = ?`
    ).run(now, ip, fingerprint, userId);

    db.prepare(
      `INSERT INTO login_history (login_id, user_id, ip_address, device_fingerprint, logged_in_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(uuidv4(), userId, ip, fingerprint, now);
  }

  async getLoginHistory(userId: string, limit = 10): Promise<any[]> {
    const rows = db.prepare(
      `SELECT lh.*, u.username, u.email FROM login_history lh
       JOIN users u ON lh.user_id = u.user_id
       WHERE lh.user_id = ?
       ORDER BY lh.logged_in_at DESC
       LIMIT ?`
    ).all(userId, limit) as any[];
    return rows.map((r: any) => ({
      login_id: r.login_id,
      username: r.username,
      email: r.email,
      ip_address: r.ip_address,
      device_fingerprint: r.device_fingerprint,
      logged_in_at: r.logged_in_at,
    }));
  }

  private rowToUser(row: any): User {
    return {
      user_id: row.user_id,
      username: row.username,
      email: row.email,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      last_login_at: row.last_login_at || null,
      ip_address: row.ip_address || null,
      device_fingerprint: row.device_fingerprint || null,
    };
  }
}

export const userService = new UserService();
