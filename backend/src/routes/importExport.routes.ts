import { Router } from "express";
import { importExportService } from "../services/importExport.service.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";
import { recordRequestAction } from "../services/audit.service.ts";
import type { Actor } from "../services/actor.service.ts";

const router = Router();

function actorFrom(req: any): Actor {
  const user = req.user;
  return { actor_type: "user", actor_id: user?.user_id ?? "anonymous" };
}

// Export all data as JSON
router.get("/export/json", requireAuth, async (req, res) => {
  try {
    const maskPII = req.query.mask_pii !== "false";
    const data = importExportService.exportJSON(maskPII);
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "export.completed",
        target_table: "projects",
        target_id: "export:json",
        new_value: { format: "json", mask_pii: maskPII },
        trigger: "api",
      },
      req,
    );
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=project-manager-export.json");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to export JSON", error: err.message });
  }
});

// Export tasks as CSV
router.get("/export/csv", requireAuth, async (req, res) => {
  try {
    const maskPII = req.query.mask_pii !== "false";
    const csv = importExportService.exportTasksCSV(maskPII);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=tasks-export.csv");
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to export CSV", error: err.message });
  }
});

// Export tasks as Markdown
router.get("/export/markdown", requireAuth, async (req, res) => {
  try {
    const maskPII = req.query.mask_pii !== "false";
    const md = importExportService.exportTasksMarkdown(maskPII);
    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", "attachment; filename=tasks-export.md");
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to export Markdown", error: err.message });
  }
});

// Import data from JSON
router.post("/import/json", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ message: "Invalid JSON data" });
    }
    const result = importExportService.importJSON(data);
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "import.completed",
        target_table: "projects",
        target_id: "import:json",
        new_value: { format: "json", imported: result },
        trigger: "import",
      },
      req,
    );
    res.json({ message: "Import completed", ...result });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to import data", error: err.message });
  }
});


// Export as PDF (HTML report)
router.get("/export/pdf", requireAuth, async (req, res) => {
  try {
    const html = importExportService.exportPDF();
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", "attachment; filename=project-manager-report.html");
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to export PDF", error: err.message });
  }
});

// Export as XLSX (Excel-compatible TSV)
router.get("/export/xlsx", requireAuth, async (req, res) => {
  try {
    const tsv = importExportService.exportXLSX();
    res.setHeader("Content-Type", "application/vnd.ms-excel");
    res.setHeader("Content-Disposition", "attachment; filename=tasks-export.xlsx");
    res.send(tsv);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to export XLSX", error: err.message });
  }
});

// Export project bundle
router.get("/export/project/:id", requireAuth, async (req, res) => {
  try {
    const bundle = importExportService.exportProjectBundle(req.params.id as string);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=project-${req.params.id as string}-bundle.json`);
    res.json(bundle);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to export project", error: err.message });
  }
});


// Import tasks from CSV
router.post("/import/csv", requireAuth, async (req: any, res) => {
  try {
    const { csv, project_id } = req.body;
    if (!csv) return res.status(400).json({ message: "CSV data is required" });
    if (!project_id) return res.status(400).json({ message: "project_id is required" });
    const result = importExportService.importCSV(csv, project_id, req.user.user_id);
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: project_id,
        action: "import.completed",
        target_table: "tasks",
        target_id: "import:csv",
        new_value: { format: "csv", project_id, imported: result },
        trigger: "import",
      },
      req,
    );
    res.json({ message: "CSV import completed", ...result });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to import CSV", error: err.message });
  }
});

// Import project bundle
router.post("/import/project", requireAuth, async (req: any, res) => {
  try {
    const data = req.body;
    if (!data || !data.project) return res.status(400).json({ message: "Invalid project bundle" });
    const result = importExportService.importProjectBundle(data, req.user.user_id);
    recordRequestAction(
      {
        actor: actorFrom(req),
        project_id: null,
        action: "import.completed",
        target_table: "projects",
        target_id: "import:project",
        new_value: { format: "project-bundle", imported: result },
        trigger: "import",
      },
      req,
    );
    res.json({ message: "Project import completed", ...result });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to import project", error: err.message });
  }
});

export default router;