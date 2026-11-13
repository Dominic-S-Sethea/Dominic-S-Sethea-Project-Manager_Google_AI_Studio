import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let db: InstanceType<typeof DatabaseSync> | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");

export function getDb(): InstanceType<typeof DatabaseSync> {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db");
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    // Apply schema on first connection
    db.exec(schemaSql);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
