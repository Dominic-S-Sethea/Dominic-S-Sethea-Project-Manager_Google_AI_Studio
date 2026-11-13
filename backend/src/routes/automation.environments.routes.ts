
import { Router } from "express";
import { requireUserOrAgent } from "../middleware/agentAuthMiddleware.ts";
import {
  createEnvironment,
  deleteEnvironment,
  getEnvironment,
  listEnvironments,
  updateEnvironment,
  type EnvironmentMode,
} from "../services/environment.service.ts";
import {
  getRequestId,
  resolveActor,
  sendSafeError,
} from "../services/actor.service.ts";

const router = Router();

function objectBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

router.use(requireUserOrAgent);

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
      environments: listEnvironments(projectId, resolveActor(req)),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Environments could not be listed");
  }
});

router.post("/", (req, res) => {
  try {
    const body = objectBody(req.body);
    const environment = createEnvironment(
      {
        project_id: typeof body.project_id === "string" ? body.project_id : "",
        name: typeof body.name === "string" ? body.name : "",
        mode: body.mode as EnvironmentMode,
      },
      resolveActor(req),
    );

    return res.status(201).json({ environment });
  } catch (error) {
    return sendSafeError(req, res, error, "Environment could not be created");
  }
});

router.get("/:environmentId", (req, res) => {
  try {
    return res.json({
      environment: getEnvironment(
        String(req.params.environmentId),
        resolveActor(req),
      ),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Environment could not be read");
  }
});

router.put("/:environmentId", (req, res) => {
  try {
    const body = objectBody(req.body);
    const environment = updateEnvironment(
      String(req.params.environmentId),
      {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.mode === "string"
          ? { mode: body.mode as EnvironmentMode }
          : {}),
      },
      resolveActor(req),
    );

    return res.json({ environment });
  } catch (error) {
    return sendSafeError(req, res, error, "Environment could not be updated");
  }
});

router.delete("/:environmentId", (req, res) => {
  try {
    return res.json(
      deleteEnvironment(
        String(req.params.environmentId),
        resolveActor(req),
      ),
    );
  } catch (error) {
    return sendSafeError(req, res, error, "Environment could not be deleted");
  }
});

export default router;
