/**
 * Canvas contract, regression and integration coverage (PM-P6-06).
 *
 * Covers every approved Canvas endpoint class from PHASE3_03_CANVAS_API_CONTRACT.md
 * (§3.5.1–§3.5.10) plus the connection-update endpoint added in PM-P6-04:
 *
 *   POST   /api/canvas                        POST   /api/canvas/:id/items
 *   GET    /api/canvas                        PUT    /api/canvas/items/:itemId
 *   GET    /api/canvas/:id                    DELETE /api/canvas/items/:itemId
 *   PUT    /api/canvas/:id                    POST   /api/canvas/:id/connections
 *   DELETE /api/canvas/:id                    PUT    /api/canvas/connections/:connId
 *                                             DELETE /api/canvas/connections/:connId
 *
 * For each class this file asserts at least one success case, one failure case,
 * authorization behaviour for owner / editor / viewer / commenter / agent /
 * non-member, direct SQLite persistence state after mutations, and structured
 * `{ error: string }` bodies on failure.
 *
 * Application source files are NOT modified by this suite.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import request from "supertest";

// The API rate limiter permits 100 requests per 15 minutes per client IP
// (RATE_LIMIT_MAX in backend/.env). This suite deliberately exceeds that
// budget because it exercises every Canvas endpoint class with success,
// authorization, persistence and failure cases. Raise the ceiling for this
// test process only: no application source file, dependency, or configuration
// file is changed, and the production limit is untouched.
process.env.RATE_LIMIT_MAX = "100000";

// Run against an isolated throwaway database. `node --test` executes every
// test file in its own process concurrently, and the pre-existing
// backend.test.ts writes to backend/data/app.db; concurrent writers on that
// shared file produce SQLITE_BUSY ("database is locked"). Pointing DB_PATH at
// a fresh temp file keeps this suite isolated from both the development
// database and the other test processes.
const testDbPath = path.join(
  os.tmpdir(),
  `pm-canvas-contract-${randomUUID()}.db`,
);
process.env.DB_PATH = testDbPath;

const { app, closeDb } = await import("../index.ts");
const { getDb } = await import("../database/index.ts");

// --- Types -----------------------------------------------------------------

interface TestUser {
  token: string;
  userId: string;
  email: string;
}

interface CanvasRow {
  canvas_id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CanvasItemRow {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

interface CanvasConnectionRow {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

type ProjectRole = "owner" | "editor" | "viewer" | "commenter" | "agent";

// --- API helpers -----------------------------------------------------------

async function registerUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${randomUUID()}@test.local`;

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username: `${prefix}-${randomUUID()}`,
      email,
      password: "password123",
    });

  assert.equal(response.status, 201, `registration failed for ${email}`);
  assert.equal(typeof response.body.token, "string");
  assert.ok(response.body.token);

  // Promote to owner after registration so tests can exercise owner routes
  // without changing the production default (viewer).
  const userRow = getDb()
    .prepare("SELECT user_id FROM users WHERE email = ?")
    .get(email) as { user_id: string } | undefined;
  if (userRow) {
    getDb()
      .prepare("UPDATE users SET role = ? WHERE user_id = ?")
      .run("owner", userRow.user_id);
  }

  // Re-login to get a fresh JWT with the owner role (requireRole reads the
  // token, not the DB).
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  assert.equal(login.status, 200);
  const ownerToken = (login.body as { token: string }).token;

  return {
    token: ownerToken,
    userId: response.body.user.user_id as string,
    email,
  };
}

async function createProject(token: string, name?: string): Promise<string> {
  const response = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: name ?? `Project ${randomUUID()}`,
      description: "Canvas contract test project",
      status: "active",
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.project?.project_id);

  return response.body.project.project_id as string;
}

async function createCanvas(
  token: string,
  projectId: string,
  name?: string,
): Promise<string> {
  const response = await request(app)
    .post("/api/canvas")
    .set("Authorization", `Bearer ${token}`)
    .send({
      project_id: projectId,
      name: name ?? `Canvas ${randomUUID()}`,
      description: "Canvas contract test canvas",
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.canvas?.canvas_id);

  return response.body.canvas.canvas_id as string;
}

async function addItem(
  token: string,
  canvasId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await request(app)
    .post(`/api/canvas/${canvasId}/items`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      item_type: "square",
      content: `Item ${randomUUID()}`,
      x: 10,
      y: 20,
      width: 120,
      height: 80,
      ...overrides,
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.item?.item_id);

  return response.body.item.item_id as string;
}

async function addConnection(
  token: string,
  canvasId: string,
  fromItemId: string,
  toItemId: string,
  connectionType = "line",
): Promise<string> {
  const response = await request(app)
    .post(`/api/canvas/${canvasId}/connections`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      from_item_id: fromItemId,
      to_item_id: toItemId,
      connection_type: connectionType,
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.connection?.connection_id);

  return response.body.connection.connection_id as string;
}

// --- Database helpers ------------------------------------------------------

function findCanvasRow(canvasId: string): CanvasRow | undefined {
  return getDb()
    .prepare("SELECT * FROM canvases WHERE canvas_id = ?")
    .get(canvasId) as CanvasRow | undefined;
}

function requireCanvasRow(canvasId: string): CanvasRow {
  const row = findCanvasRow(canvasId);
  assert.ok(row, `expected a canvases row for ${canvasId}`);
  return row;
}

function findItemRow(itemId: string): CanvasItemRow | undefined {
  return getDb()
    .prepare("SELECT * FROM canvas_items WHERE item_id = ?")
    .get(itemId) as CanvasItemRow | undefined;
}

function requireItemRow(itemId: string): CanvasItemRow {
  const row = findItemRow(itemId);
  assert.ok(row, `expected a canvas_items row for ${itemId}`);
  return row;
}

function findConnectionRow(
  connectionId: string,
): CanvasConnectionRow | undefined {
  return getDb()
    .prepare("SELECT * FROM canvas_connections WHERE connection_id = ?")
    .get(connectionId) as CanvasConnectionRow | undefined;
}

function requireConnectionRow(connectionId: string): CanvasConnectionRow {
  const row = findConnectionRow(connectionId);
  assert.ok(row, `expected a canvas_connections row for ${connectionId}`);
  return row;
}

function countCanvasConnections(canvasId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS total FROM canvas_connections WHERE canvas_id = ?",
    )
    .get(canvasId) as { total: number };

  return row.total;
}

function countConnectionsForItem(itemId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total
       FROM canvas_connections
       WHERE from_item_id = ? OR to_item_id = ?`,
    )
    .get(itemId, itemId) as { total: number };

  return row.total;
}

function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole,
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO project_members (project_id, user_id, role)
       VALUES (?, ?, ?)`,
    )
    .run(projectId, userId, role);
}

// --- Assertion helpers -----------------------------------------------------

/**
 * Mutation failures must return a structured `{ error: string }` body and must
 * never leak raw SQL, driver names, or syntax details.
 */
function assertErrorBody(body: unknown): void {
  assert.equal(typeof body, "object", "error body should be an object");
  assert.notEqual(body, null, "error body should not be null");

  const record = body as Record<string, unknown>;

  assert.equal(typeof record.error, "string", "error should be a string");
  assert.ok((record.error as string).length > 0, "error should not be empty");
  assert.equal(
    /sql|sqlite|syntax|constraint|foreign key/i.test(record.error as string),
    false,
    `error body leaks internals: ${record.error}`,
  );
}

// --- Shared fixtures -------------------------------------------------------

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let commenter: TestUser;
let agent: TestUser;
let nonMember: TestUser;

let sharedProjectId: string;
let sharedCanvasId: string;

before(async () => {
  getDb();

  owner = await registerUser("canvas_owner");
  editor = await registerUser("canvas_editor");
  viewer = await registerUser("canvas_viewer");
  commenter = await registerUser("canvas_commenter");
  agent = await registerUser("canvas_agent");
  nonMember = await registerUser("canvas_nonmember");

  sharedProjectId = await createProject(
    owner.token,
    `Shared Project ${randomUUID()}`,
  );
  sharedCanvasId = await createCanvas(
    owner.token,
    sharedProjectId,
    `Shared Canvas ${randomUUID()}`,
  );

  addProjectMember(sharedProjectId, editor.userId, "editor");
  addProjectMember(sharedProjectId, viewer.userId, "viewer");
  addProjectMember(sharedProjectId, commenter.userId, "commenter");
  addProjectMember(sharedProjectId, agent.userId, "agent");
});

after(() => {
  try {
    closeDb();
  } catch {
    // The connection may already be closed.
  }

  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      rmSync(`${testDbPath}${suffix}`, { force: true });
    } catch {
      // Best-effort cleanup of the throwaway database.
    }
  }
});

// --- Contract coverage -----------------------------------------------------

describe("Canvas Contract", () => {
  describe("POST /api/canvas", () => {
    test("creates a canvas and persists it", async () => {
      const projectId = await createProject(owner.token);
      const name = `Contract Canvas ${randomUUID()}`;

      const response = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          project_id: projectId,
          name,
          description: "contract test canvas",
        });

      assert.equal(response.status, 201);
      assert.equal(typeof response.body.canvas.canvas_id, "string");
      assert.equal(response.body.canvas.project_id, projectId);
      assert.equal(response.body.canvas.name, name);

      const row = requireCanvasRow(response.body.canvas.canvas_id);
      assert.equal(row.project_id, projectId);
      assert.equal(row.name, name);
      assert.equal(row.description, "contract test canvas");
      assert.equal(row.created_by, owner.userId);
      assert.equal(typeof row.updated_at, "string");
    });

    test("rejects a missing or empty project_id and name with 400", async () => {
      const missingProject = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "No project" });

      assert.equal(missingProject.status, 400);
      assertErrorBody(missingProject.body);

      const emptyProject = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ project_id: "   ", name: "Blank project" });

      assert.equal(emptyProject.status, 400);
      assertErrorBody(emptyProject.body);

      const missingName = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ project_id: sharedProjectId });

      assert.equal(missingName.status, 400);
      assertErrorBody(missingName.body);

      const emptyName = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ project_id: sharedProjectId, name: "" });

      assert.equal(emptyName.status, 400);
      assertErrorBody(emptyName.body);
    });

    test("returns 404 for a nonexistent project", async () => {
      const response = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ project_id: randomUUID(), name: "Orphan Canvas" });

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 for read-only roles (viewer, commenter, agent)", async () => {
      const readOnlyRoles: Array<{ label: string; user: TestUser }> = [
        { label: "viewer", user: viewer },
        { label: "commenter", user: commenter },
        { label: "agent", user: agent },
      ];

      for (const { label, user } of readOnlyRoles) {
        const response = await request(app)
          .post("/api/canvas")
          .set("Authorization", `Bearer ${user.token}`)
          .send({
            project_id: sharedProjectId,
            name: `Attempt ${label} ${randomUUID()}`,
          });

        assert.equal(
          response.status,
          403,
          `${label} must not create a canvas`,
        );
        assertErrorBody(response.body);
      }
    });

    test("editor can create a canvas", async () => {
      const response = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${editor.token}`)
        .send({
          project_id: sharedProjectId,
          name: `Editor Canvas ${randomUUID()}`,
        });

      assert.equal(response.status, 201);
      assert.equal(response.body.canvas.created_by, editor.userId);
    });
  });

  describe("GET /api/canvas", () => {
    test("filters by project_id and scopes the unscoped list to readable projects", async () => {
      // A second project that only the owner can read.
      const otherProjectId = await createProject(
        owner.token,
        `Other Project ${randomUUID()}`,
      );
      const otherCanvasId = await createCanvas(
        owner.token,
        otherProjectId,
        `Other Canvas ${randomUUID()}`,
      );

      const filtered = await request(app)
        .get(`/api/canvas?project_id=${sharedProjectId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(filtered.status, 200);
      const filteredCanvases = filtered.body.canvases as Array<{
        canvas_id: string;
        project_id: string;
      }>;
      assert.ok(Array.isArray(filteredCanvases));
      assert.ok(filteredCanvases.length >= 1);
      assert.ok(
        filteredCanvases.every(
          (canvas) => canvas.project_id === sharedProjectId,
        ),
      );
      assert.ok(
        filteredCanvases.some(
          (canvas) => canvas.canvas_id === sharedCanvasId,
        ),
      );
      assert.equal(
        filteredCanvases.some(
          (canvas) => canvas.canvas_id === otherCanvasId,
        ),
        false,
      );

      const ownerAll = await request(app)
        .get("/api/canvas")
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(ownerAll.status, 200);
      const ownerCanvases = ownerAll.body.canvases as Array<{
        canvas_id: string;
      }>;
      assert.ok(
        ownerCanvases.some(
          (canvas) => canvas.canvas_id === sharedCanvasId,
        ),
      );
      assert.ok(
        ownerCanvases.some((canvas) => canvas.canvas_id === otherCanvasId),
      );

      const viewerAll = await request(app)
        .get("/api/canvas")
        .set("Authorization", `Bearer ${viewer.token}`);

      assert.equal(viewerAll.status, 200);
      const viewerCanvases = viewerAll.body.canvases as Array<{
        canvas_id: string;
        project_id: string;
      }>;
      assert.ok(
        viewerCanvases.some(
          (canvas) => canvas.canvas_id === sharedCanvasId,
        ),
      );
      assert.equal(
        viewerCanvases.some(
          (canvas) => canvas.canvas_id === otherCanvasId,
        ),
        false,
        "viewer must not see canvases from projects they cannot read",
      );
      assert.ok(
        viewerCanvases.every(
          (canvas) =>
            typeof canvas.project_id === "string" &&
            canvas.project_id.length > 0,
        ),
        "legacy NULL-project canvases must never be exposed",
      );
    });

    test("returns 404 for a nonexistent project", async () => {
      const response = await request(app)
        .get(`/api/canvas?project_id=${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 404 when the caller cannot read the project", async () => {
      const response = await request(app)
        .get(`/api/canvas?project_id=${sharedProjectId}`)
        .set("Authorization", `Bearer ${nonMember.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });
  });

  describe("GET /api/canvas/:id", () => {
    test("returns the canvas with its items and connections", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const firstItemId = await addItem(owner.token, canvasId, {
        item_type: "square",
      });
      const secondItemId = await addItem(owner.token, canvasId, {
        item_type: "circle",
      });
      await addConnection(
        owner.token,
        canvasId,
        firstItemId,
        secondItemId,
        "arrow",
      );

      const response = await request(app)
        .get(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.canvas.canvas_id, canvasId);
      assert.equal(response.body.canvas.items.length, 2);
      assert.equal(response.body.canvas.connections.length, 1);
      assert.equal(
        response.body.canvas.connections[0].from_item_id,
        firstItemId,
      );
      assert.equal(
        response.body.canvas.connections[0].to_item_id,
        secondItemId,
      );
      assert.equal(
        response.body.canvas.connections[0].connection_type,
        "arrow",
      );
    });

    test("returns 404 when the canvas does not exist", async () => {
      const missingId = randomUUID();

      const response = await request(app)
        .get(`/api/canvas/${missingId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
      assert.equal(
        (response.body.error as string).includes(missingId),
        false,
        "404 body must not disclose the requested id",
      );
    });

    test("returns 404 when the caller cannot read the project", async () => {
      const response = await request(app)
        .get(`/api/canvas/${sharedCanvasId}`)
        .set("Authorization", `Bearer ${nonMember.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
      assert.equal(
        (response.body.error as string).includes(sharedCanvasId),
        false,
        "404 body must not disclose the requested id",
      );
    });
  });

  describe("PUT /api/canvas/:id", () => {
    test("updates name and description and persists the change", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const before = requireCanvasRow(canvasId);

      const response = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          name: `Renamed Canvas ${randomUUID()}`,
          description: "Updated description",
        });

      assert.equal(response.status, 200);
      const after = requireCanvasRow(canvasId);
      assert.equal(after.name, response.body.canvas.name);
      assert.equal(after.description, "Updated description");
      assert.ok(
        after.updated_at >= before.updated_at,
        "updated_at must advance on mutation",
      );
    });

    test("rejects an empty name with 400", async () => {
      const response = await request(app)
        .put(`/api/canvas/${sharedCanvasId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "   " });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects a non-string description with 400", async () => {
      const response = await request(app)
        .put(`/api/canvas/${sharedCanvasId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ description: 42 });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("returns 404 when the canvas does not exist", async () => {
      const response = await request(app)
        .put(`/api/canvas/${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Ghost Canvas" });

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot write", async () => {
      const response = await request(app)
        .put(`/api/canvas/${sharedCanvasId}`)
        .set("Authorization", `Bearer ${viewer.token}`)
        .send({ name: "Viewer Attempt" });

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
    });

    test("editor can update a canvas", async () => {
      const response = await request(app)
        .put(`/api/canvas/${sharedCanvasId}`)
        .set("Authorization", `Bearer ${editor.token}`)
        .send({ description: `Editor update ${randomUUID()}` });

      assert.equal(response.status, 200);
      assert.equal(
        requireCanvasRow(sharedCanvasId).description,
        response.body.canvas.description,
      );
    });
  });

  describe("DELETE /api/canvas/:id", () => {
    test("deletes the canvas and cascades to items and connections", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const firstItemId = await addItem(owner.token, canvasId);
      const secondItemId = await addItem(owner.token, canvasId);
      await addConnection(owner.token, canvasId, firstItemId, secondItemId);

      const response = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);

      assert.equal(findCanvasRow(canvasId), undefined);
      assert.equal(findItemRow(firstItemId), undefined);
      assert.equal(findItemRow(secondItemId), undefined);
      assert.equal(countCanvasConnections(canvasId), 0);
    });

    test("returns 404 when the canvas does not exist", async () => {
      const response = await request(app)
        .delete(`/api/canvas/${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot delete", async () => {
      const response = await request(app)
        .delete(`/api/canvas/${sharedCanvasId}`)
        .set("Authorization", `Bearer ${viewer.token}`);

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
      assert.ok(
        findCanvasRow(sharedCanvasId),
        "a rejected delete must not remove the canvas",
      );
    });
  });

  describe("POST /api/canvas/:id/items", () => {
    test("creates an item with defaults and persists it", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);

      const response = await request(app)
        .post(`/api/canvas/${canvasId}/items`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ item_type: "square", content: "Persisted item" });

      assert.equal(response.status, 201);
      const itemId = response.body.item.item_id as string;

      const row = requireItemRow(itemId);
      assert.equal(row.canvas_id, canvasId);
      assert.equal(row.item_type, "square");
      assert.equal(row.content, "Persisted item");
      assert.equal(row.x, 0);
      assert.equal(row.y, 0);
      assert.equal(row.width, 100);
      assert.equal(row.height, 100);
    });

    test("rejects an unsupported item_type with 400", async () => {
      const response = await request(app)
        .post(`/api/canvas/${sharedCanvasId}/items`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ item_type: "hexagon", content: "Unsupported" });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects a cross-project task_id with 400", async () => {
      const otherProjectId = await createProject(
        owner.token,
        `Task Scope Project ${randomUUID()}`,
      );
      const canvasId = await createCanvas(owner.token, sharedProjectId);

      const taskResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          project_id: otherProjectId,
          title: `Task ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(taskResponse.status, 201);

      const response = await request(app)
        .post(`/api/canvas/${canvasId}/items`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          item_type: "task",
          task_id: taskResponse.body.task.task_id,
        });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects a non-finite coordinate with 400", async () => {
      const response = await request(app)
        .post(`/api/canvas/${sharedCanvasId}/items`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ item_type: "square", x: "not-a-number" });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("returns 404 when the canvas does not exist", async () => {
      const response = await request(app)
        .post(`/api/canvas/${randomUUID()}/items`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ item_type: "square" });

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot write", async () => {
      const response = await request(app)
        .post(`/api/canvas/${sharedCanvasId}/items`)
        .set("Authorization", `Bearer ${viewer.token}`)
        .send({ item_type: "square" });

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
    });
  });

  describe("PUT /api/canvas/items/:itemId", () => {
    test("updates item fields and persists the change", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const itemId = await addItem(owner.token, canvasId, {
        item_type: "square",
        content: "before",
      });

      const response = await request(app)
        .put(`/api/canvas/items/${itemId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ content: "after", x: 42, width: 200 });

      assert.equal(response.status, 200);
      assert.equal(response.body.item.content, "after");

      const row = requireItemRow(itemId);
      assert.equal(row.content, "after");
      assert.equal(row.x, 42);
      assert.equal(row.width, 200);
    });

    test("rejects an invalid field value with 400", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const itemId = await addItem(owner.token, canvasId);

      const response = await request(app)
        .put(`/api/canvas/items/${itemId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ x: "not-a-number" });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("returns 404 when the item does not exist", async () => {
      const response = await request(app)
        .put(`/api/canvas/items/${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ content: "ghost" });

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot write", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const itemId = await addItem(owner.token, canvasId);
      const before = requireItemRow(itemId).content;

      const response = await request(app)
        .put(`/api/canvas/items/${itemId}`)
        .set("Authorization", `Bearer ${viewer.token}`)
        .send({ content: "viewer attempt" });

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
      assert.equal(
        requireItemRow(itemId).content,
        before,
        "a rejected update must not change the item",
      );
    });
  });

  describe("DELETE /api/canvas/items/:itemId", () => {
    test("deletes the item and cascades its connections", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const firstItemId = await addItem(owner.token, canvasId);
      const secondItemId = await addItem(owner.token, canvasId);
      await addConnection(owner.token, canvasId, firstItemId, secondItemId);

      const response = await request(app)
        .delete(`/api/canvas/items/${firstItemId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);

      assert.equal(findItemRow(firstItemId), undefined);
      assert.equal(countConnectionsForItem(firstItemId), 0);
      assert.ok(
        findItemRow(secondItemId),
        "the other item must survive the cascade",
      );
    });

    test("returns 404 when the item does not exist", async () => {
      const response = await request(app)
        .delete(`/api/canvas/items/${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot delete", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const itemId = await addItem(owner.token, canvasId);

      const response = await request(app)
        .delete(`/api/canvas/items/${itemId}`)
        .set("Authorization", `Bearer ${viewer.token}`);

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
      assert.ok(
        findItemRow(itemId),
        "a rejected delete must not remove the item",
      );
    });
  });

  describe("POST /api/canvas/:id/connections", () => {
    test("creates a connection and persists it", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId, {
        item_type: "square",
      });
      const toItemId = await addItem(owner.token, canvasId, {
        item_type: "circle",
      });

      const response = await request(app)
        .post(`/api/canvas/${canvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          from_item_id: fromItemId,
          to_item_id: toItemId,
          connection_type: "arrow",
          style: "dashed",
        });

      assert.equal(response.status, 201);
      const connectionId = response.body.connection.connection_id as string;

      const row = requireConnectionRow(connectionId);
      assert.equal(row.canvas_id, canvasId);
      assert.equal(row.from_item_id, fromItemId);
      assert.equal(row.to_item_id, toItemId);
      assert.equal(row.connection_type, "arrow");
      assert.equal(row.style, "dashed");
    });

    test("rejects a self-connection with 400", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const itemId = await addItem(owner.token, canvasId);

      const response = await request(app)
        .post(`/api/canvas/${canvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ from_item_id: itemId, to_item_id: itemId });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects a cross-canvas endpoint with 400", async () => {
      const firstCanvasId = await createCanvas(owner.token, sharedProjectId);
      const secondCanvasId = await createCanvas(owner.token, sharedProjectId);
      const firstItemId = await addItem(owner.token, firstCanvasId);
      const secondItemId = await addItem(owner.token, secondCanvasId);

      const response = await request(app)
        .post(`/api/canvas/${firstCanvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          from_item_id: firstItemId,
          to_item_id: secondItemId,
        });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects a duplicate connection with 400", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);

      const first = await request(app)
        .post(`/api/canvas/${canvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ from_item_id: fromItemId, to_item_id: toItemId });

      assert.equal(first.status, 201);

      const duplicate = await request(app)
        .post(`/api/canvas/${canvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ from_item_id: fromItemId, to_item_id: toItemId });

      assert.equal(duplicate.status, 400);
      assertErrorBody(duplicate.body);
    });

    test("rejects an invalid connection_type with 400", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);

      const response = await request(app)
        .post(`/api/canvas/${canvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          from_item_id: fromItemId,
          to_item_id: toItemId,
          connection_type: "curved",
        });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects missing endpoint ids with 400", async () => {
      const response = await request(app)
        .post(`/api/canvas/${sharedCanvasId}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ from_item_id: randomUUID() });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("returns 404 when the canvas does not exist", async () => {
      const response = await request(app)
        .post(`/api/canvas/${randomUUID()}/connections`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          from_item_id: randomUUID(),
          to_item_id: randomUUID(),
        });

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot write", async () => {
      const response = await request(app)
        .post(`/api/canvas/${sharedCanvasId}/connections`)
        .set("Authorization", `Bearer ${viewer.token}`)
        .send({
          from_item_id: randomUUID(),
          to_item_id: randomUUID(),
        });

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
    });
  });

  describe("PUT /api/canvas/connections/:connId", () => {
    test("updates the connection type and style and persists the change", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);
      const connectionId = await addConnection(
        owner.token,
        canvasId,
        fromItemId,
        toItemId,
        "line",
      );

      const response = await request(app)
        .put(`/api/canvas/connections/${connectionId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ connection_type: "arrow", style: "dotted" });

      assert.equal(response.status, 200);
      assert.equal(response.body.connection.connection_type, "arrow");

      const row = requireConnectionRow(connectionId);
      assert.equal(row.connection_type, "arrow");
      assert.equal(row.style, "dotted");
    });

    test("rejects an invalid connection_type with 400", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);
      const connectionId = await addConnection(
        owner.token,
        canvasId,
        fromItemId,
        toItemId,
      );

      const response = await request(app)
        .put(`/api/canvas/connections/${connectionId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ connection_type: "curved" });

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("rejects an empty update body with 400", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);
      const connectionId = await addConnection(
        owner.token,
        canvasId,
        fromItemId,
        toItemId,
      );

      const response = await request(app)
        .put(`/api/canvas/connections/${connectionId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({});

      assert.equal(response.status, 400);
      assertErrorBody(response.body);
    });

    test("returns 404 when the connection does not exist", async () => {
      const response = await request(app)
        .put(`/api/canvas/connections/${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ connection_type: "arrow" });

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot write", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);
      const connectionId = await addConnection(
        owner.token,
        canvasId,
        fromItemId,
        toItemId,
      );

      const response = await request(app)
        .put(`/api/canvas/connections/${connectionId}`)
        .set("Authorization", `Bearer ${viewer.token}`)
        .send({ connection_type: "arrow" });

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
      assert.equal(
        requireConnectionRow(connectionId).connection_type,
        "line",
        "a rejected update must not change the connection",
      );
    });
  });

  describe("DELETE /api/canvas/connections/:connId", () => {
    test("deletes the connection and persists the change", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);
      const connectionId = await addConnection(
        owner.token,
        canvasId,
        fromItemId,
        toItemId,
      );

      const response = await request(app)
        .delete(`/api/canvas/connections/${connectionId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(findConnectionRow(connectionId), undefined);
      assert.ok(
        findItemRow(fromItemId),
        "deleting a connection must not delete its items",
      );
      assert.ok(findItemRow(toItemId));
    });

    test("returns 404 when the connection does not exist", async () => {
      const response = await request(app)
        .delete(`/api/canvas/connections/${randomUUID()}`)
        .set("Authorization", `Bearer ${owner.token}`);

      assert.equal(response.status, 404);
      assertErrorBody(response.body);
    });

    test("returns 403 when the caller cannot delete", async () => {
      const canvasId = await createCanvas(owner.token, sharedProjectId);
      const fromItemId = await addItem(owner.token, canvasId);
      const toItemId = await addItem(owner.token, canvasId);
      const connectionId = await addConnection(
        owner.token,
        canvasId,
        fromItemId,
        toItemId,
      );

      const response = await request(app)
        .delete(`/api/canvas/connections/${connectionId}`)
        .set("Authorization", `Bearer ${viewer.token}`);

      assert.equal(response.status, 403);
      assertErrorBody(response.body);
      assert.ok(
        findConnectionRow(connectionId),
        "a rejected delete must not remove the connection",
      );
    });
  });
});

// --- Authentication coverage ----------------------------------------------

describe("Canvas Authentication", () => {
  test("rejects requests without a valid bearer token", async () => {
    const missingToken = await request(app).get("/api/canvas");
    assert.equal(missingToken.status, 401);

    const invalidToken = await request(app)
      .get("/api/canvas")
      .set("Authorization", "Bearer not-a-real-token");
    assert.equal(invalidToken.status, 401);

    const postWithoutToken = await request(app)
      .post("/api/canvas")
      .send({ project_id: sharedProjectId, name: "Anonymous Canvas" });
    assert.equal(postWithoutToken.status, 401);
  });
});

// --- Primary journey -------------------------------------------------------

describe("Canvas Primary Journey", () => {
  test("owner completes create, connect, edit and delete", async () => {
    // 1. Owner creates a project.
    const projectId = await createProject(
      owner.token,
      `Journey Project ${randomUUID()}`,
    );

    // 2. Owner creates a canvas.
    const canvasId = await createCanvas(
      owner.token,
      projectId,
      `Journey Canvas ${randomUUID()}`,
    );
    assert.ok(findCanvasRow(canvasId));

    // 3. Owner adds two items.
    const firstItemId = await addItem(owner.token, canvasId, {
      item_type: "task",
      content: "First item",
      x: 0,
      y: 0,
    });
    const secondItemId = await addItem(owner.token, canvasId, {
      item_type: "text",
      content: "Second item",
      x: 200,
      y: 200,
    });
    assert.ok(findItemRow(firstItemId));
    assert.ok(findItemRow(secondItemId));

    // 4. Owner connects the items.
    const connectionId = await addConnection(
      owner.token,
      canvasId,
      firstItemId,
      secondItemId,
      "line",
    );
    assert.ok(findConnectionRow(connectionId));

    // 5. Owner updates an item.
    const updateItemResponse = await request(app)
      .put(`/api/canvas/items/${firstItemId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ content: "First item (updated)", x: 100 });

    assert.equal(updateItemResponse.status, 200);
    assert.equal(
      requireItemRow(firstItemId).content,
      "First item (updated)",
    );
    assert.equal(requireItemRow(firstItemId).x, 100);

    // 6. Owner changes the connection type.
    const updateConnectionResponse = await request(app)
      .put(`/api/canvas/connections/${connectionId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ connection_type: "arrow" });

    assert.equal(updateConnectionResponse.status, 200);
    assert.equal(
      requireConnectionRow(connectionId).connection_type,
      "arrow",
    );

    // 7. Owner deletes the connection.
    const deleteConnectionResponse = await request(app)
      .delete(`/api/canvas/connections/${connectionId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(deleteConnectionResponse.status, 200);
    assert.equal(findConnectionRow(connectionId), undefined);

    // 8. Owner deletes an item (cascade removes its connections).
    const deleteItemResponse = await request(app)
      .delete(`/api/canvas/items/${firstItemId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(deleteItemResponse.status, 200);
    assert.equal(findItemRow(firstItemId), undefined);

    // 9. Owner deletes the canvas.
    const deleteCanvasResponse = await request(app)
      .delete(`/api/canvas/${canvasId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    assert.equal(deleteCanvasResponse.status, 200);
    assert.equal(findCanvasRow(canvasId), undefined);
    assert.equal(findItemRow(secondItemId), undefined);
  });

  test("viewer can read but not write at each step", async () => {
    const projectId = await createProject(
      owner.token,
      `Viewer Journey Project ${randomUUID()}`,
    );
    addProjectMember(projectId, viewer.userId, "viewer");
    const canvasId = await createCanvas(
      owner.token,
      projectId,
      `Viewer Journey Canvas ${randomUUID()}`,
    );

    const readCanvas = await request(app)
      .get(`/api/canvas/${canvasId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    assert.equal(readCanvas.status, 200);
    assert.equal(readCanvas.body.canvas.canvas_id, canvasId);

    const readList = await request(app)
      .get(`/api/canvas?project_id=${projectId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    assert.equal(readList.status, 200);
    assert.ok(
      (readList.body.canvases as Array<{ canvas_id: string }>).some(
        (canvas) => canvas.canvas_id === canvasId,
      ),
    );

    const updateCanvas = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ name: "Viewer rename" });
    assert.equal(updateCanvas.status, 403);

    const createItem = await request(app)
      .post(`/api/canvas/${canvasId}/items`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ item_type: "square" });
    assert.equal(createItem.status, 403);

    const deleteCanvas = await request(app)
      .delete(`/api/canvas/${canvasId}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    assert.equal(deleteCanvas.status, 403);

    assert.ok(
      findCanvasRow(canvasId),
      "viewer write attempts must not mutate the canvas",
    );
  });

  test("non-member gets 404 at each step", async () => {
    const projectId = await createProject(
      owner.token,
      `NonMember Journey Project ${randomUUID()}`,
    );
    const canvasId = await createCanvas(
      owner.token,
      projectId,
      `NonMember Journey Canvas ${randomUUID()}`,
    );
    const itemId = await addItem(owner.token, canvasId);

    const readCanvas = await request(app)
      .get(`/api/canvas/${canvasId}`)
      .set("Authorization", `Bearer ${nonMember.token}`);
    assert.equal(readCanvas.status, 404);

    const readList = await request(app)
      .get(`/api/canvas?project_id=${projectId}`)
      .set("Authorization", `Bearer ${nonMember.token}`);
    assert.equal(readList.status, 404);

    const updateCanvas = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set("Authorization", `Bearer ${nonMember.token}`)
      .send({ name: "Non-member rename" });
    assert.equal(updateCanvas.status, 404);

    const updateItem = await request(app)
      .put(`/api/canvas/items/${itemId}`)
      .set("Authorization", `Bearer ${nonMember.token}`)
      .send({ content: "Non-member edit" });
    assert.equal(updateItem.status, 404);

    const deleteItem = await request(app)
      .delete(`/api/canvas/items/${itemId}`)
      .set("Authorization", `Bearer ${nonMember.token}`);
    assert.equal(deleteItem.status, 404);

    assert.ok(findCanvasRow(canvasId));
    assert.ok(findItemRow(itemId));
  });
});
