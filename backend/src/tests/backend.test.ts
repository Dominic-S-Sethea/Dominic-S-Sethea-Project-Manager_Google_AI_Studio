import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";
import request from "supertest";
import { app } from "../index.ts";
import { getDb } from "../database/index.ts";

// Test data and shared authentication helpers.
const testProject = {
  name: "Acceptance Test Project",
  description: "A test project",
  status: "active" as const,
};

let authToken: string | null = null;

const editorCredentials = {
  username: "canvas_editor",
  email: "canvas-editor@test.com",
  password: "password123",
};

const viewerCredentials = {
  username: "canvas_viewer",
  email: "canvas-viewer@test.com",
  password: "password123",
};

const nonMemberCredentials = {
  username: "canvas_nonmember",
  email: "canvas-nonmember@test.com",
  password: "password123",
};

before(() => {
  // The application import initializes the database; this ensures the
  // connection is available before the test cases execute.
  getDb();
});

async function registerAndLogin(
  username: string,
  email: string,
  password: string,
  role: "owner" | "editor" | "viewer" | "commenter" | "agent" = "viewer",
): Promise<string> {
  const registration = await request(app)
    .post("/api/auth/register")
    .send({ username, email, password });

  // Permit re-use of a test account from a previous test run.
  if (registration.status !== 201 && registration.status !== 409) {
    throw new Error(
      `Registration failed for ${email} with status ${registration.status}`,
    );
  }

  // Promote to the requested role after registration so tests can exercise
  // owner/editor routes without changing the production default (viewer).
  if (role !== "viewer") {
    const row = getDb()
      .prepare("SELECT user_id FROM users WHERE email = ?")
      .get(email) as { user_id: string } | undefined;
    if (row) {
      getDb()
        .prepare("UPDATE users SET role = ? WHERE user_id = ?")
        .run(role, row.user_id);
    }
  }

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, "string");
  assert.ok(login.body.token);

  return login.body.token as string;
}

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

  authToken = await registerAndLogin(
    "acceptance_test",
    "acceptance@test.com",
    "password123",
    "owner",
  );

  return authToken;
}

async function getUserIdByEmail(email: string): Promise<string> {
  const row = getDb()
    .prepare("SELECT user_id FROM users WHERE email = ?")
    .get(email) as { user_id: string } | undefined;

  if (!row) {
    throw new Error(`Test user not found: ${email}`);
  }

  return row.user_id;
}

async function createProject(
  token: string,
  name = `Canvas Test Project ${randomUUID()}`,
): Promise<string> {
  const response = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name,
      description: "Project created by backend tests",
      status: "active",
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.project?.project_id);

  return response.body.project.project_id as string;
}

async function createCanvasViaApi(
  token: string,
  projectId: string,
  name = `Canvas ${randomUUID()}`,
): Promise<string> {
  const response = await request(app)
    .post("/api/canvas")
    .set("Authorization", `Bearer ${token}`)
    .send({
      project_id: projectId,
      name,
      description: "Canvas created by backend tests",
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.canvas?.canvas_id);

  return response.body.canvas.canvas_id as string;
}

function addProjectMember(
  projectId: string,
  userId: string,
  role: "owner" | "editor" | "viewer" | "commenter" | "agent",
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO project_members
        (project_id, user_id, role)
       VALUES (?, ?, ?)`,
    )
    .run(projectId, userId, role);
}

describe("Project Manager MVP Acceptance Tests", () => {
  describe("Auth", () => {
    test("POST /api/auth/register creates a new user", async () => {
      const uniqueId = randomUUID();

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: `test_user_${uniqueId}`,
          email: `test_${uniqueId}@example.com`,
          password: "password123",
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.token);
    });

    test("POST /api/auth/login authenticates users", async () => {
      const uniqueId = randomUUID();
      const email = `login_${uniqueId}@test.com`;

      await request(app)
        .post("/api/auth/register")
        .send({
          username: `login_test_${uniqueId}`,
          email,
          password: "password123",
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" });

      assert.equal(response.status, 200);
      assert.ok(response.body.token);
    });

    test("POST /api/auth/login rejects a wrong password", async () => {
      const uniqueId = randomUUID();
      const email = `wrong_${uniqueId}@test.com`;

      await request(app)
        .post("/api/auth/register")
        .send({
          username: `wrong_pass_${uniqueId}`,
          email,
          password: "correct",
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong" });

      assert.equal(response.status, 401);
    });
  });

  describe("Project CRUD", () => {
    test("POST /api/projects creates a project", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(testProject);

      assert.equal(response.status, 201);
      assert.ok(response.body.project);
    });

    test("GET /api/projects lists projects", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.body.projects));
    });

    test("GET /api/projects/:id retrieves a project", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.project.project_id, projectId);
    });

    test("PUT /api/projects/:id updates a project", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Project", status: "active" });

      assert.equal(response.status, 200);
      assert.equal(response.body.project.name, "Updated Project");
    });

    test("DELETE /api/projects/:id archives a project", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, "Project archived");
    });
  });

  describe("Task CRUD", () => {
    test("POST /api/tasks creates a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Test Task ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.task);
    });

    test("GET /api/tasks/:id retrieves a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Task to retrieve ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(createResponse.status, 201);
      const taskId = createResponse.body.task.task_id as string;

      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.task.task_id, taskId);
    });

    test("PUT /api/tasks/:id updates a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Task to update ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(createResponse.status, 201);
      const taskId = createResponse.body.task.task_id as string;

      const updateResponse = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated Task", status: "in_progress" });

      assert.equal(updateResponse.status, 200);
      assert.equal(updateResponse.body.task.title, "Updated Task");
    });

    test("DELETE /api/tasks/:id deletes a task", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Task to delete ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(createResponse.status, 201);
      const taskId = createResponse.body.task.task_id as string;

      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, "Task deleted");
    });
  });

  describe("Dependency Management", () => {
    test("POST /api/dependencies creates a task dependency", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const firstTask = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Dependency Task 1 ${randomUUID()}`,
          status: "todo",
        });

      const secondTask = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Dependency Task 2 ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(firstTask.status, 201);
      assert.equal(secondTask.status, 201);

      const response = await request(app)
        .post("/api/dependencies")
        .set("Authorization", `Bearer ${token}`)
        .send({
          task_id: firstTask.body.task.task_id,
          depends_on_id: secondTask.body.task.task_id,
          dependency_type: "blocks",
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.dependency);
    });
  });

  describe("Checklist CRUD", () => {
    test("POST /api/checklists creates a checklist with items", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const taskResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: projectId,
          title: `Checklist Task ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(taskResponse.status, 201);
      const taskId = taskResponse.body.task.task_id as string;

      const response = await request(app)
        .post("/api/checklists")
        .set("Authorization", `Bearer ${token}`)
        .send({
          task_id: taskId,
          title: "Test Checklist",
          items: [
            { content: "Item 1", is_completed: false, order_num: 0 },
            { content: "Item 2", is_completed: true, order_num: 1 },
          ],
        });

      assert.equal(response.status, 201);
      assert.ok(response.body.checklist);
      assert.equal(response.body.checklist.items.length, 2);
    });
  });

  describe("Canvas Authorization", () => {
    test("Owner can create a canvas in their project", async () => {
      const ownerToken = await getAuthToken();
      const projectId = await createProject(ownerToken);

      const response = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          project_id: projectId,
          name: "Owner Canvas",
          description: "Created by project owner",
        });

      assert.equal(response.status, 201);
      assert.equal(response.body.canvas.project_id, projectId);
    });

    test("Editor can create, update, and delete a canvas", async () => {
      const ownerToken = await getAuthToken();
      const editorToken = await registerAndLogin(
        editorCredentials.username,
        editorCredentials.email,
        editorCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const editorId = await getUserIdByEmail(editorCredentials.email);

      addProjectMember(projectId, editorId, "editor");

      const createResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          project_id: projectId,
          name: "Editor Canvas",
        });

      assert.equal(createResponse.status, 201);
      const canvasId = createResponse.body.canvas.canvas_id as string;

      const updateResponse = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({ name: "Editor Updated Canvas" });

      assert.equal(updateResponse.status, 200);
      assert.equal(
        updateResponse.body.canvas.name,
        "Editor Updated Canvas",
      );

      const deleteResponse = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${editorToken}`);

      assert.equal(deleteResponse.status, 200);
      assert.equal(deleteResponse.body.success, true);
    });

    test("Viewer cannot create, update, or delete a canvas, but can read it", async () => {
      const ownerToken = await getAuthToken();
      const viewerToken = await registerAndLogin(
        viewerCredentials.username,
        viewerCredentials.email,
        viewerCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const viewerId = await getUserIdByEmail(viewerCredentials.email);

      addProjectMember(projectId, viewerId, "viewer");

      const canvasId = await createCanvasViaApi(
        ownerToken,
        projectId,
        "Viewer Readonly Canvas",
      );

      const createResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          project_id: projectId,
          name: "Viewer Attempted Canvas",
        });

      assert.equal(createResponse.status, 403);

      const readResponse = await request(app)
        .get(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      assert.equal(readResponse.status, 200);
      assert.equal(readResponse.body.canvas.canvas_id, canvasId);

      const updateResponse = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ name: "Viewer Attempted Update" });

      assert.equal(updateResponse.status, 403);

      const deleteResponse = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      assert.equal(deleteResponse.status, 403);
    });

    test("Non-member cannot read or write another project's canvas", async () => {
      const ownerToken = await getAuthToken();
      const nonMemberToken = await registerAndLogin(
        nonMemberCredentials.username,
        nonMemberCredentials.email,
        nonMemberCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const canvasId = await createCanvasViaApi(
        ownerToken,
        projectId,
        "Private Canvas",
      );

      const readResponse = await request(app)
        .get(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`);

      assert.equal(readResponse.status, 404);

      const updateResponse = await request(app)
        .put(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`)
        .send({ name: "Unauthorized Update" });

      assert.equal(updateResponse.status, 404);

      const deleteResponse = await request(app)
        .delete(`/api/canvas/${canvasId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`);

      assert.equal(deleteResponse.status, 404);

      const createResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${nonMemberToken}`)
        .send({
          project_id: projectId,
          name: "Unauthorized Canvas",
        });

      assert.equal(createResponse.status, 403);
    });

    test("Canvas create rejects a null or missing project_id", async () => {
      const token = await getAuthToken();

      const nullProjectResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: null,
          name: "Invalid Canvas",
        });

      assert.equal(nullProjectResponse.status, 400);

      const missingProjectResponse = await request(app)
        .post("/api/canvas")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Missing Project Canvas" });

      assert.equal(missingProjectResponse.status, 400);
    });

    test("Canvas item cannot link to a task from another project", async () => {
      const token = await getAuthToken();
      const canvasProjectId = await createProject(token);
      const otherProjectId = await createProject(token);

      const canvasId = await createCanvasViaApi(
        token,
        canvasProjectId,
        "Task Scope Canvas",
      );

      const taskResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send({
          project_id: otherProjectId,
          title: `Task in another project ${randomUUID()}`,
          status: "todo",
        });

      assert.equal(taskResponse.status, 201);
      const otherProjectTaskId =
        taskResponse.body.task.task_id as string;

      const itemResponse = await request(app)
        .post(`/api/canvas/${canvasId}/items`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          item_type: "task",
          task_id: otherProjectTaskId,
          content: "Cross-project task item",
        });

      assert.equal(itemResponse.status, 400);
    });

    test("Connection cannot be created between items from different canvases", async () => {
      const token = await getAuthToken();
      const projectId = await createProject(token);

      const firstCanvasId = await createCanvasViaApi(
        token,
        projectId,
        "Connection Canvas One",
      );

      const secondCanvasId = await createCanvasViaApi(
        token,
        projectId,
        "Connection Canvas Two",
      );

      const firstItemResponse = await request(app)
        .post(`/api/canvas/${firstCanvasId}/items`)
        .set("Authorization", `Bearer ${token}`)
        .send({ item_type: "square", content: "First item" });

      const secondItemResponse = await request(app)
        .post(`/api/canvas/${secondCanvasId}/items`)
        .set("Authorization", `Bearer ${token}`)
        .send({ item_type: "circle", content: "Second item" });

      assert.equal(firstItemResponse.status, 201);
      assert.equal(secondItemResponse.status, 201);

      const connectionResponse = await request(app)
        .post(`/api/canvas/${firstCanvasId}/connections`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          from_item_id: firstItemResponse.body.item.item_id,
          to_item_id: secondItemResponse.body.item.item_id,
          connection_type: "line",
        });

      assert.equal(connectionResponse.status, 400);
    });

    test("Unauthorized item update returns 404", async () => {
      const ownerToken = await getAuthToken();
      const nonMemberToken = await registerAndLogin(
        nonMemberCredentials.username,
        nonMemberCredentials.email,
        nonMemberCredentials.password,
      );

      const projectId = await createProject(ownerToken);
      const canvasId = await createCanvasViaApi(
        ownerToken,
        projectId,
        "Unauthorized Item Update Canvas",
      );

      const itemResponse = await request(app)
        .post(`/api/canvas/${canvasId}/items`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          item_type: "text",
          content: "Protected item",
        });

      assert.equal(itemResponse.status, 201);
      const itemId = itemResponse.body.item.item_id as string;

      const updateResponse = await request(app)
        .put(`/api/canvas/items/${itemId}`)
        .set("Authorization", `Bearer ${nonMemberToken}`)
        .send({ content: "Unauthorized content change" });

      assert.equal(updateResponse.status, 404);
    });
  });
});
