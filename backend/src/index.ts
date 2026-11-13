import "./env.ts";
import express from "express";
import { configureSecurity } from "./middleware/security.middleware.ts";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import authRouter from "./routes/auth.routes.ts";
import usersRouter from "./routes/users.routes.ts";
import dashboardRouter from "./routes/dashboard.routes.ts";
import agentsRouter from "./routes/agents.routes.ts";
import tasksRouter from "./routes/tasks.routes.ts";
import projectsRouter from "./routes/projects.routes.ts";
import checklistsRouter from "./routes/checklists.routes.ts";
import dependenciesRouter from "./routes/dependencies.routes.ts";
import gitRouter from "./routes/git.routes.ts";
import importExportRouter from "./routes/importExport.routes.ts";
import canvasRouter from "./routes/canvas.routes.ts";
import backupRouter from "./routes/backup.routes.ts";
import monitoringRouter from "./routes/monitoring.routes.ts";
import uiLayoutRouter from "./routes/uiLayout.routes.ts";
import connectorsRouter from "./routes/connectors.routes.ts";
import commentsRouter from "./routes/comments.routes.ts";
import credentialReferencesRouter from "./routes/credentialReferences.routes.ts";
import approvalsRouter from "./routes/approvals.routes.ts";
import auditRouter from "./routes/audit.routes.ts";
import automationWorkflowsRouter from "./routes/automation.workflows.routes.ts";
import automationEnvironmentsRouter from "./routes/automation.environments.routes.ts";
import { createAutomationTestRouter } from "./routes/automation.test.routes.ts";
import { getDb, closeDb } from "./database/index.ts";

const app = express();

configureSecurity(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/checklists", checklistsRouter);
app.use("/api/dependencies", dependenciesRouter);
app.use("/api/git", gitRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/backup", backupRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/ui-layout", uiLayoutRouter);
app.use("/api/connectors", connectorsRouter);
app.use("/api/comments", commentsRouter);

// PM-P7-03 — project-scoped, preview-only Automation APIs.
app.use(
  "/api/v1/automation/credential-references",
  credentialReferencesRouter,
);
app.use("/api/v1/automation/approvals", approvalsRouter);
app.use("/api/v1/automation/audit", auditRouter);
app.use("/api/v1/automation/workflows", automationWorkflowsRouter);
app.use("/api/v1/automation/environments", automationEnvironmentsRouter);

// PM-P7-05 — test runs and traces share the PM-P7-02 /api/automation prefix.
app.use("/api/automation", createAutomationTestRouter(getDb()));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", database: "connected" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  // Detailed error objects are not returned to clients.
  console.error("Unhandled API error:", err.name);
  res.status(500).json({ error: "Internal server error" });
});

getDb();

process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

export { app, getDb, closeDb };