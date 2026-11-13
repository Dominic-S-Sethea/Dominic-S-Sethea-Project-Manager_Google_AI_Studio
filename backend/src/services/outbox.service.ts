import { randomUUID } from "node:crypto";

export const AUTOMATION_EVENT_TYPES = new Set([
  "task.created",
  "task.updated",
  "project.updated",
  "workflow.run",
]);

export interface EventEnvelope {
  project_id: string;
  delivery_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Stable JSON representation: object keys sorted recursively; array order retained. */
export function normalizeJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (isPlainObject(input)) {
      const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(input).sort()) result[key] = normalize(input[key]);
      return result;
    }
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    throw new TypeError("Payload must contain only JSON values");
  };
  return JSON.stringify(normalize(value));
}

export function withPreview(payload: Record<string, unknown>): string {
  const parsed = JSON.parse(normalizeJson(payload)) as Record<string, unknown>;
  parsed.preview = true;
  return normalizeJson(parsed);
}

export function newEventId(): string {
  return randomUUID();
}

export function newTraceId(): string {
  return randomUUID();
}

