import { Router } from "express";
import { login, requireAuth } from "../services/auth.service.ts";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, (req: any, res) => {
  res.json({ user: req.user });
});
router.post("/register", async (req: any, res: any) => {
  const { registerUser } = await import("../services/auth.service.ts");
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Username, email and password required" });
  }
  try {
    const { user, token } = await registerUser(username, email, password);
    return res.status(201).json({ user, token });
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      return res.status(409).json({ message: "User already exists" });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
});

export default router;
