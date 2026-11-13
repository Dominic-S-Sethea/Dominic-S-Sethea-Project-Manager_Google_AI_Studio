
import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { getDb } from "../database/index.ts";
import {
  requireAuth,
  type AuthRequest,
} from "./auth.middleware.ts";
import { getRequestId } from "../services/actor.service.ts";

export interface AgentUser {
  agent_id: string;
  role: string;
  status: string;
  created_at: string;
  permissions: string;
  expires_at: string | null;
}

interface RequestWithAgent extends AuthRequest {
  agent?: AgentUser;
}

function readAgentByToken(token: string): AgentUser | undefined {
  const hash = createHash("sha256").update(token).digest("hex");

  return getDb()
    .prepare(
      `SELECT agent_id, role, status, created_at, permissions, expires_at
       FROM agents
       WHERE api_key_hash = ?`,
    )
    .get(hash) as AgentUser | undefined;
}

function validateAgent(
  agent: AgentUser | undefined,
): { agent: AgentUser | null; statusCode: number } {
  if (!agent) return { agent: null, statusCode: 401 };

  if (agent.status !== "active") {
    return { agent: null, statusCode: 403 };
  }

  if (
    agent.expires_at &&
    Number.isFinite(Date.parse(agent.expires_at)) &&
    Date.parse(agent.expires_at) <= Date.now()
  ) {
    return { agent: null, statusCode: 403 };
  }

  return { agent, statusCode: 200 };
}

export const verifyAgentAuth = (
  req: RequestWithAgent,
  res: Response,
  next: NextFunction,
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing or invalid agent token",
      request_id: getRequestId(req),
    });
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({
      error: "Invalid agent credentials",
      request_id: getRequestId(req),
    });
    return;
  }

  try {
    const validation = validateAgent(readAgentByToken(token));

    if (!validation.agent) {
      res.status(validation.statusCode).json({
        error:
          validation.statusCode === 403
            ? "Agent account is inactive or expired"
            : "Invalid agent credentials",
        request_id: getRequestId(req),
      });
      return;
    }

    req.agent = validation.agent;
    getRequestId(req);
    next();
  } catch {
    res.status(401).json({
      error: "Agent authentication failed",
      request_id: getRequestId(req),
    });
  }
};

/**
 * Authentication for project-scoped Automation and connector APIs.
 *
 * A matching active agent API key is accepted. Otherwise the request is
 * processed through the existing user JWT middleware. Authorization is then
 * performed by projectAccess.service.ts. The agent's legacy permissions JSON
 * is not trusted unless it contains a server-signed project grant.
 */
export const requireUserOrAgent = (
  req: RequestWithAgent,
  res: Response,
  next: NextFunction,
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Authentication is required",
      request_id: getRequestId(req),
    });
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({
      error: "Authentication is required",
      request_id: getRequestId(req),
    });
    return;
  }

  try {
    const found = readAgentByToken(token);

    if (found) {
      const validation = validateAgent(found);

      if (!validation.agent) {
        res.status(validation.statusCode).json({
          error: "Agent account is inactive or expired",
          request_id: getRequestId(req),
        });
        return;
      }

      req.agent = validation.agent;
      getRequestId(req);
      next();
      return;
    }
  } catch {
    // Continue to JWT verification. No database or token details are exposed.
  }

  requireAuth(req, res, next);
};

export const verifyAgentRole = (...allowedRoles: string[]) => {
  return (
    req: RequestWithAgent,
    res: Response,
    next: NextFunction,
  ): void => {
    const agent = req.agent;

    if (!agent) {
      res.status(401).json({
        error: "Agent not authenticated",
        request_id: getRequestId(req),
      });
      return;
    }

    if (!allowedRoles.includes(agent.role)) {
      res.status(403).json({
        error: "Insufficient agent permissions",
        request_id: getRequestId(req),
      });
      return;
    }

    next();
  };
};
