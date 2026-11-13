import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";
import { record } from "./audit.service.ts";

// In-memory user store (demo seed). In production, this would be a DB-backed service.
const DEMO_USERS = [
  { email: "owner@projectmgr.dev", passwordHash: bcrypt.hashSync("owner123", 10), role: "owner" as const },
  { email: "editor@projectmgr.dev", passwordHash: bcrypt.hashSync("editor123", 10), role: "editor" as const },
  { email: "viewer@projectmgr.dev", passwordHash: bcrypt.hashSync("viewer123", 10), role: "viewer" as const },
];

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // Check demo users first
  let user = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  
  // If not found in demo users, check database
  if (!user) {
    const { getDb } = await import("../database/index.ts");
    const db = getDb();
    const dbUser = db.prepare("SELECT user_id, username, email, password_hash, role FROM users WHERE email = ?").get(email.toLowerCase()) as { user_id: string; username: string; email: string; password_hash: string; role: string } | undefined;
    if (dbUser) {
      const valid = await bcrypt.compare(password, dbUser.password_hash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign(
        { user_id: dbUser.user_id, email: dbUser.email, role: dbUser.role },
        process.env.JWT_SECRET || "project-manager-jwt-secret",
        { expiresIn: "7d" }
      );
      record({
        actor: { actor_type: "user", actor_id: dbUser.user_id },
        project_id: null,
        action: "auth.login",
        target_table: "users",
        target_id: dbUser.user_id,
        trigger: "api",
      });
      return res.json({
        user: {
          user_id: dbUser.user_id,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          status: "active",
          created_at: new Date().toISOString(),
        },
        token,
      });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { user_id: uuidv4(), email: user.email, role: user.role },
    process.env.JWT_SECRET || "project-manager-jwt-secret",
    { expiresIn: "7d" }
  );

  record({
    actor: { actor_type: "user", actor_id: user.email },
    project_id: null,
    action: "auth.login",
    target_table: "users",
    target_id: user.email,
    trigger: "api",
  });

  res.json({
    user: {
      user_id: uuidv4(),
      username: user.email.split("@")[0],
      email: user.email,
      role: user.role,
      status: "active",
      created_at: new Date().toISOString(),
    },
    token,
  });
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
  try {
    const token = authHeader.split(" ")[1] as string;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "project-manager-jwt-secret");
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


export async function registerUser(username: string, email: string, password: string) {
  const { getDb } = await import("../database/index.ts");
  const db = getDb();
  
  // Check if user already exists
  const userResult = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email.toLowerCase());
  if (userResult) {
    throw new Error("User already exists");
  }
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  // Generate user_id
  const userId = (await import("uuid")).v4();
  
  // Insert the user
  db.prepare(
    "INSERT INTO users (user_id, username, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, username, email.toLowerCase(), passwordHash, "viewer", "active", new Date().toISOString());
  
  // Get the created user
  const user = db.prepare("SELECT user_id, username, email, role FROM users WHERE user_id = ?").get(userId) as { user_id: string; email: string; role: string };
  
  // Generate JWT token
  const token = jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "project-manager-jwt-secret",
    { expiresIn: "7d" }
  );
  
  return { user, token };
}

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};
