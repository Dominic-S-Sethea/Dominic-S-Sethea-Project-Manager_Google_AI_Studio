import { Database } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "schema.sql");
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db");

const dbDir = path.dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

const sql = readFileSync(schemaPath, "utf-8");
db.exec(sql);

console.log("Database initialized: " + dbPath);
console.log("WAL mode: ON");
db.close();
