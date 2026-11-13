import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.ts";
import * as backupService from "../services/backup.service.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";

const router = Router();

function actorFrom(req: any): Actor {
  const user = req.user;
  return { actor_type: "user", actor_id: user?.user_id ?? "anonymous" };
}
router.use(requireAuth);

// Create backup
router.post("/", (req, res) => {
  try {
    const backup = backupService.createBackup("manual");
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "backup.created",
        target_table: "backups",
        target_id: backup?.filename ?? "unknown",
        new_value: backup,
        trigger: "api",
      },
      req,
    );
    res.status(201).json({ backup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List backups
router.get("/", (req, res) => {
  try {
    const backups = backupService.listBackups();
    res.json({ backups });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete backup
router.delete("/:filename", (req, res) => {
  try {
    const deleted = backupService.deleteBackup(req.params.filename);
    if (!deleted) {
      return res.status(404).json({ error: "Backup not found" });
    }
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "backup.deleted",
        target_table: "backups",
        target_id: req.params.filename,
        old_value: { filename: req.params.filename },
        trigger: "api",
      },
      req,
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Prune old backups
router.post("/prune", (req, res) => {
  try {
    const keep = parseInt(req.body?.keep || "30");
    const pruned = backupService.pruneOldBackups(keep);
    res.json({ pruned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
