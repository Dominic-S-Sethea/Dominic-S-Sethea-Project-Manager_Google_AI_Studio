import { getDb } from "../database/index.ts";
import fs from "node:fs";
import os from "node:os";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  database: "connected" | "disconnected";
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    load: number[];
  };
  timestamp: string;
}

export interface Metrics {
  total_projects: number;
  total_tasks: number;
  total_users: number;
  total_canvases: number;
  tasks_by_status: Record<string, number>;
  tasks_by_priority: Record<string, number>;
  db_size_bytes: number;
}

export function getHealthStatus(): HealthStatus {
  const db = getDb();
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    db.prepare("SELECT 1").get();
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();

  return {
    status: dbStatus === "connected" ? "ok" : "down",
    database: dbStatus,
    uptime: process.uptime(),
    memory: {
      used: memUsage.heapUsed,
      total: totalMem,
      percentage: Math.round((memUsage.heapUsed / totalMem) * 100),
    },
    cpu: {
      load: os.loadavg(),
    },
    timestamp: new Date().toISOString(),
  };
}

export function getMetrics(): Metrics {
  const db = getDb();

  const projectCount = (db.prepare("SELECT COUNT(*) as count FROM projects").get() as any)?.count || 0;
  const taskCount = (db.prepare("SELECT COUNT(*) as count FROM tasks").get() as any)?.count || 0;
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count || 0;
  const canvasCount = (db.prepare("SELECT COUNT(*) as count FROM canvases").get() as any)?.count || 0;

  const statusRows = db.prepare("SELECT status, COUNT(*) as count FROM tasks GROUP BY status").all() as any[];
  const tasksByStatus: Record<string, number> = {};
  for (const row of statusRows) {
    tasksByStatus[row.status] = row.count;
  }

  const priorityRows = db.prepare("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority").all() as any[];
  const tasksByPriority: Record<string, number> = {};
  for (const row of priorityRows) {
    tasksByPriority[row.priority] = row.count;
  }

  // DB file size
  const dbPath = process.env.DB_PATH || "./data/app.db";
  let dbSize = 0;
  try {
    const stats = fs.statSync(dbPath);
    dbSize = stats.size;
  } catch {
    dbSize = 0;
  }

  return {
    total_projects: projectCount,
    total_tasks: taskCount,
    total_users: userCount,
    total_canvases: canvasCount,
    tasks_by_status: tasksByStatus,
    tasks_by_priority: tasksByPriority,
    db_size_bytes: dbSize,
  };
}
