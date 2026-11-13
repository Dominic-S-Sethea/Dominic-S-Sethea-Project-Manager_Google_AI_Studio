
import { Router } from "express";
import { requireUserOrAgent } from "../middleware/agentAuthMiddleware.ts";
import { resolveActor, sendSafeError, getRequestId } from "../services/actor.service.ts";
import { connectorService } from "../services/connector.service.ts";

const router = Router();

function objectBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

router.use(requireUserOrAgent);

// Available connector definitions contain metadata only.
router.get("/available", (_req, res) => {
  res.json({ connectors: connectorService.listAvailable() });
});

// Connector reads require an explicit project. Unmapped legacy connectors are
// quarantined by the service and never appear in a project listing.
router.get("/", (req, res) => {
  try {
    const projectId =
      typeof req.query.project_id === "string" ? req.query.project_id : "";

    if (!projectId) {
      return res.status(400).json({
        error: "project_id is required",
        request_id: getRequestId(req),
      });
    }

    return res.json({
      connectors: connectorService.listInstances(
        projectId,
        resolveActor(req),
      ),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Connectors could not be listed");
  }
});

router.get("/:id", (req, res) => {
  try {
    const connector = connectorService.getInstance(
      String(req.params.id),
      resolveActor(req),
    );

    if (!connector) {
      return res.status(404).json({
        error: "Connector not found",
        request_id: getRequestId(req),
      });
    }

    return res.json({ connector });
  } catch (error) {
    return sendSafeError(req, res, error, "Connector could not be read");
  }
});

router.post("/", (req, res) => {
  try {
    const body = objectBody(req.body);
    const config =
      typeof body.config === "object" &&
      body.config !== null &&
      !Array.isArray(body.config)
        ? body.config as Record<string, unknown>
        : {};

    const allowedActions = Array.isArray(body.allowed_actions)
      ? body.allowed_actions.filter(
          (action): action is string => typeof action === "string",
        )
      : [];

    const connector = connectorService.createInstance(
      {
        project_id:
          typeof body.project_id === "string" ? body.project_id : "",
        environment_id:
          typeof body.environment_id === "string" ? body.environment_id : "",
        provider: typeof body.provider === "string" ? body.provider : "",
        name: typeof body.name === "string" ? body.name : "",
        config,
        allowed_actions: allowedActions,
      },
      resolveActor(req),
    );

    return res.status(201).json({ connector });
  } catch (error) {
    return sendSafeError(req, res, error, "Connector could not be created");
  }
});

router.patch("/:id/config", (req, res) => {
  try {
    const body = objectBody(req.body);
    const configValue =
      typeof body.config === "object" &&
      body.config !== null &&
      !Array.isArray(body.config)
        ? body.config
        : body;

    const connector = connectorService.updateConfig(
      String(req.params.id),
      configValue as Record<string, unknown>,
      resolveActor(req),
    );

    return res.json({ connector });
  } catch (error) {
    return sendSafeError(req, res, error, "Connector configuration could not be updated");
  }
});

router.patch("/:id/status", (req, res) => {
  try {
    const body = objectBody(req.body);
    const status = body.status;

    if (
      status !== "disconnected" &&
      status !== "error" &&
      status !== "pending" &&
      status !== "connected"
    ) {
      return res.status(400).json({
        error: "Invalid connector status",
        request_id: getRequestId(req),
      });
    }

    const connector = connectorService.updateStatus(
      String(req.params.id),
      status,
      resolveActor(req),
    );

    return res.json({ connector });
  } catch (error) {
    return sendSafeError(req, res, error, "Connector status could not be updated");
  }
});

router.delete("/:id", (req, res) => {
  try {
    const deleted = connectorService.deleteInstance(
      String(req.params.id),
      resolveActor(req),
    );

    if (!deleted) {
      return res.status(404).json({
        error: "Connector not found",
        request_id: getRequestId(req),
      });
    }

    return res.json({ deleted: true });
  } catch (error) {
    return sendSafeError(req, res, error, "Connector could not be deleted");
  }
});

// Provider operations are deliberately retained as disabled endpoints. They
// never contact GitHub, Hermes, or another external provider in this card.
router.post("/:id/test", (req, res) => {
  void req;
  return res.status(423).json({
    error: "External provider verification is disabled in preview-only mode",
    code: "RUNTIME_DISABLED",
    request_id: getRequestId(req),
  });
});

router.get("/:id/github/repos", (req, res) => {
  res.status(423).json({
    error: "External provider actions are disabled in preview-only mode",
    code: "RUNTIME_DISABLED",
    request_id: getRequestId(req),
  });
});

router.get("/:id/github/issues", (req, res) => {
  res.status(423).json({
    error: "External provider actions are disabled in preview-only mode",
    code: "RUNTIME_DISABLED",
    request_id: getRequestId(req),
  });
});

router.post("/:id/github/issues", (req, res) => {
  res.status(423).json({
    error: "External provider actions are disabled in preview-only mode",
    code: "RUNTIME_DISABLED",
    request_id: getRequestId(req),
  });
});

router.post("/:id/hermes/message", (req, res) => {
  res.status(423).json({
    error: "External provider actions are disabled in preview-only mode",
    code: "RUNTIME_DISABLED",
    request_id: getRequestId(req),
  });
});

router.get("/:id/hermes/models", (req, res) => {
  res.status(423).json({
    error: "External provider actions are disabled in preview-only mode",
    code: "RUNTIME_DISABLED",
    request_id: getRequestId(req),
  });
});

export default router;
