
import { Router } from "express";
import { requireUserOrAgent } from "../middleware/agentAuthMiddleware.ts";
import {
  createEdge,
  createNode,
  createWorkflow,
  deleteEdge,
  deleteNode,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  updateNode,
  updateWorkflow,
  publishWorkflow,
  type NodeInput,
  type WorkflowDefinition,
  type WorkflowStatus,
} from "../services/workflow.service.ts";
import {
  createVersion,
  getVersion,
  listVersions,
} from "../services/workflowVersion.service.ts";
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

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const validStatuses = new Set([
      "draft",
      "test",
      "published",
      "paused",
      "archived",
    ]);

    if (status && !validStatuses.has(status)) {
      return res.status(400).json({
        error: "Invalid workflow status",
        request_id: getRequestId(req),
      });
    }

    return res.json({
      workflows: listWorkflows(
        resolveActor(req),
        projectId,
        status as WorkflowStatus | undefined,
      ),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Workflows could not be listed");
  }
});

router.post("/", (req, res) => {
  try {
    const body = objectBody(req.body);
    const workflow = createWorkflow(
      resolveActor(req),
      typeof body.project_id === "string" ? body.project_id : "",
      typeof body.name === "string" ? body.name : "",
      typeof body.description === "string" ? body.description : undefined,
    );

    return res.status(201).json({ workflow });
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow could not be created");
  }
});

router.get("/:workflowId", (req, res) => {
  try {
    return res.json(
      getWorkflow(resolveActor(req), String(req.params.workflowId)),
    );
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow could not be read");
  }
});

router.put("/:workflowId", (req, res) => {
  try {
    const body = objectBody(req.body);
    const definition =
      typeof body.definition === "object" &&
      body.definition !== null &&
      !Array.isArray(body.definition)
        ? body.definition as WorkflowDefinition
        : undefined;

    const result = updateWorkflow(
      resolveActor(req),
      String(req.params.workflowId),
      {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.description === "string" || body.description === null
          ? { description: body.description }
          : {}),
        ...(definition ? { definition } : {}),
      },
    );

    return res.json(result);
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow draft could not be saved");
  }
});

router.delete("/:workflowId", (req, res) => {
  try {
    return res.json(
      deleteWorkflow(resolveActor(req), String(req.params.workflowId)),
    );
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow could not be archived");
  }
});

router.post("/:workflowId/nodes", (req, res) => {
  try {
    const body = objectBody(req.body);
    const result = createNode(
      resolveActor(req),
      String(req.params.workflowId),
      {
        node_type: body.node_type as NodeInput["node_type"],
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.purpose === "string" ? { purpose: body.purpose } : {}),
        ...(typeof body.config === "object" &&
        body.config !== null &&
        !Array.isArray(body.config)
          ? { config: body.config as Record<string, unknown> }
          : {}),
        ...(typeof body.position_x === "number"
          ? { position_x: body.position_x }
          : {}),
        ...(typeof body.position_y === "number"
          ? { position_y: body.position_y }
          : {}),
        ...(typeof body.credential_ref === "string" ||
        body.credential_ref === null
          ? { credential_ref: body.credential_ref }
          : {}),
      },
    );

    return res.status(201).json(result);
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow node could not be created");
  }
});

router.patch("/:workflowId/nodes/:nodeId", (req, res) => {
  try {
    const body = objectBody(req.body);
    const result = updateNode(
      resolveActor(req),
      String(req.params.workflowId),
      String(req.params.nodeId),
      body as Partial<NodeInput>,
    );

    return res.json(result);
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow node could not be updated");
  }
});

router.delete("/:workflowId/nodes/:nodeId", (req, res) => {
  try {
    return res.json(
      deleteNode(
        resolveActor(req),
        String(req.params.workflowId),
        String(req.params.nodeId),
      ),
    );
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow node could not be deleted");
  }
});

router.post("/:workflowId/edges", (req, res) => {
  try {
    const body = objectBody(req.body);
    const result = createEdge(
      resolveActor(req),
      String(req.params.workflowId),
      typeof body.from_node_id === "string" ? body.from_node_id : "",
      typeof body.to_node_id === "string" ? body.to_node_id : "",
      typeof body.branch_label === "string" ? body.branch_label : undefined,
      typeof body.condition_expr === "string" ? body.condition_expr : undefined,
    );

    return res.status(201).json(result);
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow edge could not be created");
  }
});

router.delete("/:workflowId/edges/:edgeId", (req, res) => {
  try {
    return res.json(
      deleteEdge(
        resolveActor(req),
        String(req.params.workflowId),
        String(req.params.edgeId),
      ),
    );
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow edge could not be deleted");
  }
});

router.post("/:workflowId/versions", (req, res) => {
  try {
    const version = createVersion(
      resolveActor(req),
      String(req.params.workflowId),
    );
    return res.status(201).json({ version });
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow version could not be created");
  }
});

router.get("/:workflowId/versions", (req, res) => {
  try {
    return res.json({
      versions: listVersions(
        resolveActor(req),
        String(req.params.workflowId),
      ),
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow versions could not be listed");
  }
});

router.get("/:workflowId/versions/:versionId", (req, res) => {
  try {
    const version = getVersion(
      resolveActor(req),
      String(req.params.versionId),
    );

    if (version.workflow_id !== String(req.params.workflowId)) {
      return res.status(404).json({
        error: "Workflow version not found",
        request_id: getRequestId(req),
      });
    }

    return res.json({ version });
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow version could not be read");
  }
});

router.post("/:workflowId/publish", (req, res) => {
  try {
    const result = publishWorkflow(resolveActor(req), String(req.params.workflowId));

    return res.json({
      workflow: result,
      idempotency_key: `pm-p7-06:publish:${String(req.params.workflowId)}`,
      warning:
        "Publish approvals are disabled in preview-only mode. No workflow status change occurs.",
    });
  } catch (error) {
    return sendSafeError(req, res, error, "Workflow could not be published");
  }
});

// No test-execution, live-execution, replay, or runtime endpoints.

export default router;
