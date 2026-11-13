import { Router } from "express";
import { projectService, type ProjectCreate, type ProjectUpdate } from "../services/project.service.ts";
import { requireAuth, requireRole } from "../middleware/auth.middleware.ts";
import { getProjectAccess } from "../services/projectAccess.service.ts";
import type { AuthRequest } from "../middleware/auth.middleware.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";

const router = Router();

function actorFrom(req: AuthRequest): Actor {
  const user = req.user!;
  return { actor_type: "user", actor_id: user.user_id };
}

// Helper: check if caller can write a resource (owner role, or editor who owns it)
function canWrite(req: AuthRequest, resourceCreatedBy: string): boolean {
  const user = req.user!;
  if (user.role === "owner") return true;
  if (user.role === "editor") return resourceCreatedBy === user.user_id;
  return false;
}

// GET /api/projects — read-only for projects the caller is a member of
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const status = (req.query.status as "active" | "archived") || undefined;
    const allProjects = await projectService.getAll(status);
    const accessible: typeof allProjects = [];
    for (const p of allProjects) {
      const access = await getProjectAccess(p.project_id, user.user_id);
      if (access !== null && access.canRead) {
        accessible.push(p);
      }
    }
    res.json({ projects: accessible });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// GET /api/projects/:id — read-only for project members
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const project = await projectService.get(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const access = await getProjectAccess(project.project_id, user.user_id);
    if (!access || !access.canRead) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

// POST /api/projects — owner and editor can create
router.post("/", requireAuth, requireRole("owner", "editor"), async (req, res) => {
  try {
    const body = req.body as ProjectCreate;
    if (!body.name) return res.status(400).json({ message: "Project name is required" });
    const user = (req as AuthRequest).user!;
    const project = await projectService.create({
      name: body.name,
      description: body.description || "",
      status: body.status || "active",
      created_by: user.user_id,
      metadata: body.metadata || {},
    });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: project.project_id,
        action: "project.created",
        target_table: "projects",
        target_id: project.project_id,
        new_value: project,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ message: "Failed to create project" });
  }
});

// PUT /api/projects/:id — owner all, editor own content only
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const project = await projectService.get(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (user.role !== "owner" && project.created_by !== user.user_id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const body = req.body as ProjectUpdate;
    const updated = await projectService.update(req.params.id as string, body);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: updated.project_id,
        action: "project.updated",
        target_table: "projects",
        target_id: updated.project_id,
        old_value: project,
        new_value: updated,
        trigger: "api",
      },
      req,
    );
    res.json({ project: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update project" });
  }
});

// DELETE /api/projects/:id — owner all, editor own content only
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthRequest).user!;
    const project = await projectService.get(req.params.id as string);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (user.role !== "owner" && project.created_by !== user.user_id) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const deleted = await projectService.delete(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: "Project not found" });
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: project.project_id,
        action: "project.deleted",
        target_table: "projects",
        target_id: project.project_id,
        old_value: project,
        trigger: "api",
      },
      req,
    );
    res.json({ message: "Project archived" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete project" });
  }
});

export default router;
