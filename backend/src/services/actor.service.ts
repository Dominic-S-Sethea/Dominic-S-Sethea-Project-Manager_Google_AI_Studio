
import { createHash, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { redact } from "./redaction.service.ts";

export type ActorType =
  | "user"
  | "agent"
  | "system"
  | "automation"
  | "anonymous";

export interface Actor {
  actor_type: ActorType;
  actor_id: string;
  actor_display?: string;
  session_id?: string;
  on_behalf_of?: string;
  api_key_fingerprint?: string;
}

interface RequestActorUser {
  user_id: string;
  email?: string;
  role?: string;
}

interface RequestActorAgent {
  agent_id: string;
}

interface InternalServiceActor {
  actor_type: "system" | "automation";
  actor_id: string;
}

interface RequestWithActors extends Request {
  user?: RequestActorUser;
  agent?: RequestActorAgent;
  request_id?: string;
  service_actor?: InternalServiceActor;
}

export class ServiceError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code = "REQUEST_FAILED",
    details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isSafeRequestId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

/**
 * Resolves a server-authenticated actor. Actor identity is never taken from
 * req.body, query parameters, or arbitrary client-supplied actor fields.
 */
export function resolveActor(req: Request): Actor {
  const request = req as RequestWithActors;

  if (request.service_actor) {
    return {
      actor_type: request.service_actor.actor_type,
      actor_id: request.service_actor.actor_id,
    };
  }

  if (
    request.agent &&
    typeof request.agent.agent_id === "string" &&
    request.agent.agent_id.length > 0
  ) {
    const authorization = req.headers.authorization ?? "";
    const key = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    return {
      actor_type: "agent",
      actor_id: request.agent.agent_id,
      ...(key ? { api_key_fingerprint: fingerprintKey(key) } : {}),
    };
  }

  if (
    request.user &&
    typeof request.user.user_id === "string" &&
    request.user.user_id.length > 0
  ) {
    return {
      actor_type: "user",
      actor_id: request.user.user_id,
    };
  }

  return {
    actor_type: "anonymous",
    actor_id: "anonymous",
  };
}

/**
 * Returns a validated request identifier, preferring an identifier already
 * assigned by trusted middleware and then a bounded, sanitized client
 * correlation header. A new UUID is generated otherwise.
 */
export function getRequestId(req: Request): string {
  const request = req as RequestWithActors;

  if (
    typeof request.request_id === "string" &&
    isSafeRequestId(request.request_id)
  ) {
    return request.request_id;
  }

  const header = req.headers["x-request-id"];
  if (typeof header === "string" && isSafeRequestId(header)) {
    request.request_id = header;
    return header;
  }

  const requestId = randomUUID();
  request.request_id = requestId;
  return requestId;
}

/**
 * Fingerprints an API key without exposing or storing the key itself.
 */
export function fingerprintKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex").slice(0, 12);
}

export function sendSafeError(
  req: Request,
  res: Response,
  error: unknown,
  fallbackMessage = "Request could not be completed",
): void {
  const requestId = getRequestId(req);

  if (error instanceof ServiceError) {
    const body: Record<string, unknown> = {
      error: error.message,
      code: error.code,
      request_id: requestId,
    };

    if (typeof error.details !== "undefined") {
      body.details = redact(error.details);
    }

    res.status(error.statusCode).json(body);
    return;
  }

  // Diagnostics are redacted before logging; the API never receives SQL,
  // paths, provider responses, secrets, or stack traces.
  console.error("PM-P7-03 request failure", {
    request_id: requestId,
    error: redact(error),
  });

  res.status(500).json({
    error: fallbackMessage,
    code: "INTERNAL_ERROR",
    request_id: requestId,
  });
}
