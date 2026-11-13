import { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth, getToken } from "../hooks/useAuth";
import { useCanvas } from "../hooks/useCanvas";
import { CanvasToolbar } from "../components/canvas/CanvasToolbar";
import { CanvasViewport } from "../components/canvas/CanvasViewport";
import { PropertiesPanel } from "../components/canvas/PropertiesPanel";
import { TaskPicker } from "../components/canvas/TaskPicker";
import type { CanvasItem } from "../types/canvas";
import { Icon } from "../components/layout/Icon";

function getVisualItemOrder(items: CanvasItem[]): CanvasItem[] {
  return [...items].sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x ||
      a.z_index - b.z_index ||
      a.item_id.localeCompare(b.item_id),
  );
}

export default function CanvasPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = searchParams.get("project_id");

  const pageRef = useRef<HTMLDivElement>(null);

  const [creating, setCreating] = useState(false);
  const [taskToPlaceId, setTaskToPlaceId] = useState<string | null>(
    null,
  );
  const [isNarrowCanvas, setIsNarrowCanvas] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 780px)").matches
      : false,
  );

  const canvasId = id;

  const {
    canvas,
    items,
    connections,
    selectedItemId,
    selectedConnectionId,
    tool,
    pan,
    zoom,
    loading,
    error,
    addItem,
    updateItemLocal,
    saveItem,
    tasks,
    enteringItemIds,
    deletingItemIds,
    pendingItemIds,
    failedItemIds,
    deleteItem,
    deleteConnection,
    updateConnection,
    selectItem,
    selectConnection,
    setTool,
    setPan,
    setZoom,
    addConnection,
    clearError,
    refetch,
  } = useCanvas(canvasId);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 780px)");

    const updateLayout = () => {
      setIsNarrowCanvas(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

  // Create a canvas if none exists (no id provided).
  useEffect(() => {
    if (id) return;
    if (creating) return;

    setCreating(true);

    const run = async () => {
      try {
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            name: "Untitled Canvas",
            description: null,
          }),
        });

        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          const message =
            data !== null &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Failed to create canvas";

          throw new Error(message);
        }

        const data = await res.json();

        navigate(`/canvas/${data.canvas.canvas_id}`, {
          replace: true,
        });
      } catch (caught) {
        console.error(caught);
        setCreating(false);
      }
    };

    void run();
  }, [id, creating, projectId, navigate]);

  const handleCanvasClick = async (
    point: { x: number; y: number },
  ) => {
    if (tool === "select") return;

    if (tool === "square") {
      await addItem({
        item_type: "square",
        x: point.x,
        y: point.y,
        width: 120,
        height: 120,
      });
    } else if (tool === "text") {
      await addItem({
        item_type: "text",
        x: point.x,
        y: point.y,
        width: 160,
        height: 40,
        content: "Text",
      });
    } else if (tool === "task") {
      const task =
        tasks?.find((candidate) => candidate.task_id === taskToPlaceId) ||
        null;

      await addItem({
        item_type: "task",
        x: point.x,
        y: point.y,
        width: 160,
        height: 80,
        task_id: task?.task_id || null,
        content: task?.title || "New task",
      });
    } else if (tool === "line" || tool === "arrow") {
      await addItem({
        item_type: tool === "arrow" ? "arrow" : "line",
        x: point.x,
        y: point.y,
        width: 120,
        height: 20,
      });
    }

    setTool("select");
  };

  const selected =
    items.find((item) => item.item_id === selectedItemId) || null;

  const selectedConnection =
    connections.find(
      (connection) =>
        connection.connection_id === selectedConnectionId,
    ) || null;

  const handleSaveItem = (
    itemId: string,
    updates: Partial<CanvasItem>,
  ) => {
    updateItemLocal(itemId, updates);
    void saveItem(itemId, updates);
  };

  const handleDeleteItem = (itemId: string) => {
    const visualItems = getVisualItemOrder(items);
    const itemIndex = visualItems.findIndex(
      (item) => item.item_id === itemId,
    );

    const nextItem =
      itemIndex >= 0
        ? visualItems[itemIndex + 1] || visualItems[itemIndex - 1] || null
        : null;

    selectConnection(null);
    selectItem(nextItem?.item_id ?? null);
    void deleteItem(itemId);

    window.requestAnimationFrame(() => {
      const itemElements =
        pageRef.current?.querySelectorAll<HTMLElement>(
          "[data-canvas-item-id]",
        );

      const nextElement = nextItem
        ? Array.from(itemElements || []).find(
            (element) =>
              element.dataset.canvasItemId === nextItem.item_id,
          )
        : null;

      if (nextElement) {
        nextElement.focus();
        return;
      }

      pageRef.current
        ?.querySelector<HTMLElement>(".pm-canvas-viewport")
        ?.focus();
    });
  };

  const handleDeleteConnection = (connectionId: string) => {
    void deleteConnection(connectionId);
    selectConnection(null);

    window.requestAnimationFrame(() => {
      pageRef.current
        ?.querySelector<HTMLElement>(".pm-canvas-viewport")
        ?.focus();
    });
  };

  const handleUpdateConnection = (
    connectionId: string,
    updates: {
      connection_type?: "line" | "arrow";
      style?: string | null;
    },
  ) => {
    void updateConnection(connectionId, updates);
  };

  if (!id) {
    return (
      <div
        className="pm-view"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="pm-empty-state">
          <strong>Creating canvas...</strong>
        </div>
      </div>
    );
  }

  if (loading && !canvas) {
    return (
      <div
        className="pm-view"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="pm-skeleton-list">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (error && !canvas) {
    return (
      <div
        className="pm-view"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="pm-state-card pm-error-state">
          <Icon name="shield" size={18} />
          <div>
            <strong>Canvas could not be loaded.</strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="pm-button pm-button-small"
            onClick={() => {
              clearError();
              void refetch();
            }}
          >
            Retry
          </button>
          <button
            type="button"
            className="pm-button pm-button-quiet pm-button-small"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className="pm-view pm-canvas-page"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: "100vh",
        padding: 0,
        margin: 0,
        gap: 0,
        overflow: "hidden",
      }}
    >
      <header
        className="pm-glass-panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          minWidth: 0,
          padding: isNarrowCanvas ? "8px 12px" : "8px 16px",
          borderRadius: 0,
          borderBottom: "1px solid var(--pm-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <button
            type="button"
            className="pm-button pm-button-quiet"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <Icon name="chevron" size={14} />
            Back
          </button>

          <span
            style={{
              fontWeight: 700,
              color: "var(--pm-text)",
              fontSize: 14,
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {canvas?.name || "Canvas"}
          </span>

          {tool === "task" && (
            <div
              style={{
                width: isNarrowCanvas
                  ? "min(240px, 100%)"
                  : "240px",
                minWidth: 0,
                flex: "0 1 240px",
              }}
            >
              <TaskPicker
                tasks={tasks}
                value={taskToPlaceId}
                onChange={setTaskToPlaceId}
                placeholder="Choose task to place..."
              />
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--pm-text-muted)",
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {user?.username}
        </div>
      </header>

      {error && canvas && (
        <div
          role="alert"
          className="pm-state-card pm-error-state"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            margin: 8,
            padding: "8px 12px",
          }}
        >
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {error}
          </span>
          <button
            type="button"
            className="pm-button pm-button-small"
            onClick={() => {
              clearError();
              void refetch();
            }}
          >
            Retry
          </button>
        </div>
      )}

      <main
        className="pm-canvas-page-main"
        aria-label="Canvas editor"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: isNarrowCanvas ? "column" : "row",
          overflow: "hidden",
        }}
      >
        <CanvasToolbar
          tool={tool}
          setTool={setTool}
          orientation={isNarrowCanvas ? "horizontal" : "vertical"}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flex: 1,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <CanvasViewport
            items={items}
            connections={connections}
            selectedItemId={selectedItemId}
            selectedConnectionId={selectedConnectionId}
            tool={tool}
            pan={pan}
            zoom={zoom}
            onPanChange={setPan}
            onZoomChange={setZoom}
            onSelectItem={selectItem}
            onSelectConnection={selectConnection}
            onUpdateItemLocal={updateItemLocal}
            onSaveItem={handleSaveItem}
            onDeleteItem={handleDeleteItem}
            onDeleteConnection={handleDeleteConnection}
            onCanvasClick={handleCanvasClick}
            enteringItemIds={enteringItemIds}
            deletingItemIds={deletingItemIds}
            pendingItemIds={pendingItemIds}
            failedItemIds={failedItemIds}
            loading={loading}
          />

          {items.length === 0 && !loading && (
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                pointerEvents: "none",
              }}
            >
              <div
                className="pm-empty-state"
                style={{
                  maxWidth: 320,
                  textAlign: "center",
                  color: "var(--pm-text-secondary)",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "var(--pm-text)",
                    marginBottom: 6,
                  }}
                >
                  Your canvas is empty
                </strong>
                <span style={{ fontSize: 12 }}>
                  Choose a tool and click anywhere on the canvas to add
                  your first item.
                </span>
              </div>
            </div>
          )}
        </div>

        <aside
          className="pm-glass-panel"
          aria-label="Canvas properties"
          style={{
            width: isNarrowCanvas ? "100%" : "288px",
            minWidth: 0,
            maxWidth: "100%",
            height: isNarrowCanvas ? "34vh" : "auto",
            maxHeight: isNarrowCanvas ? "280px" : "none",
            minHeight: isNarrowCanvas ? "150px" : 0,
            flex: isNarrowCanvas
              ? "0 1 34vh"
              : "0 0 288px",
            padding: "16px",
            overflowY: "auto",
            overflowX: "hidden",
            borderRadius: 0,
            borderLeft: isNarrowCanvas
              ? "none"
              : "1px solid var(--pm-border)",
            borderTop: isNarrowCanvas
              ? "1px solid var(--pm-border)"
              : "none",
            borderBottom: "none",
            borderRight: "none",
          }}
        >
          <h2
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--pm-text-secondary)",
              marginBottom: 12,
            }}
          >
            Properties
          </h2>

          <PropertiesPanel
            item={selected}
            items={items}
            connections={connections}
            connection={selectedConnection}
            onUpdateLocal={updateItemLocal}
            onSave={saveItem}
            onDelete={handleDeleteItem}
            onAddConnection={(fromId, toId, type) =>
              addConnection(fromId, toId, type || "arrow")
            }
            onUpdateConnection={handleUpdateConnection}
            onDeleteConnection={handleDeleteConnection}
          />
        </aside>
      </main>
    </div>
  );
}
