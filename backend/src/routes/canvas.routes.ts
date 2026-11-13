import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import * as canvasService from "../services/canvas.service.ts";
import { CanvasServiceError } from "../services/canvas.service.ts";
import {
  getProjectAccess,
  projectExists,
} from "../services/projectAccess.service.ts";

const router = Router();

type CanvasPermission = "read" | "write" | "delete";

// All Canvas routes require authentication.
router.use(requireAuth);

function getBody(req: AuthRequest): Record<string, unknown> {
  const body: unknown = req.body;

  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body)
  ) {
    return body as Record<string, unknown>;
  }

  return {};
}

function getUserId(
  req: AuthRequest,
  res: Response,
): string | null {
  const userId = req.user?.user_id;

  if (!userId) {
    res.status(401).json({ error: "Missing or invalid token" });
    return null;
  }

  return userId;
}

function sendCanvasError(res: Response, error: unknown): void {
  if (error instanceof CanvasServiceError) {
    res
      .status(error.statusCode)
      .json({ error: error.message });
    return;
  }

  // Do not expose SQL errors, stack traces, or unexpected internal details.
  console.error("Canvas route error:", error);
  res.status(500).json({ error: "Internal server error" });
}

/**
 * Load a canvas and authorize the caller against its project.
 *
 * If the canvas is missing, has no project, or the caller cannot read its
 * project, return 404. This deliberately avoids disclosing the existence
 * of resources outside the caller's accessible projects.
 *
 * A caller who can read the project but lacks the requested write/delete
 * permission receives 403.
 */
async function requireCanvasAccess(
  canvasId: string,
  userId: string,
  permission: CanvasPermission,
  res: Response,
): Promise<canvasService.Canvas | null> {
  const canvas = canvasService.getCanvasById(canvasId);

  if (!canvas || !canvas.project_id) {
    res.status(404).json({ error: "Canvas not found" });
    return null;
  }

  const access = await getProjectAccess(canvas.project_id, userId);

  if (!access || !access.canRead) {
    res.status(404).json({ error: "Canvas not found" });
    return null;
  }

  if (permission === "write" && !access.canWrite) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }

  if (permission === "delete" && !access.canDelete) {
    res.status(403).json({ error: "Insufficient permissions" });
    return null;
  }

  return canvas;
}

// Create canvas.
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const body = getBody(req as AuthRequest);
    const projectId = body.project_id;
    const name = body.name;
    const description = body.description;

    if (typeof projectId !== "string" || !projectId.trim()) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        error: "description must be a string or null",
      });
      return;
    }

    if (!projectExists(projectId)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const access = await getProjectAccess(projectId, userId);

    if (!access || !access.canWrite) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const canvas = canvasService.createCanvas(
      projectId,
      name,
      description ?? null,
      userId,
    );

    res.status(201).json({ canvas });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// List canvases.
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const rawProjectId = req.query.project_id;

    if (
      rawProjectId !== undefined &&
      typeof rawProjectId !== "string"
    ) {
      res.status(400).json({ error: "Invalid project_id" });
      return;
    }

    if (typeof rawProjectId === "string") {
      if (!rawProjectId.trim()) {
        res.status(400).json({ error: "Invalid project_id" });
        return;
      }

      if (!projectExists(rawProjectId)) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const access = await getProjectAccess(rawProjectId, userId);

      if (!access || !access.canRead) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const canvases = canvasService.listCanvases(rawProjectId);
      res.json({ canvases });
      return;
    }

    // Preserve the service's existing no-project filter behavior, but never
    // expose its unfiltered result directly. Include only canvases whose
    // projects the caller can read; omit legacy NULL-project canvases.
    const allCanvases = canvasService.listCanvases(null);
    const visibleCanvases: canvasService.Canvas[] = [];

    for (const canvas of allCanvases) {
      if (!canvas.project_id) continue;

      const access = await getProjectAccess(
        canvas.project_id,
        userId,
      );

      if (access?.canRead) {
        visibleCanvases.push(canvas);
      }
    }

    res.json({ canvases: visibleCanvases });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Get canvas with items and connections.
router.get("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "read",
      res,
    );

    if (!canvas) return;

    const result = canvasService.getCanvasWithItems(canvasId);

    if (!result) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ canvas: result });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update canvas metadata.
router.put("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const updates: {
      name?: string;
      description?: string | null;
    } = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        res.status(400).json({ error: "name must be a non-empty string" });
        return;
      }

      updates.name = body.name;
    }

    if (Object.hasOwn(body, "description")) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        res.status(400).json({
          error: "description must be a string or null",
        });
        return;
      }

      updates.description = body.description;
    }

    const updatedCanvas = canvasService.updateCanvas(
      canvasId,
      updates,
    );

    if (!updatedCanvas) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ canvas: updatedCanvas });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete canvas.
router.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteCanvas(canvasId);

    if (!deleted) {
      res.status(404).json({ error: "Canvas not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Add item to canvas.
router.post("/:id/items", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const item = canvasService.addItem(
      canvasId,
      body as unknown as Parameters<typeof canvasService.addItem>[1],
    );

    res.status(201).json({ item });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update item. Authorization is resolved using the item's actual parent canvas.
router.put("/items/:itemId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const itemId = req.params.itemId as string;
    const existingItem = canvasService.getCanvasItemById(itemId);

    if (!existingItem) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      existingItem.canvas_id,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const item = canvasService.updateItem(
      itemId,
      body as Parameters<typeof canvasService.updateItem>[1],
    );

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ item });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete item.
router.delete("/items/:itemId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const itemId = req.params.itemId as string;
    const item = canvasService.getCanvasItemById(itemId);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      item.canvas_id,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteItem(itemId);

    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Add connection.
router.post("/:id/connections", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const canvasId = req.params.id as string;
    const canvas = await requireCanvasAccess(
      canvasId,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);

    if (
      typeof body.from_item_id !== "string" ||
      !body.from_item_id.trim()
    ) {
      res.status(400).json({
        error: "from_item_id is required",
      });
      return;
    }

    if (
      typeof body.to_item_id !== "string" ||
      !body.to_item_id.trim()
    ) {
      res.status(400).json({
        error: "to_item_id is required",
      });
      return;
    }

    if (
      body.connection_type !== undefined &&
      body.connection_type !== "line" &&
      body.connection_type !== "arrow"
    ) {
      res.status(400).json({
        error: 'connection_type must be "line" or "arrow"',
      });
      return;
    }

    if (
      body.style !== undefined &&
      body.style !== null &&
      typeof body.style !== "string"
    ) {
      res.status(400).json({
        error: "style must be a string or null",
      });
      return;
    }

    const connection = canvasService.addConnection(
      canvasId,
      body.from_item_id,
      body.to_item_id,
      body.connection_type === "arrow" ? "arrow" : "line",
      (body.style as string | null | undefined) ?? null,
    );

    res.status(201).json({ connection });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Update connection.
router.put("/connections/:connId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const connectionId = req.params.connId as string;
    const existingConnection =
      canvasService.getCanvasConnectionById(connectionId);

    if (!existingConnection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      existingConnection.canvas_id,
      userId,
      "write",
      res,
    );

    if (!canvas) return;

    const body = getBody(req as AuthRequest);
    const updates: {
      connection_type?: string;
      style?: string | null;
    } = {};

    if (Object.hasOwn(body, "connection_type")) {
      if (
        body.connection_type !== "line" &&
        body.connection_type !== "arrow"
      ) {
        res.status(400).json({
          error: 'connection_type must be "line" or "arrow"',
        });
        return;
      }

      updates.connection_type = body.connection_type;
    }

    if (Object.hasOwn(body, "style")) {
      if (
        body.style !== null &&
        typeof body.style !== "string"
      ) {
        res.status(400).json({
          error: "style must be a string or null",
        });
        return;
      }

      updates.style = body.style;
    }

    if (
      updates.connection_type === undefined &&
      updates.style === undefined
    ) {
      res.status(400).json({
        error: "At least one connection field must be provided",
      });
      return;
    }

    const connection = canvasService.updateConnection(
      connectionId,
      updates,
    );

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({ connection });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

// Delete connection.
router.delete("/connections/:connId", async (req, res) => {
  try {
    const userId = getUserId(req as AuthRequest, res);
    if (!userId) return;

    const connectionId = req.params.connId as string;
    const connection =
      canvasService.getCanvasConnectionById(connectionId);

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    const canvas = await requireCanvasAccess(
      connection.canvas_id,
      userId,
      "delete",
      res,
    );

    if (!canvas) return;

    const deleted = canvasService.deleteConnection(connectionId);

    if (!deleted) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    sendCanvasError(res, error);
  }
});

export default router;
