import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { record } from "../services/audit.service.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEDGER_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version        INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    applied_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    checksum       TEXT NOT NULL,
    duration_ms    INTEGER NOT NULL,
    applied_by     TEXT
);
`;

interface MigrationFile {
  version: number;
  name: string;
  fileName: string;
  filePath: string;
  checksum: string;
  sql: string;
}

interface DownMigrationFile {
  version: number;
  fileName: string;
  filePath: string;
  sql: string;
}

interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
  duration_ms: number;
  applied_by: string | null;
}

export interface RunMigrationsOptions {
  databasePath?: string;
  migrationsDir?: string;
  schemaPath?: string;
  dryRun?: boolean;
  showVersion?: boolean;
  downToVersion?: number;
  appliedBy?: string | null;
  log?: (message: string) => void;
}

export interface RunMigrationsResult {
  currentVersion: number | null;
  latestVersion: number | null;
  pendingVersions: number[];
  rolledBackVersions: number[];
}

function writeLog(options: RunMigrationsOptions, message: string): void {
  (options.log ?? console.log)(message);
}

const FK_SUSPENSION_BY_VERSION = new Map<number, string>([
  [2, "0002 rebuilds executions while preserving circular approvals and execution_steps references"],
  [3, "0003 rebuilds connectors and audit_logs to add PM-P7-03 security columns"],
]);

const TRANSIENT_TABLES_BY_VERSION = new Map<number, ReadonlySet<string>>([
  [2, new Set(["executions_new"])],
  [3, new Set(["connectors_new", "audit_logs_new"])],
]);

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function getCreatedTableNames(sql: string): Set<string> {
  const names = new Set<string>();
  const uncommentedSql = stripSqlComments(sql);
  const pattern = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(uncommentedSql)) !== null) {
    const tableName = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (tableName) names.add(tableName);
  }

  return names;
}

/** Return ALTER TABLE rename pairs; only declared v2 transient sources are promoted. */
function getRenamedTableNames(sql: string): Map<string, string> {
  const renamed = new Map<string, string>();
  const identifier = '(?:"([^"]+)"|`([^`]+)`|\\[([^\\]]+)\\]|([A-Za-z_][A-Za-z0-9_]*))';
  const pattern = new RegExp(`\\bALTER\\s+TABLE\\s+${identifier}\\s+RENAME\\s+TO\\s+${identifier}`, "gi");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(stripSqlComments(sql))) !== null) {
    const source = match[1] ?? match[2] ?? match[3] ?? match[4];
    const target = match[5] ?? match[6] ?? match[7] ?? match[8];
    if (source && target) renamed.set(source, target);
  }

  return renamed;
}

function discoverMigrations(migrationsDir: string): MigrationFile[] {
  const files = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.endsWith(".down.sql"))
    .map((entry) => entry.name)
    .map((fileName): MigrationFile | null => {
      const match = /^(\d{4})_(.+)\.sql$/.exec(fileName);
      if (!match) return null;

      const versionText = match[1];
      const name = match[2];
      if (!versionText || !name) return null;

      const filePath = path.join(migrationsDir, fileName);
      const bytes = readFileSync(filePath);

      return {
        version: Number.parseInt(versionText, 10),
        name,
        fileName,
        filePath,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        sql: bytes.toString("utf8"),
      };
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((left, right) => left.version - right.version);

  if (files.length === 0) {
    throw new Error(`No up migration files found in ${migrationsDir}`);
  }

  const versions = new Set<number>();
  for (const migration of files) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}`);
    }
    versions.add(migration.version);
  }

  return files;
}

function assertMigrationSchemaParity(
  migrations: MigrationFile[],
  schemaPath: string,
): void {
  const schemaSql = readFileSync(schemaPath, "utf8");
  const schemaTables = getCreatedTableNames(schemaSql);
  const migrationTables = new Set<string>();

  for (const migration of migrations) {
    const transient = TRANSIENT_TABLES_BY_VERSION.get(migration.version) ?? new Set<string>();
    const createdTables = getCreatedTableNames(migration.sql);
    for (const tableName of createdTables) {
      if (!transient.has(tableName)) migrationTables.add(tableName);
    }
    // A rebuild's scratch table is temporary, but its RENAME target is the
    // persistent table that must be represented by schema.sql.
    for (const [source, target] of getRenamedTableNames(migration.sql)) {
      if (transient.has(source)) migrationTables.add(target);
    }
  }

  const missingTables = [...migrationTables]
    .filter((tableName) => !schemaTables.has(tableName))
    .sort();

  if (missingTables.length > 0) {
    throw new Error(
      `Migration/schema parity failure: schema.sql is missing tables created by migrations: ${missingTables.join(", ")}`,
    );
  }
}

function getAppliedMigrations(database: InstanceType<typeof DatabaseSync>): AppliedMigrationRow[] {
  return database
    .prepare(
      `SELECT version, name, checksum, applied_at, duration_ms, applied_by
       FROM schema_migrations
       ORDER BY version ASC`,
    )
    .all() as unknown as AppliedMigrationRow[];
}

function assertNoMigrationDrift(
  appliedRows: AppliedMigrationRow[],
  migrations: MigrationFile[],
): void {
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const applied of appliedRows) {
    const migration = byVersion.get(applied.version);

    if (!migration) {
      throw new Error(
        `Migration drift detected: applied version ${applied.version} (${applied.name}) has no matching migration file`,
      );
    }

    if (migration.name !== applied.name) {
      throw new Error(
        `Migration drift detected for version ${applied.version}: ledger name "${applied.name}" does not match file name "${migration.name}"`,
      );
    }

    if (migration.checksum !== applied.checksum) {
      throw new Error(
        `Migration drift detected for version ${applied.version} (${applied.name}): checksum mismatch`,
      );
    }
  }
}

function getForeignKeyViolations(
  database: InstanceType<typeof DatabaseSync>,
): Array<Record<string, unknown>> {
  return database
    .prepare("PRAGMA foreign_key_check")
    .all() as Array<Record<string, unknown>>;
}

function formatForeignKeyViolations(
  violations: Array<Record<string, unknown>>,
): string {
  return JSON.stringify(violations);
}

function currentVersion(rows: AppliedMigrationRow[]): number | null {
  return rows.length > 0 ? rows[rows.length - 1]?.version ?? null : null;
}

function findDownMigration(
  migrationsDir: string,
  migration: MigrationFile,
): DownMigrationFile {
  const fileName = `${String(migration.version).padStart(4, "0")}_${migration.name}.down.sql`;
  const filePath = path.join(migrationsDir, fileName);
  const sql = readFileSync(filePath, "utf8");

  return {
    version: migration.version,
    fileName,
    filePath,
    sql,
  };
}

function rollbackMigrations(
  database: InstanceType<typeof DatabaseSync>,
  options: RunMigrationsOptions,
  migrationsDir: string,
  appliedRows: AppliedMigrationRow[],
  migrations: MigrationFile[],
  latest: number | null,
): RunMigrationsResult {
  const target = options.downToVersion;

  if (target === undefined || !Number.isInteger(target) || target < 0) {
    throw new Error("--down requires a non-negative integer --to <version>");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("--down is a development-only operation and is disabled in production");
  }

  const current = currentVersion(appliedRows);
  if (current !== null && target > current) {
    throw new Error(`Cannot roll back to version ${target}; current version is ${current}`);
  }

  const migrationByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );

  const rollbackPlan = [...appliedRows]
    .filter((row) => row.version > target)
    .sort((left, right) => right.version - left.version)
    .map((row) => {
      const migration = migrationByVersion.get(row.version);
      if (!migration) {
        throw new Error(`Cannot roll back unknown applied migration ${row.version}`);
      }
      return { row, down: findDownMigration(migrationsDir, migration) };
    });

  if (rollbackPlan.length === 0) {
    writeLog(options, JSON.stringify({
      event: "migration_down_noop",
      current_version: current,
      target_version: target,
    }));
    return {
      currentVersion: current,
      latestVersion: latest,
      pendingVersions: [],
      rolledBackVersions: [],
    };
  }

  if (options.dryRun) {
    writeLog(options, JSON.stringify({
      event: "migration_down_dry_run",
      target_version: target,
      versions: rollbackPlan.map((item) => item.row.version),
    }));
    return {
      currentVersion: current,
      latestVersion: latest,
      pendingVersions: [],
      rolledBackVersions: rollbackPlan.map((item) => item.row.version),
    };
  }

  const rolledBackVersions: number[] = [];

  // The workflow/version and execution/approval references are intentionally
  // circular. Disable FK enforcement outside each transaction while the
  // development-only down scripts remove the complete domain; verify the
  // remaining database before committing and then restore enforcement.
  database.exec("PRAGMA foreign_keys = OFF;");
  try {
    for (const item of rollbackPlan) {
      const startedAt = Date.now();
      database.exec("BEGIN IMMEDIATE;");
      try {
        database.exec(item.down.sql);

        const violations = getForeignKeyViolations(database);
        if (violations.length > 0) {
          throw new Error(
            `Foreign-key check failed after rolling back version ${item.row.version}: ${formatForeignKeyViolations(violations)}`,
          );
        }

        database
          .prepare("DELETE FROM schema_migrations WHERE version = ?")
          .run(item.row.version);

        database.exec("COMMIT;");
        rolledBackVersions.push(item.row.version);

        writeLog(options, JSON.stringify({
          event: "migration_rolled_back",
          version: item.row.version,
          name: item.row.name,
          duration_ms: Date.now() - startedAt,
        }));
      } catch (error) {
        try {
          database.exec("ROLLBACK;");
        } catch {
          // Preserve the original migration error.
        }
        throw error;
      }
    }
  } finally {
    database.exec("PRAGMA foreign_keys = ON;");
  }

  return {
    currentVersion: currentVersion(getAppliedMigrations(database)),
    latestVersion: latest,
    pendingVersions: [],
    rolledBackVersions,
  };
}

/**
 * Runs explicit SQL migrations. Importing this module never opens a database
 * and never applies schema.sql; getDb() remains the schema bootstrap owner.
 */
export function runMigrations(
  options: RunMigrationsOptions = {},
): RunMigrationsResult {
  const databasePath =
    options.databasePath ??
    (process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "app.db"));
  const migrationsDir = options.migrationsDir ?? path.join(__dirname, "migrations");
  const schemaPath = options.schemaPath ?? path.join(__dirname, "schema.sql");

  const migrations = discoverMigrations(migrationsDir);
  assertMigrationSchemaParity(migrations, schemaPath);

  const database = new DatabaseSync(databasePath);

  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(LEDGER_SQL);

    const appliedRows = getAppliedMigrations(database);
    assertNoMigrationDrift(appliedRows, migrations);

    const latest = migrations[migrations.length - 1]?.version ?? null;

    if (options.downToVersion !== undefined) {
      return rollbackMigrations(
        database,
        options,
        migrationsDir,
        appliedRows,
        migrations,
        latest,
      );
    }

    const appliedVersions = new Set(appliedRows.map((row) => row.version));
    const pending = migrations.filter(
      (migration) => !appliedVersions.has(migration.version),
    );

    if (options.showVersion) {
      writeLog(options, JSON.stringify({
        event: "migration_version",
        current_version: currentVersion(appliedRows),
        latest_version: latest,
      }));
      return {
        currentVersion: currentVersion(appliedRows),
        latestVersion: latest,
        pendingVersions: pending.map((migration) => migration.version),
        rolledBackVersions: [],
      };
    }

    if (options.dryRun) {
      writeLog(options, JSON.stringify({
        event: "migration_dry_run",
        current_version: currentVersion(appliedRows),
        pending_versions: pending.map((migration) => migration.version),
      }));
      return {
        currentVersion: currentVersion(appliedRows),
        latestVersion: latest,
        pendingVersions: pending.map((migration) => migration.version),
        rolledBackVersions: [],
      };
    }

    if (pending.length === 0) {
      writeLog(options, JSON.stringify({
        event: "migration_noop",
        current_version: currentVersion(appliedRows),
        message: "No pending migrations",
      }));
      return {
        currentVersion: currentVersion(appliedRows),
        latestVersion: latest,
        pendingVersions: [],
        rolledBackVersions: [],
      };
    }

    for (const migration of pending) {
      const startedAt = Date.now();
      const suspendForeignKeys = FK_SUSPENSION_BY_VERSION.has(migration.version);
      let transactionStarted = false;
      try {
        // A1: only migration version 2 is permitted to suspend FK enforcement.
        // SQLite ignores this pragma inside a transaction, so it must precede BEGIN.
        if (suspendForeignKeys) database.exec("PRAGMA foreign_keys = OFF;");
        database.exec("BEGIN IMMEDIATE;");
        transactionStarted = true;
        database.exec(migration.sql);

        const violations = getForeignKeyViolations(database);
        if (violations.length > 0) {
          throw new Error(
            `Foreign-key check failed after migration ${migration.version} (${migration.name}): ${formatForeignKeyViolations(violations)}`,
          );
        }

        const durationMs = Date.now() - startedAt;
        database
          .prepare(
            `INSERT INTO schema_migrations
              (version, name, checksum, duration_ms, applied_by)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            migration.version,
            migration.name,
            migration.checksum,
            durationMs,
            options.appliedBy ?? null,
          );

        database.exec("COMMIT;");
        transactionStarted = false;

        // audit_logs gains its PM-P7-03 columns (actor_type, actor_id,
        // project_id, outcome, ...) in migration 0003. Recording before that
        // would fail on the older column set, so guard on the schema.
        const auditColumns = database
          .prepare("PRAGMA table_info(audit_logs)")
          .all() as unknown as { name: string }[];
        if (auditColumns.some((column) => column.name === "actor_type")) {
          record(
            {
              actor: { actor_type: "system", actor_id: "migration" },
              project_id: null,
              action: "migration.applied",
              target_table: "schema_migrations",
              target_id: String(migration.version),
              new_value: {
                version: migration.version,
                name: migration.name,
                checksum: migration.checksum,
                duration_ms: durationMs,
                applied_by: options.appliedBy ?? null,
              },
              trigger: "migration",
            },
            database,
          );
        }

        writeLog(options, JSON.stringify({
          event: "migration_applied",
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          duration_ms: durationMs,
          applied_by: options.appliedBy ?? null,
        }));
      } catch (error) {
        if (transactionStarted) {
          try {
            database.exec("ROLLBACK;");
          } catch {
            // Preserve the original migration error.
          }
        }
        throw error;
      } finally {
        if (suspendForeignKeys) database.exec("PRAGMA foreign_keys = ON;");
      }
    }

    const finalRows = getAppliedMigrations(database);
    return {
      currentVersion: currentVersion(finalRows),
      latestVersion: latest,
      pendingVersions: [],
      rolledBackVersions: [],
    };
  } finally {
    database.close();
  }
}

function parseCliArguments(args: string[]): RunMigrationsOptions {
  const options: RunMigrationsOptions = {};
  let downRequested = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--version") {
      options.showVersion = true;
    } else if (argument === "--down") {
      downRequested = true;
    } else if (argument === "--to") {
      const value = args[index + 1];
      if (!value) throw new Error("--to requires a version number");
      index += 1;
      const version = Number(value);
      if (!Number.isInteger(version) || version < 0) {
        throw new Error("--to requires a non-negative integer version");
      }
      options.downToVersion = version;
    } else {
      throw new Error(`Unknown migration argument: ${argument}`);
    }
  }

  if (downRequested !== (options.downToVersion !== undefined)) {
    throw new Error("Use --down together with --to <version>");
  }

  if (options.showVersion && (options.dryRun || downRequested)) {
    throw new Error("--version cannot be combined with --dry-run or --down");
  }

  return options;
}

function isExecutedDirectly(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined &&
    path.resolve(entryPoint) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  try {
    runMigrations(parseCliArguments(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Migration runner failed: ${message}`);
    process.exitCode = 1;
  }
}


