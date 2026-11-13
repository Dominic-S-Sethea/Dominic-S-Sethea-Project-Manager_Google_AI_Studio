import "./env.ts";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { getDb, closeDb } from "./database/index.ts";
import { configureSecurity } from "./middleware/security.middleware.ts";
import { apiLimiter, authLimiter } from "./middleware/rateLimit.middleware.ts";
import { requireAuth } from "./middleware/auth.middleware.ts";
import authRouter from "./routes/auth.routes.ts";
import tasksRouter from "./routes/tasks.routes.ts";
import projectsRouter from "./routes/projects.routes.ts";
import agentsRouter from "./routes/agents.routes.ts";
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
import dashboardRouter from "./routes/dashboard.routes.ts";
import usersRouter from "./routes/users.routes.ts";
import { createAutomationEventsRouter } from "./routes/automation.events.ts";
import { createAutomationExecutionsRouter } from "./routes/automation.executions.ts";
import { createAutomationTestRouter } from "./routes/automation.test.routes.ts";
import credentialReferencesRouter from "./routes/credentialReferences.routes.ts";
import approvalsRouter from "./routes/approvals.routes.ts";
import auditRouter from "./routes/audit.routes.ts";
import automationWorkflowsRouter from "./routes/automation.workflows.routes.ts";
import automationEnvironmentsRouter from "./routes/automation.environments.routes.ts";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// PM-P7-05 must precede the existing executions router so the exact
// /executions/:id/replay path cannot be consumed as a PM-P7-02 action.
app.use("/api/automation", createAutomationTestRouter(getDb()));

// PM-P7-02 preview-only event and execution orchestration routes.
app.use("/api/automation/events", createAutomationEventsRouter(getDb()));
app.use("/api/automation/executions", createAutomationExecutionsRouter(getDb()));

// PM-P7-03 uses the separately approved /api/v1/automation prefix.
app.use(
  "/api/v1/automation/credential-references",
  credentialReferencesRouter,
);
app.use("/api/v1/automation/approvals", approvalsRouter);
app.use("/api/v1/automation/audit", auditRouter);
app.use("/api/v1/automation/workflows", automationWorkflowsRouter);
app.use("/api/v1/automation/environments", automationEnvironmentsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// API 404 handler — keep before Vite/SPA fallback.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  console.error("Unhandled API error:", err.name);
  res.status(500).json({ error: "Internal server error" });
});

getDb();

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "..", "..", "frontend", "vite.config.ts"),
      root: path.resolve(__dirname, "..", "..", "frontend"),
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = Number.parseInt(process.env.PORT ?? "3000", 10);

  app.listen(port, "0.0.0.0", () => {
    console.log(`Unified Full-Stack Server running on http://localhost:${port}`);
    console.log("API: /api/*");
    console.log("Frontend: /");
  });
}

process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

void startServer();