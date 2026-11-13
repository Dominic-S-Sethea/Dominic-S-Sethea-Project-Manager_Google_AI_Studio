import { getDb } from "../database/index.ts";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");

export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
  type: "manual" | "scheduled";
}

export function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function createBackup(type: "manual" | "scheduled" = "manual"): BackupInfo {
  ensureBackupDir();
  const db = getDb();

  // Checkpoint WAL before backup
  try {
    db.prepare("PRAGMA wal_checkpoint(PASSIVE)").run();
  } catch {
    // WAL checkpoint may fail if no WAL mode; continue
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `app-backup-${timestamp}.db`;
  const filepath = path.join(BACKUP_DIR, filename);

  // Copy DB file
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, filepath);
  } else {
    throw new Error(`Database file not found at ${DB_PATH}`);
  }

  // Also copy WAL and SHM if they exist
  for (const ext of ["-wal", "-shm"]) {
    const src = DB_PATH + ext;
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, filepath + ext);
    }
  }

  const stats = fs.statSync(filepath);
  return {
    filename,
    size: stats.size,
    created_at: new Date().toISOString(),
    type,
  };
}

export function listBackups(): BackupInfo[] {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter((f) => f.startsWith("app-backup-") && f.endsWith(".db"))
    .map((f) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        size: stats.size,
        created_at: stats.mtime.toISOString(),
        type: (f.includes("scheduled") ? "scheduled" : "manual") as "manual" | "scheduled",
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function deleteBackup(filename: string): boolean {
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    // Also delete WAL/SHM
    for (const ext of ["-wal", "-shm"]) {
      const f = filepath + ext;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    return true;
  }
  return false;
}

export function pruneOldBackups(keepCount: number = 30): number {
  const backups = listBackups();
  if (backups.length <= keepCount) return 0;
  let pruned = 0;
  for (const b of backups.slice(keepCount)) {
    if (deleteBackup(b.filename)) pruned++;
  }
  return pruned;
}
