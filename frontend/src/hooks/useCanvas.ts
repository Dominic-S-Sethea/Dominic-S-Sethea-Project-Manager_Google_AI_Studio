import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CanvasItem,
  CanvasConnection,
  CanvasWithItems,
  CanvasTool,
} from "../types/canvas";
import type { Task } from "../types";
import { getToken } from "./useAuth";

export interface PanPoint {
  x: number;
  y: number;
}

type ConnectionUpdates = Partial<
  Pick<CanvasConnection, "connection_type" | "style">
>;

interface ApiError extends Error {
  status?: number;
}

interface UseCanvasReturn {
  canvas: CanvasWithItems | null;
  canvasId: string | null;
  items: CanvasItem[];
  connections: CanvasConnection[];
  selectedItemId: string | null;
  selectedConnectionId: string | null;
  tool: CanvasTool;
  pan: PanPoint;
  zoom: number;
  loading: boolean;
  error: string | null;
  tasks: Task[];
  enteringItemIds: Set<string>;
  deletingItemIds: Set<string>;
  pendingItemIds: Set<string>;
  failedItemIds: Set<string>;
  refetchTasks: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setConnections: React.Dispatch<
    React.SetStateAction<CanvasConnection[]>
  >;
  addItem: (
    item: Partial<CanvasItem> & {
      item_type: CanvasItem["item_type"];
    },
  ) => Promise<CanvasItem | null>;
  updateItem: (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => Promise<CanvasItem | null>;
  updateItemLocal: (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => void;
  deleteItem: (itemId: string) => Promise<void>;
  addConnection: (
    fromItemId: string,
    toItemId: string,
    connectionType?: "line" | "arrow",
    style?: string | null,
  ) => Promise<CanvasConnection | null>;
  updateConnection: (
    connectionId: string,
    updates: ConnectionUpdates,
  ) => Promise<CanvasConnection | null>;
  deleteConnection: (connectionId: string) => Promise<void>;
  selectItem: (itemId: string | null) => void;
  selectConnection: (connectionId: string | null) => void;
  setTool: (tool: CanvasTool) => void;
  setPan: (pan: PanPoint) => void;
  setZoom: (zoom: number) => void;
  saveItem: (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => Promise<CanvasItem | null>;
  clearError: () => void;
  refetch: () => Promise<void>;
}

function authHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const token = getToken();

  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getErrorMessage(
  body: unknown,
  fallback: string,
): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string" &&
    body.error.trim()
  ) {
    return body.error;
  }

  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }

  return fallback;
}

async function getResponseError(
  response: Response,
  fallback: string,
): Promise<ApiError> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // The response may not contain JSON. Preserve the status-based fallback.
  }

  const error = new Error(
    getErrorMessage(body, fallback),
  ) as ApiError;

  error.status = response.status;
  return error;
}

function isRetryableError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return (
      error.status === 429 ||
      (error.status >= 500 && error.status <= 599)
    );
  }

  // Fetch network failures are normally TypeErrors. Unknown transport
  // failures are treated as transient, while HTTP errors are not.
  return error instanceof TypeError;
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function readViewport(
  canvasId: string,
): { pan: PanPoint; zoom: number } | null {
  try {
    const raw = window.localStorage.getItem(
      `pm-canvas-view-${canvasId}`,
    );

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("pan" in parsed) ||
      !("zoom" in parsed)
    ) {
      return null;
    }

    const savedPan = parsed.pan;
    const savedZoom = parsed.zoom;

    if (
      savedPan === null ||
      typeof savedPan !== "object" ||
      !("x" in savedPan) ||
      !("y" in savedPan) ||
      typeof savedPan.x !== "number" ||
      typeof savedPan.y !== "number" ||
      !Number.isFinite(savedPan.x) ||
      !Number.isFinite(savedPan.y) ||
      typeof savedZoom !== "number" ||
      !Number.isFinite(savedZoom) ||
      savedZoom < 0.2 ||
      savedZoom > 4
    ) {
      return null;
    }

    return {
      pan: { x: savedPan.x, y: savedPan.y },
      zoom: savedZoom,
    };
  } catch {
    return null;
  }
}

export function useCanvas(
  canvasId: string | undefined,
): UseCanvasReturn {
  const [canvas, setCanvas] =
    useState<CanvasWithItems | null>(null);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [connections, setConnections] =
    useState<CanvasConnection[]>([]);
  const [selectedItemId, setSelectedItemId] =
    useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] =
    useState<string | null>(null);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [enteringItemIds, setEnteringItemIds] =
    useState<Set<string>>(new Set());
  const [deletingItemIds, setDeletingItemIds] =
    useState<Set<string>>(new Set());
  const [pendingItemIds, setPendingItemIds] =
    useState<Set<string>>(new Set());
  const [failedItemIds, setFailedItemIds] =
    useState<Set<string>>(new Set());

  const lastServerItems = useRef<CanvasItem[]>([]);
  const lastServerConnections =
    useRef<CanvasConnection[]>([]);
  const restoredViewportFor = useRef<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchTasks = useCallback(
    async (projectId: string | null) => {
      if (!projectId) {
        setTasks([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/tasks?project_id=${encodeURIComponent(projectId)}`,
          { headers: authHeaders() },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch tasks");
        }

        const data: { tasks?: Task[] } =
          await response.json();

        setTasks(data.tasks || []);
      } catch {
        setTasks([]);
      }
    },
    [],
  );

  const fetchCanvas = useCallback(async () => {
    if (!canvasId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/canvas/${canvasId}`,
        { headers: authHeaders() },
      );

      if (!response.ok) {
        throw await getResponseError(
          response,
          "Failed to fetch canvas",
        );
      }

      const data: { canvas: CanvasWithItems } =
        await response.json();
      const fetchedCanvas = data.canvas;
      const fetchedItems = fetchedCanvas.items || [];
      const fetchedConnections =
        fetchedCanvas.connections || [];

      setCanvas(fetchedCanvas);
      setItems(fetchedItems);
      setConnections(fetchedConnections);
      lastServerItems.current = fetchedItems;
      lastServerConnections.current = fetchedConnections;

      setPendingItemIds(new Set());
      setFailedItemIds(new Set());

      if (fetchedCanvas.project_id) {
        await fetchTasks(fetchedCanvas.project_id);
      } else {
        setTasks([]);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to fetch canvas",
      );
    } finally {
      setLoading(false);
    }
  }, [canvasId, fetchTasks]);

  useEffect(() => {
    void fetchCanvas();
  }, [fetchCanvas]);

  useEffect(() => {
    if (!canvasId || canvas?.canvas_id !== canvasId) {
      return;
    }

    if (restoredViewportFor.current === canvasId) {
      return;
    }

    restoredViewportFor.current = canvasId;

    const saved = readViewport(canvasId);

    if (saved) {
      setPan(saved.pan);
      setZoom(saved.zoom);
    } else {
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [canvasId, canvas]);

  useEffect(() => {
    if (
      !canvasId ||
      canvas?.canvas_id !== canvasId ||
      restoredViewportFor.current !== canvasId
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `pm-canvas-view-${canvasId}`,
          JSON.stringify({ pan, zoom }),
        );
      } catch {
        // Storage can be unavailable or full; viewport interaction remains usable.
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canvasId, canvas, pan, zoom]);

  const addItem = useCallback(
    async (
      item: Partial<CanvasItem> & {
        item_type: CanvasItem["item_type"];
      },
    ) => {
      if (!canvasId) return null;

      try {
        const response = await fetch(
          `/api/canvas/${canvasId}/items`,
          {
            method: "POST",
            headers: authHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(item),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to add item",
          );
        }

        const data: { item: CanvasItem } =
          await response.json();
        const created = data.item;

        setItems((previous) => [...previous, created]);
        lastServerItems.current = [
          ...lastServerItems.current,
          created,
        ];

        setEnteringItemIds((previous) => {
          const next = new Set(previous);
          next.add(created.item_id);
          return next;
        });

        window.setTimeout(() => {
          setEnteringItemIds((previous) => {
            const next = new Set(previous);
            next.delete(created.item_id);
            return next;
          });
        }, 400);

        return created;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to add item",
        );
        return null;
      }
    },
    [canvasId],
  );

  const updateItemLocal = useCallback(
    (itemId: string, updates: Partial<CanvasItem>) => {
      setItems((previous) =>
        previous.map((item) =>
          item.item_id === itemId
            ? { ...item, ...updates }
            : item,
        ),
      );
    },
    [],
  );

  const removePendingItem = useCallback((itemId: string) => {
    setPendingItemIds((previous) => {
      const next = new Set(previous);
      next.delete(itemId);
      return next;
    });
  }, []);

  const persistItem = useCallback(
    async (
      itemId: string,
      updates: Partial<CanvasItem>,
    ): Promise<CanvasItem | null> => {
      setPendingItemIds((previous) => {
        const next = new Set(previous);
        next.add(itemId);
        return next;
      });

      setFailedItemIds((previous) => {
        const next = new Set(previous);
        next.delete(itemId);
        return next;
      });

      let lastError: unknown = null;
      let updatedItem: CanvasItem | null = null;

      for (let attempt = 0; attempt <= 3; attempt += 1) {
        try {
          const response = await fetch(
            `/api/canvas/items/${itemId}`,
            {
              method: "PUT",
              headers: authHeaders({
                "Content-Type": "application/json",
              }),
              body: JSON.stringify(updates),
            },
          );

          if (!response.ok) {
            throw await getResponseError(
              response,
              "Failed to update item",
            );
          }

          const data: { item: CanvasItem } =
            await response.json();
          updatedItem = data.item;
          break;
        } catch (caught) {
          lastError = caught;
          const status = getErrorStatus(caught);

          if (status === 401 || status === 403) {
            removePendingItem(itemId);
            setFailedItemIds((previous) => {
              const next = new Set(previous);
              next.delete(itemId);
              return next;
            });

            await fetchCanvas();
            setError(
              status === 401
                ? "Your session has expired. Sign in again to save changes."
                : "You no longer have permission to edit this canvas.",
            );
            return null;
          }

          if (status === 404) {
            setItems((previous) =>
              previous.filter(
                (item) => item.item_id !== itemId,
              ),
            );
            setConnections((previous) =>
              previous.filter(
                (connection) =>
                  connection.from_item_id !== itemId &&
                  connection.to_item_id !== itemId,
              ),
            );
            lastServerItems.current =
              lastServerItems.current.filter(
                (item) => item.item_id !== itemId,
              );
            lastServerConnections.current =
              lastServerConnections.current.filter(
                (connection) =>
                  connection.from_item_id !== itemId &&
                  connection.to_item_id !== itemId,
              );
            removePendingItem(itemId);
            setFailedItemIds((previous) => {
              const next = new Set(previous);
              next.delete(itemId);
              return next;
            });
            setError(
              "This canvas item no longer exists. The item was removed.",
            );
            return null;
          }

          if (
            !isRetryableError(caught) ||
            attempt === 3
          ) {
            break;
          }

          await wait(1000 * 2 ** attempt);
        }
      }

      if (updatedItem) {
        setItems((previous) =>
          previous.map((item) =>
            item.item_id === itemId ? updatedItem! : item,
          ),
        );

        lastServerItems.current =
          lastServerItems.current.map((item) =>
            item.item_id === itemId ? updatedItem! : item,
          );

        removePendingItem(itemId);
        setFailedItemIds((previous) => {
          const next = new Set(previous);
          next.delete(itemId);
          return next;
        });

        return updatedItem;
      }

      const serverItem = lastServerItems.current.find(
        (item) => item.item_id === itemId,
      );

      setItems((previous) => {
        if (!serverItem) {
          return previous.filter(
            (item) => item.item_id !== itemId,
          );
        }

        return previous.map((item) =>
          item.item_id === itemId ? serverItem : item,
        );
      });

      removePendingItem(itemId);
      setFailedItemIds((previous) => {
        const next = new Set(previous);
        next.add(itemId);
        return next;
      });

      setError(
        lastError instanceof Error
          ? lastError.message
          : "Failed to update item. Your changes were reverted.",
      );

      return null;
    },
    [fetchCanvas, removePendingItem],
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      updates: Partial<CanvasItem>,
    ) => {
      updateItemLocal(itemId, updates);
      return persistItem(itemId, updates);
    },
    [updateItemLocal, persistItem],
  );

  const saveItem = useCallback(
    async (
      itemId: string,
      updates: Partial<CanvasItem>,
    ) => persistItem(itemId, updates),
    [persistItem],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setDeletingItemIds((previous) => {
        const next = new Set(previous);
        next.add(itemId);
        return next;
      });

      try {
        const response = await fetch(
          `/api/canvas/items/${itemId}`,
          {
            method: "DELETE",
            headers: authHeaders(),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to delete item",
          );
        }
      } catch (caught) {
        setDeletingItemIds((previous) => {
          const next = new Set(previous);
          next.delete(itemId);
          return next;
        });

        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to delete item",
        );
        return;
      }

      await wait(220);

      setItems((previous) =>
        previous.filter((item) => item.item_id !== itemId),
      );
      setConnections((previous) =>
        previous.filter(
          (connection) =>
            connection.from_item_id !== itemId &&
            connection.to_item_id !== itemId,
        ),
      );

      lastServerItems.current =
        lastServerItems.current.filter(
          (item) => item.item_id !== itemId,
        );
      lastServerConnections.current =
        lastServerConnections.current.filter(
          (connection) =>
            connection.from_item_id !== itemId &&
            connection.to_item_id !== itemId,
        );

      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }

      setDeletingItemIds((previous) => {
        const next = new Set(previous);
        next.delete(itemId);
        return next;
      });
    },
    [selectedItemId],
  );

  const addConnection = useCallback(
    async (
      fromItemId: string,
      toItemId: string,
      connectionType: "line" | "arrow" = "line",
      style: string | null = null,
    ) => {
      if (!canvasId) return null;

      if (
        fromItemId === toItemId ||
        connections.some(
          (connection) =>
            connection.from_item_id === fromItemId &&
            connection.to_item_id === toItemId,
        )
      ) {
        setError(
          "A connection between these items already exists or is invalid.",
        );
        return null;
      }

      try {
        const response = await fetch(
          `/api/canvas/${canvasId}/connections`,
          {
            method: "POST",
            headers: authHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              from_item_id: fromItemId,
              to_item_id: toItemId,
              connection_type: connectionType,
              style,
            }),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to add connection",
          );
        }

        const data: { connection: CanvasConnection } =
          await response.json();
        const created = data.connection;

        setConnections((previous) => [
          ...previous,
          created,
        ]);
        lastServerConnections.current = [
          ...lastServerConnections.current,
          created,
        ];

        return created;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to add connection",
        );
        return null;
      }
    },
    [canvasId, connections],
  );

  const updateConnection = useCallback(
    async (
      connectionId: string,
      updates: ConnectionUpdates,
    ): Promise<CanvasConnection | null> => {
      const previousConnection =
        lastServerConnections.current.find(
          (connection) =>
            connection.connection_id === connectionId,
        );

      try {
        const response = await fetch(
          `/api/canvas/connections/${connectionId}`,
          {
            method: "PUT",
            headers: authHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(updates),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to update connection",
          );
        }

        const data: { connection: CanvasConnection } =
          await response.json();
        const updated = data.connection;

        setConnections((previous) =>
          previous.map((connection) =>
            connection.connection_id === connectionId
              ? updated
              : connection,
          ),
        );
        lastServerConnections.current =
          lastServerConnections.current.map((connection) =>
            connection.connection_id === connectionId
              ? updated
              : connection,
          );

        return updated;
      } catch (caught) {
        if (previousConnection) {
          setConnections((previous) =>
            previous.map((connection) =>
              connection.connection_id === connectionId
                ? previousConnection
                : connection,
            ),
          );
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to update connection",
        );
        return null;
      }
    },
    [],
  );

  const deleteConnection = useCallback(
    async (connectionId: string) => {
      try {
        const response = await fetch(
          `/api/canvas/connections/${connectionId}`,
          {
            method: "DELETE",
            headers: authHeaders(),
          },
        );

        if (!response.ok) {
          throw await getResponseError(
            response,
            "Failed to delete connection",
          );
        }

        setConnections((previous) =>
          previous.filter(
            (connection) =>
              connection.connection_id !== connectionId,
          ),
        );
        lastServerConnections.current =
          lastServerConnections.current.filter(
            (connection) =>
              connection.connection_id !== connectionId,
          );

        if (selectedConnectionId === connectionId) {
          setSelectedConnectionId(null);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to delete connection",
        );
      }
    },
    [selectedConnectionId],
  );

  const selectItem = useCallback((itemId: string | null) => {
    setSelectedItemId(itemId);

    if (itemId !== null) {
      setSelectedConnectionId(null);
    }
  }, []);

  const selectConnection = useCallback(
    (connectionId: string | null) => {
      setSelectedConnectionId(connectionId);

      if (connectionId !== null) {
        setSelectedItemId(null);
      }
    },
    [],
  );

  const refetch = useCallback(async () => {
    await fetchCanvas();
  }, [fetchCanvas]);

  const refetchTasks = useCallback(async () => {
    if (canvas?.project_id) {
      await fetchTasks(canvas.project_id);
    }
  }, [canvas?.project_id, fetchTasks]);

  return {
    canvas,
    canvasId: canvasId || null,
    items,
    connections,
    selectedItemId,
    selectedConnectionId,
    tool,
    pan,
    zoom,
    loading,
    error,
    tasks,
    enteringItemIds,
    deletingItemIds,
    pendingItemIds,
    failedItemIds,
    setItems,
    setConnections,
    addItem,
    updateItem,
    updateItemLocal,
    deleteItem,
    addConnection,
    updateConnection,
    deleteConnection,
    selectItem,
    selectConnection,
    setTool,
    setPan,
    setZoom,
    saveItem,
    clearError,
    refetch,
    refetchTasks,
  };
}
