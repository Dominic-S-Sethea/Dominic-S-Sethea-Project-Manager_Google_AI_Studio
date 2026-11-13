import helmet from "helmet";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";

export function configureSecurity(app: any) {
  // Security headers (helmet)
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production",
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // CORS — configurable via env var, defaults to localhost origins
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
    : ["http://localhost:5173", "http://localhost:4000"];

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Prevent clickjacking / XSS / etc via helmet
  app.use((req: Request, _res: Response, next: NextFunction) => {
    // X-Content-Type-Options already set by helmet
    next();
  });
}
