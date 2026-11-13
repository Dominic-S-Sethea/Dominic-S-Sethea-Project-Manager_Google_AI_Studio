import type { DatabaseSync } from "node:sqlite";
import { getProjectAccess, projectExists } from "./projectAccess.service.ts";
import {
  AUTOMATION_EVENT_TYPES,
  isPlainObject,
  newEventId,
  normalizeJson,
  withPreview,
  type EventEnvelope,
} from "./outbox.service.ts";

export type ServiceResult<T> = { status: number; body: T };

function rollback(db: DatabaseSync): void {
  try { db.exec("ROLLBACK"); } catch { /* retain original failure */ }
}

export async function ingestEvent(
  db: DatabaseSync,
  userId: string,
  input: unknown,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!isPlainObject(input)) return { status: 400, body: { message: "Invalid event envelope" } };
  const envelope = input as unknown as Partial<EventEnvelope>;
  if (typeof envelope.project_id !== "string" || !envelope.project_id.trim()) {
    return { status: 400, body: { message: "project_id is required" } };
  }
  if (typeof envelope.delivery_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.delivery_id)) {
    return { status: 400, body: { message: "delivery_id must be a UUID v4" } };
  }
  if (typeof envelope.event_type !== "string" || !AUTOMATION_EVENT_TYPES.has(envelope.event_type)) {
    return { status: 400, body: { message: "Unsupported event_type" } };
  }
  if (!isPlainObject(envelope.payload)) return { status: 400, body: { message: "payload must be an object" } };

  let payload: string;
  try { payload = withPreview(envelope.payload); }
  catch { return { status: 400, body: { message: "payload must contain JSON values" } }; }

  db.exec("BEGIN IMMEDIATE");
  try {
    if (!projectExists(envelope.project_id)) {
      rollback(db);
      return { status: 404, body: { message: "Project not found" } };
    }
    const access = await getProjectAccess(envelope.project_id, userId);
    if (!access?.canWrite) {
      rollback(db);
      return { status: 403, body: { message: "Project write access required" } };
    }

    const existing = db.prepare(
      `SELECT o.event_id, o.event_type, e.project_id, e.payload
       FROM outbox o JOIN event e ON e.event_id = o.event_id
       WHERE o.delivery_id = ?`,
    ).get(envelope.delivery_id) as {
      event_id: string; event_type: string; project_id: string; payload: string;
    } | undefined;

    if (existing) {
      const same = existing.project_id === envelope.project_id &&
        existing.event_type === envelope.event_type && existing.payload === payload;
      rollback(db);
      if (same) return { status: 202, body: { event_id: existing.event_id, accepted: true, duplicate: true } };
      return { status: 409, body: { message: "delivery_id conflict" } };
    }

    const eventId = newEventId();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO event (event_id, project_id, payload, created_at) VALUES (?, ?, ?, ?)",
    ).run(eventId, envelope.project_id, payload, now);
    db.prepare(
      `INSERT INTO outbox
       (delivery_id, event_id, event_type, payload, received_at, status, preview, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 1, ?)`,
    ).run(envelope.delivery_id, eventId, envelope.event_type, payload, now, now);
    db.exec("COMMIT");
    return { status: 202, body: { event_id: eventId, accepted: true, duplicate: false } };
  } catch (error) {
    rollback(db);
    throw error;
  }
}

export function normalizeEventPayload(value: Record<string, unknown>): string {
  return normalizeJson(value);
}

