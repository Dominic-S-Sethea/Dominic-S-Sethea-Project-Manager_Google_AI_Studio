import type { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getDb } from "../database/index.ts";

const db = getDb();

export const loginAgent = async (req: Request, res: Response) => {
  try {
    const { apiKey, role } = req.body;
    if (!apiKey) {
      return res.status(400).json({ message: "API key is required" });
    }

    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const agent = db.prepare(
      `SELECT a.agent_id, a.role, a.status, a.created_at
       FROM agents a WHERE a.api_key_hash = ? AND a.status = 'active'`
    ).get(apiKeyHash) as { agent_id: string; role: string; status: string; created_at: string } | undefined;

    if (!agent) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    if (role && agent.role !== role) {
      return res.status(403).json({ message: `Agent role mismatch. Expected: ${role}, Got: ${agent.role}` });
    }

    const token = jwt.sign(
      {
        agent_id: agent.agent_id,
        role: agent.role,
        type: "agent",
      },
      process.env.JWT_SECRET || "project-manager-jwt-secret",
      { expiresIn: "7d" }
    );

    return res.json({
      agent: {
        agent_id: agent.agent_id,
        role: agent.role,
        status: agent.status,
        created_at: agent.created_at,
      },
      token,
      token_type: "Bearer",
      expires_in: "7d",
    });
  } catch (err: any) {
    console.error("Agent login error:", err);
    return res.status(500).json({ message: "Agent login failed" });
  }
};
