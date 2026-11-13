import { Router } from "express";
import { uiLayoutService } from "../services/uiLayout.service.ts";
import { requireAuth } from "../middleware/auth.middleware.ts";

const router = Router();

// Get layout for a page
router.get("/:page", requireAuth, (req: any, res) => {
  try {
    const layout = uiLayoutService.getLayout(req.user.user_id, req.params.page);
    if (!layout) return res.json({ layout: null });
    res.json({ layout });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to load layout", error: err.message });
  }
});

// Save layout for a page
router.post("/:page", requireAuth, (req: any, res) => {
  try {
    const { elements, is_locked } = req.body;
    if (!Array.isArray(elements)) return res.status(400).json({ message: "elements must be an array" });
    const layout = uiLayoutService.saveLayout(req.user.user_id, req.params.page, elements, !!is_locked);
    res.json({ layout });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to save layout", error: err.message });
  }
});

// Delete/reset layout for a page
router.delete("/:page", requireAuth, (req: any, res) => {
  try {
    const deleted = uiLayoutService.deleteLayout(req.user.user_id, req.params.page);
    res.json({ message: deleted ? "Layout reset" : "No layout found" });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to reset layout", error: err.message });
  }
});

export default router;
