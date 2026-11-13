import type { Request, Response } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";
import { record } from "./audit.service.ts";

const db = getDb();

const validRoles: readonly string[] = ["admin", "editor", "viewer"];

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export const registerAgent = async (req: Request, res: Response) => {
  try {
    const body =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};

    const apiKey = body.apiKey;
    const role = body.role ?? "viewer";

    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return res.status(400).json({ message: "API key is required" });
    }

    if (typeof role !== "string" || !validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Valid roles: ${validRoles.join(", ")}`,
      });
    }

    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const existing = db.prepare(
      "SELECT agent_id FROM agents WHERE api_key_hash = ?"
    ).get(apiKeyHash) as { agent_id: string } | undefined;

    if (existing) {
      return res.status(409).json({ message: "Agent with this API key already exists" });
    }

    const agentId = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // These fields are NOT NULL in agents. Keep the existing API-key/role request
    // contract while allowing callers to supply descriptive metadata when available.
    const name = stringOrDefault(body.name, "Registered Agent");
    const provider = stringOrDefault(body.provider, "unspecified");
    const model = stringOrDefault(body.model, "unspecified");
    const permissions =
      JSON.stringify(Array.isArray(body.permissions) ? body.permissions : []) ?? "[]";

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `INSERT INTO agents (
          agent_id, name, role, api_key_hash, provider, model, permissions,
          status, created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
      ).run(
        agentId,
        name,
        role,
        apiKeyHash,
        provider,
        model,
        permissions,
        now,
        now,
        expiresAt,
      );

      db.prepare(
        `INSERT INTO agent_tokens (token_hash, agent_id, role, expires_at)
         VALUES (?, ?, ?, ?)`
      ).run(tokenHash, agentId, role, expiresAt);

      record({
        actor: { actor_type: "agent", actor_id: agentId },
        project_id: null,
        action: "agent.registered",
        target_table: "agents",
        target_id: agentId,
        new_value: { agent_id: agentId, name, role, provider, model },
        trigger: "api",
      });

      db.exec("COMMIT");
    } catch (transactionError) {
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        console.error("Agent registration rollback error:", rollbackError);
      }
      throw transactionError;
    }

    return res.status(201).json({
      agent_id: agentId,
      api_key: apiKey,
      token,
      expires_at: expiresAt,
    });
  } catch (err: unknown) {
    console.error("Agent registration error:", err);
    return res.status(500).json({ message: "Agent registration failed" });
  }
};
