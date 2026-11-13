/**
 * Regression tests for QA-013 defects D0 and D2.
 *
 * D0: POST /api/users persisted the password in plaintext, so API-created
 *     users could never log in (bcrypt.compare failed -> 401).
 * D2: PUT /api/projects/:id could not persist metadata at all — 500 when
 *     combined with other fields, silent 200 no-op when metadata-only.
 *
 * Runs against an isolated temporary SQLite database (DB_PATH).
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { closeDb, getDb } from "../database/index.ts";

const OWNER_ID = "mc013-owner";
const JWT_SECRET = "mc013-regression-test-secret-with-sufficient-length";

let app: Express;
let databaseDirectory = "";
let ownerToken = "";

function tokenFor(userId: string, role: string): string {
  return jwt.sign(
    { user_id: userId, email: `${userId}@test.local`, role },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function seedUser(userId: string, role: string): void {
  getDb()
    .prepare(
      `INSERT INTO users (user_id, username, email, password_hash, role, status, created_at)
       VALUES (?, ?, ?, 'test-hash', ?, 'active', ?)`,
    )
    .run(userId, userId, `${userId}@test.local`, role, new Date().toISOString());
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  databaseDirectory = mkdtempSync(path.join(tmpdir(), "mc013-regression-"));
  process.env.DB_PATH = path.join(databaseDirectory, "mc013-regression.db");

  getDb();
  seedUser(OWNER_ID, "owner");

  const serverModule = await import("../index.ts");
  app = serverModule.app;
  ownerToken = tokenFor(OWNER_ID, "owner");
});

after(() => {
  closeDb();
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
  }
});

test("QA013-D0: POST /api/users hashes the password so the user can log in", async () => {
  const email = `mc013-created-${Date.now()}@test.local`;
  const password = "Mc013-Created-Pass-1";

  const created = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ username: "mc013created", email, password, role: "viewer" });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  // The stored hash must not be the plaintext password.
  const row = getDb()
    .prepare("SELECT password_hash FROM users WHERE email = ?")
    .get(email) as { password_hash: string } | undefined;
  assert.ok(row, "created user row must exist");
  assert.notEqual(row.password_hash, password);
  assert.ok(
    row.password_hash.startsWith("$2"),
    `password_hash must be a bcrypt hash, got: ${row.password_hash.slice(0, 12)}`,
  );

  // And the credentials must actually authenticate.
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.token, "login must return a token");
});

test("QA013-D2: PUT /api/projects/:id persists metadata (combined and metadata-only)", async () => {
  const created = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Metadata Project", metadata: { a: 1 } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const projectId = created.body.project.project_id as string;

  // Combined update: name + metadata.
  const combined = await request(app)
    .put(`/api/projects/${projectId}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name: "Metadata Project v2", metadata: { b: 2 } });
  assert.equal(combined.status, 200, JSON.stringify(combined.body));
  assert.equal(combined.body.project.name, "Metadata Project v2");
  assert.deepEqual(combined.body.project.metadata, { a: 1, b: 2 });

  // Metadata-only update must persist too, not silently no-op.
  const metadataOnly = await request(app)
    .put(`/api/projects/${projectId}`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ metadata: { c: 3 } });
  assert.equal(metadataOnly.status, 200, JSON.stringify(metadataOnly.body));
  assert.deepEqual(metadataOnly.body.project.metadata, { a: 1, b: 2, c: 3 });

  // Read back from storage, not just the response.
  const stored = await request(app)
    .get(`/api/projects/${projectId}`)
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(stored.status, 200, JSON.stringify(stored.body));
  assert.deepEqual(stored.body.project.metadata, { a: 1, b: 2, c: 3 });
});
