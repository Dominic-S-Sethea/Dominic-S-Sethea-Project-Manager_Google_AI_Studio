
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getRequestId } from "../services/actor.service.ts";

export interface AuthUser {
  user_id: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  request_id?: string;
}

function decodeUserToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "project-manager-jwt-secret",
    );

    if (typeof decoded === "string") return null;

    const payload = decoded as JwtPayload;

    if (
      typeof payload.user_id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      user_id: payload.user_id,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing or invalid token",
      request_id: getRequestId(req),
    });
    return;
  }

  const token = authorization.slice(7).trim();
  const user = token ? decodeUserToken(token) : null;

  if (!user) {
    res.status(401).json({
      error: "Invalid or expired token",
      request_id: getRequestId(req),
    });
    return;
  }

  req.user = user;
  getRequestId(req);
  next();
};

export const requireRole = (...roles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        error: "Insufficient permissions",
        request_id: getRequestId(req),
      });
      return;
    }

    next();
  };
};
