import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcMigrations = path.join(__dirname, '..', 'src', 'database', 'migrations');
const dstMigrations = path.join(__dirname, '..', 'dist', 'database', 'migrations');
const srcSchema = path.join(__dirname, '..', 'src', 'database', 'schema.sql');
const dstSchema = path.join(__dirname, '..', 'dist', 'database', 'schema.sql');

fs.mkdirSync(dstMigrations, { recursive: true });
fs.cpSync(srcMigrations, dstMigrations, { recursive: true });
fs.copyFileSync(srcSchema, dstSchema);
console.log('Copied migrations and schema.sql to dist/database');
