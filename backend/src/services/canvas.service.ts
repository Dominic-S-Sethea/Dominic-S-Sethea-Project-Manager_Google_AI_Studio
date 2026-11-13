import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

// --- Types ---

export interface Canvas {
  canvas_id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasConnection {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

export interface CanvasWithItems extends Canvas {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

type CanvasServiceStatus = 400 | 404;

export class CanvasServiceError extends Error {
  public readonly statusCode: CanvasServiceStatus;

  constructor(statusCode: CanvasServiceStatus, message: string) {
    super(message);
    this.name = "CanvasServiceError";
    this.statusCode = statusCode;
  }
}

interface CanvasDbRow {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CanvasItemDbRow {
  item_id: string;
  canvas_id: string;
  item_type: string;
  task_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string | null;
  style: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

interface CanvasConnectionDbRow {
  connection_id: string;
  canvas_id: string;
  from_item_id: string;
  to_item_id: string;
  connection_type: string;
  style: string | null;
  created_at: string;
}

interface TaskProjectRow {
  project_id: string;
}

interface CanvasItemInput {
  item_type: string;
  task_id?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  content?: string | null;
  style?: string | null;
  z_index?: number;
}

interface CanvasItemUpdates {
  item_type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  content?: string | null;
  style?: string | null;
  z_index?: number;
  task_id?: string | null;
}

interface CanvasConnectionUpdates {
  connection_type?: string;
  style?: string | null;
}

const SUPPORTED_ITEM_TYPES = new Set([
  "square",
  "rectangle",
  "circle",
  "diamond",
  "triangle",
  "text",
  "task",
  "line",
  "arrow",
]);

// --- Validation and internal helpers ---

function badRequest(message: string): never {
  throw new CanvasServiceError(400, message);
}

function notFound(message: string): never {
  throw new CanvasServiceError(404, message);
}

function validateNonEmptyString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    badRequest(`${fieldName} is required`);
  }

  return value;
}

function validateNullableString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === null) return null;

  if (typeof value !== "string") {
    badRequest(`${fieldName} must be a string or null`);
  }

  return value;
}

function validateFiniteNumber(
  value: unknown,
  fieldName: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    badRequest(`${fieldName} must be a finite number`);
  }

  return value;
}

function validateItemType(itemType: unknown): string {
  if (
    typeof itemType !== "string" ||
    !SUPPORTED_ITEM_TYPES.has(itemType)
  ) {
    badRequest("Unsupported canvas item type");
  }

  return itemType;
}

function validateConnectionType(value: unknown): "line" | "arrow" {
  if (value !== "line" && value !== "arrow") {
    badRequest('connection_type must be "line" or "arrow"');
  }

  return value;
}

function validateTaskLink(
  canvas: Canvas,
  taskId: string | null | undefined,
): void {
  if (taskId === undefined || taskId === null) return;

  if (typeof taskId !== "string" || !taskId.trim()) {
    badRequest("task_id must be a non-empty string or null");
  }

  const db = getDb();
  const task = db
    .prepare("SELECT project_id FROM tasks WHERE task_id = ?")
    .get(taskId) as TaskProjectRow | undefined;

  if (!task) {
    badRequest("Task does not exist");
  }

  if (task.project_id !== canvas.project_id) {
    badRequest("Task must belong to the same project as the canvas");
  }
}

function getCanvasOrThrow(canvasId: string): Canvas {
  const canvas = getCanvasById(canvasId);

  if (!canvas) {
    notFound("Canvas not found");
  }

  return canvas;
}

function getCanvasItemOrThrow(itemId: string): CanvasItem {
  const item = getCanvasItemById(itemId);

  if (!item) {
    notFound("Canvas item not found");
  }

  return item;
}

function getCanvasConnectionOrThrow(
  connectionId: string,
): CanvasConnection {
  const connection = getCanvasConnectionById(connectionId);

  if (!connection) {
    notFound("Canvas connection not found");
  }

  return connection;
}

function assertItemBelongsToCanvas(
  itemId: string,
  canvasId: string,
): CanvasItem {
  const item = getCanvasItemOrThrow(itemId);

  if (item.canvas_id !== canvasId) {
    badRequest("Both connection items must belong to the requested canvas");
  }

  return item;
}

function assertConnectionBelongsToCanvas(
  connectionId: string,
  canvasId: string,
): CanvasConnection {
  const connection = getCanvasConnectionOrThrow(connectionId);

  if (connection.canvas_id !== canvasId) {
    badRequest("Connection does not belong to the requested canvas");
  }

  return connection;
}

// --- Canvas operations ---

export function createCanvas(
  projectId: string,
  name: string,
  description: string | null,
  createdBy: string,
): Canvas {
  validateNonEmptyString(projectId, "project_id");
  validateNonEmptyString(name, "name");
  validateNonEmptyString(createdBy, "created_by");

  const db = getDb();
  const project = db
    .prepare("SELECT project_id FROM projects WHERE project_id = ?")
    .get(projectId);

  if (!project) {
    notFound("Project not found");
  }

  const now = new Date().toISOString();
  const canvasId = randomUUID();

  db.prepare(
    `INSERT INTO canvases
      (canvas_id, project_id, name, description, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    canvasId,
    projectId,
    name,
    validateNullableString(description, "description"),
    createdBy,
    now,
    now,
  );

  return getCanvasOrThrow(canvasId);
}

export function getCanvasById(canvasId: string): Canvas | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM canvases WHERE canvas_id = ?")
    .get(canvasId) as CanvasDbRow | undefined;

  return row ? mapCanvas(row) : null;
}

export function getCanvasWithItems(
  canvasId: string,
): CanvasWithItems | null {
  const db = getDb();
  const canvas = getCanvasById(canvasId);

  if (!canvas) return null;

  const items = db
    .prepare(
      `SELECT * FROM canvas_items
       WHERE canvas_id = ?
       ORDER BY z_index ASC`,
    )
    .all(canvasId) as unknown as CanvasItemDbRow[];

  const connections = db
    .prepare(
      "SELECT * FROM canvas_connections WHERE canvas_id = ?",
    )
    .all(canvasId) as unknown as CanvasConnectionDbRow[];

  return {
    ...canvas,
    items: items.map(mapCanvasItem),
    connections: connections.map(mapCanvasConnection),
  };
}

/**
 * With a project ID, return only that project's canvases.
 *
 * A null project ID retains the old service behavior and returns all canvases.
 * The Canvas routes must filter that result by project membership and omit
 * legacy canvases whose project_id is NULL.
 */
export function listCanvases(projectId: string | null): Canvas[] {
  const db = getDb();

  const rows = projectId
    ? db
        .prepare(
          `SELECT * FROM canvases
           WHERE project_id = ?
           ORDER BY updated_at DESC`,
        )
        .all(projectId)
    : db
        .prepare(
          "SELECT * FROM canvases ORDER BY updated_at DESC",
        )
        .all();

  return (rows as unknown as CanvasDbRow[]).map(mapCanvas);
}

export function updateCanvas(
  canvasId: string,
  updates: { name?: string; description?: string | null },
): Canvas | null {
  const db = getDb();
  const existing = getCanvasById(canvasId);

  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(validateNonEmptyString(updates.name, "name"));
  }

  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(
      validateNullableString(updates.description, "description"),
    );
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(canvasId);

  db.prepare(
    `UPDATE canvases
     SET ${fields.join(", ")}
     WHERE canvas_id = ?`,
  ).run(...values);

  return getCanvasById(canvasId);
}

export function deleteCanvas(canvasId: string): boolean {
  const db = getDb();
  const existingCanvas = getCanvasById(canvasId);

  if (!existingCanvas) return false;

  // The row is deleted below, so this timestamp bump is necessarily
  // transient and cannot affect subsequent CanvasList ordering.
  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(new Date().toISOString(), canvasId);

  const items = db
    .prepare("SELECT item_id FROM canvas_items WHERE canvas_id = ?")
    .all(canvasId) as unknown as Array<{ item_id: string }>;

  // Preserve the existing cleanup behavior: remove every connection
  // involving a canvas item before deleting the items and canvas.
  for (const item of items) {
    db.prepare(
      `DELETE FROM canvas_connections
       WHERE from_item_id = ? OR to_item_id = ?`,
    ).run(item.item_id, item.item_id);
  }

  db.prepare(
    "DELETE FROM canvas_items WHERE canvas_id = ?",
  ).run(canvasId);

  const result = db
    .prepare("DELETE FROM canvases WHERE canvas_id = ?")
    .run(canvasId);

  return result.changes > 0;
}

// --- Items ---

export function addItem(
  canvasId: string,
  item: CanvasItemInput,
): CanvasItem {
  const canvas = getCanvasOrThrow(canvasId);
  const db = getDb();

  const itemType = validateItemType(item.item_type);
  validateTaskLink(canvas, item.task_id);

  const x =
    item.x === undefined ? 0 : validateFiniteNumber(item.x, "x");
  const y =
    item.y === undefined ? 0 : validateFiniteNumber(item.y, "y");
  const width =
    item.width === undefined
      ? 100
      : validateFiniteNumber(item.width, "width");
  const height =
    item.height === undefined
      ? 100
      : validateFiniteNumber(item.height, "height");
  const rotation =
    item.rotation === undefined
      ? 0
      : validateFiniteNumber(item.rotation, "rotation");
  const zIndex =
    item.z_index === undefined
      ? 0
      : validateFiniteNumber(item.z_index, "z_index");

  if (width <= 0 || height <= 0) {
    badRequest("Canvas item width and height must be greater than zero");
  }

  if (!Number.isInteger(zIndex)) {
    badRequest("z_index must be an integer");
  }

  const content =
    item.content === undefined
      ? null
      : validateNullableString(item.content, "content");
  const style =
    item.style === undefined
      ? null
      : validateNullableString(item.style, "style");

  const now = new Date().toISOString();
  const itemId = randomUUID();

  db.prepare(
    `INSERT INTO canvas_items
      (item_id, canvas_id, item_type, task_id, x, y, width, height,
       rotation, content, style, z_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    canvasId,
    itemType,
    item.task_id ?? null,
    x,
    y,
    width,
    height,
    rotation,
    content,
    style,
    zIndex,
    now,
    now,
  );

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvasId);

  return getCanvasItemOrThrow(itemId);
}

export function getCanvasItemById(itemId: string): CanvasItem | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM canvas_items WHERE item_id = ?")
    .get(itemId) as CanvasItemDbRow | undefined;

  return row ? mapCanvasItem(row) : null;
}

export function updateItem(
  itemId: string,
  updates: CanvasItemUpdates,
): CanvasItem | null {
  const db = getDb();
  const existingItem = getCanvasItemById(itemId);

  if (!existingItem) return null;

  // Resolve the item's parent canvas before validating task links. The route
  // separately authorizes access against this exact parent canvas.
  const canvas = getCanvasOrThrow(existingItem.canvas_id);

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.item_type !== undefined) {
    fields.push("item_type = ?");
    values.push(validateItemType(updates.item_type));
  }

  if (updates.x !== undefined) {
    fields.push("x = ?");
    values.push(validateFiniteNumber(updates.x, "x"));
  }

  if (updates.y !== undefined) {
    fields.push("y = ?");
    values.push(validateFiniteNumber(updates.y, "y"));
  }

  if (updates.width !== undefined) {
    const width = validateFiniteNumber(updates.width, "width");
    if (width <= 0) {
      badRequest("Canvas item width must be greater than zero");
    }
    fields.push("width = ?");
    values.push(width);
  }

  if (updates.height !== undefined) {
    const height = validateFiniteNumber(updates.height, "height");
    if (height <= 0) {
      badRequest("Canvas item height must be greater than zero");
    }
    fields.push("height = ?");
    values.push(height);
  }

  if (updates.rotation !== undefined) {
    fields.push("rotation = ?");
    values.push(validateFiniteNumber(updates.rotation, "rotation"));
  }

  if (updates.content !== undefined) {
    fields.push("content = ?");
    values.push(validateNullableString(updates.content, "content"));
  }

  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(validateNullableString(updates.style, "style"));
  }

  if (updates.z_index !== undefined) {
    const zIndex = validateFiniteNumber(updates.z_index, "z_index");

    if (!Number.isInteger(zIndex)) {
      badRequest("z_index must be an integer");
    }

    fields.push("z_index = ?");
    values.push(zIndex);
  }

  if (updates.task_id !== undefined) {
    validateTaskLink(canvas, updates.task_id);
    fields.push("task_id = ?");
    values.push(updates.task_id);
  }

  if (fields.length === 0) return existingItem;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(now);
  values.push(itemId);

  db.prepare(
    `UPDATE canvas_items
     SET ${fields.join(", ")}
     WHERE item_id = ?`,
  ).run(...values);

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvas.canvas_id);

  return getCanvasItemById(itemId);
}

export function deleteItem(itemId: string): boolean {
  const db = getDb();
  const existingItem = getCanvasItemById(itemId);

  if (!existingItem) return false;

  // Delete connections involving this item before deleting the item.
  db.prepare(
    `DELETE FROM canvas_connections
     WHERE from_item_id = ? OR to_item_id = ?`,
  ).run(itemId, itemId);

  const result = db
    .prepare("DELETE FROM canvas_items WHERE item_id = ?")
    .run(itemId);

  if (result.changes > 0) {
    db.prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    ).run(new Date().toISOString(), existingItem.canvas_id);
  }

  return result.changes > 0;
}

// --- Connections ---

export function addConnection(
  canvasId: string,
  fromItemId: string,
  toItemId: string,
  connectionType = "line",
  style: string | null = null,
): CanvasConnection {
  getCanvasOrThrow(canvasId);

  validateNonEmptyString(fromItemId, "from_item_id");
  validateNonEmptyString(toItemId, "to_item_id");
  validateConnectionType(connectionType);
  validateNullableString(style, "style");

  if (fromItemId === toItemId) {
    badRequest("A canvas item cannot be connected to itself");
  }

  assertItemBelongsToCanvas(fromItemId, canvasId);
  assertItemBelongsToCanvas(toItemId, canvasId);

  const db = getDb();
  const duplicate = db
    .prepare(
      `SELECT connection_id
       FROM canvas_connections
       WHERE canvas_id = ?
         AND from_item_id = ?
         AND to_item_id = ?
       LIMIT 1`,
    )
    .get(canvasId, fromItemId, toItemId);

  if (duplicate) {
    badRequest("A connection already exists between these items");
  }

  const now = new Date().toISOString();
  const connectionId = randomUUID();

  db.prepare(
    `INSERT INTO canvas_connections
      (connection_id, canvas_id, from_item_id, to_item_id,
       connection_type, style, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    connectionId,
    canvasId,
    fromItemId,
    toItemId,
    connectionType,
    style,
    now,
  );

  db.prepare(
    "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
  ).run(now, canvasId);

  return getCanvasConnectionOrThrow(connectionId);
}

export function getCanvasConnectionById(
  connId: string,
): CanvasConnection | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM canvas_connections WHERE connection_id = ?",
    )
    .get(connId) as CanvasConnectionDbRow | undefined;

  return row ? mapCanvasConnection(row) : null;
}

export function updateConnection(
  connId: string,
  updates: CanvasConnectionUpdates,
): CanvasConnection | null {
  const existing = getCanvasConnectionById(connId);

  if (!existing) return null;

  assertConnectionBelongsToCanvas(connId, existing.canvas_id);

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.connection_type !== undefined) {
    fields.push("connection_type = ?");
    values.push(validateConnectionType(updates.connection_type));
  }

  if (updates.style !== undefined) {
    fields.push("style = ?");
    values.push(validateNullableString(updates.style, "style"));
  }

  if (fields.length === 0) {
    return existing;
  }

  const now = new Date().toISOString();
  values.push(connId);

  getDb()
    .prepare(
      `UPDATE canvas_connections
       SET ${fields.join(", ")}
       WHERE connection_id = ?`,
    )
    .run(...values);

  getDb()
    .prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    )
    .run(now, existing.canvas_id);

  return getCanvasConnectionOrThrow(connId);
}

export function deleteConnection(connId: string): boolean {
  const existing = getCanvasConnectionById(connId);

  if (!existing) return false;

  // Keep the connection ownership assertion in the deletion path so this
  // helper remains the single place where connection-to-canvas scope is
  // checked inside the service.
  assertConnectionBelongsToCanvas(connId, existing.canvas_id);

  const db = getDb();
  const result = db
    .prepare(
      "DELETE FROM canvas_connections WHERE connection_id = ?",
    )
    .run(connId);

  if (result.changes > 0) {
    db.prepare(
      "UPDATE canvases SET updated_at = ? WHERE canvas_id = ?",
    ).run(new Date().toISOString(), existing.canvas_id);
  }

  return result.changes > 0;
}

// --- Mappers ---

function mapCanvas(row: CanvasDbRow): Canvas {
  return {
    canvas_id: row.canvas_id,

    // Existing databases may still contain legacy NULL project_id rows.
    // An empty string keeps the new TypeScript contract non-nullable; routes
    // treat an empty project_id as unscoped and return 404 for those records.
    project_id: row.project_id ?? "",

    name: row.name,
    description: row.description,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasItem(row: CanvasItemDbRow): CanvasItem {
  return {
    item_id: row.item_id,
    canvas_id: row.canvas_id,
    item_type: row.item_type,
    task_id: row.task_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    content: row.content,
    style: row.style,
    z_index: row.z_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCanvasConnection(
  row: CanvasConnectionDbRow,
): CanvasConnection {
  return {
    connection_id: row.connection_id,
    canvas_id: row.canvas_id,
    from_item_id: row.from_item_id,
    to_item_id: row.to_item_id,
    connection_type: row.connection_type,
    style: row.style,
    created_at: row.created_at,
  };
}
