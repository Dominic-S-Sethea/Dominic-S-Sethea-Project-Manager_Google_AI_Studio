import { useEffect, useRef, useState } from "react";
import type {
  CanvasItem,
  CanvasConnection,
  CanvasTool,
} from "../../types/canvas";
import { CanvasItem as CanvasItemComp } from "./CanvasItem";
import { ConnectionLine } from "./ConnectionLine";

interface CanvasViewportProps {
  items: CanvasItem[];
  connections: CanvasConnection[];
  selectedItemId: string | null;
  selectedConnectionId: string | null;
  tool: CanvasTool;
  pan: { x: number; y: number };
  zoom: number;
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onSelectItem: (id: string | null) => void;
  onSelectConnection: (id: string | null) => void;
  onUpdateItemLocal: (
    id: string,
    updates: Partial<CanvasItem>,
  ) => void;
  onSaveItem: (
    id: string,
    updates: Partial<CanvasItem>,
  ) => void;
  onDeleteItem?: (id: string) => void;
  onDeleteConnection?: (id: string) => void;
  onCanvasClick?: (point: { x: number; y: number }) => void;
  enteringItemIds?: Set<string>;
  deletingItemIds?: Set<string>;
  pendingItemIds?: Set<string>;
  failedItemIds?: Set<string>;
  loading?: boolean;
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

function getVisualItemOrder(items: CanvasItem[]): CanvasItem[] {
  return [...items].sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x ||
      a.z_index - b.z_index ||
      a.item_id.localeCompare(b.item_id),
  );
}

export function CanvasViewport({
  items,
  connections,
  selectedItemId,
  selectedConnectionId,
  tool,
  pan,
  zoom,
  onPanChange,
  onZoomChange,
  onSelectItem,
  onSelectConnection,
  onUpdateItemLocal,
  onSaveItem,
  onDeleteItem,
  onDeleteConnection,
  onCanvasClick,
  enteringItemIds,
  deletingItemIds,
  pendingItemIds,
  failedItemIds,
  loading,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const spacePressed = useRef(false);
  const dragMoved = useRef(false);
  const panRef = useRef(pan);

  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, t: 0 });
  const momentumRafRef = useRef<number | null>(null);
  const [momentumActive, setMomentumActive] = useState(false);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const updatePreference = () => {
      setReducedMotion(mediaQuery.matches);

      if (mediaQuery.matches && momentumRafRef.current !== null) {
        cancelAnimationFrame(momentumRafRef.current);
        momentumRafRef.current = null;
        setMomentumActive(false);
      }
    };

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  const cancelMomentum = () => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }

    setMomentumActive(false);
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      const root = containerRef.current;
      const target = event.target;

      if (!root || !(target instanceof Node) || !root.contains(target)) {
        return;
      }

      if (isTextEntryTarget(target)) {
        return;
      }

      // Connections handle Space as their own activation key.
      if (
        target instanceof Element &&
        target.closest("[data-canvas-connection-id]")
      ) {
        return;
      }

      spacePressed.current = true;
      setSpacePanActive(true);
      event.preventDefault();
    };

    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressed.current = false;
        setSpacePanActive(false);
      }
    };

    const blur = () => {
      spacePressed.current = false;
      setSpacePanActive(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (momentumRafRef.current !== null) {
        cancelAnimationFrame(momentumRafRef.current);
        momentumRafRef.current = null;
      }
    };
  }, []);

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const middle = event.button === 1;
    const spaceDrag = spacePressed.current && event.button === 0;

    if (!middle && !spaceDrag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    cancelMomentum();
    setIsPanning(true);
    dragMoved.current = false;

    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      tx: pan.x,
      ty: pan.y,
    };

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
    };

    velocityRef.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    if (!isPanning) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      dragMoved.current = true;

      const now = performance.now();
      const dt = now - lastPointerRef.current.t;

      if (dt > 0) {
        velocityRef.current = {
          x:
            ((event.clientX - lastPointerRef.current.x) / dt) * 16,
          y:
            ((event.clientY - lastPointerRef.current.y) / dt) * 16,
        };
      }

      lastPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        t: now,
      };

      onPanChange({
        x:
          panStart.current.tx +
          (event.clientX - panStart.current.x),
        y:
          panStart.current.ty +
          (event.clientY - panStart.current.y),
      });
    };

    const onUp = () => {
      setIsPanning(false);

      const velocity = velocityRef.current;

      if (
        !reducedMotion &&
        Math.hypot(velocity.x, velocity.y) > 1.2
      ) {
        setMomentumActive(true);

        let currentPan = { ...panRef.current };
        let velocityX = velocity.x;
        let velocityY = velocity.y;

        const step = () => {
          velocityX *= 0.9;
          velocityY *= 0.9;

          if (
            Math.abs(velocityX) < 0.05 &&
            Math.abs(velocityY) < 0.05
          ) {
            momentumRafRef.current = null;
            setMomentumActive(false);
            return;
          }

          currentPan = {
            x: currentPan.x + velocityX,
            y: currentPan.y + velocityY,
          };

          onPanChange(currentPan);
          momentumRafRef.current = requestAnimationFrame(step);
        };

        momentumRafRef.current = requestAnimationFrame(step);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning, onPanChange, reducedMotion]);

  const handleWheel = (
    event: React.WheelEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    cancelMomentum();

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(4, Math.max(0.2, zoom * delta));

    onZoomChange(newZoom);
  };

  const handleBackgroundClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (dragMoved.current) {
      return;
    }

    if (tool !== "select" && onCanvasClick) {
      const rect = containerRef.current?.getBoundingClientRect();

      if (rect) {
        const x = (event.clientX - rect.left - pan.x) / zoom;
        const y = (event.clientY - rect.top - pan.y) / zoom;

        onCanvasClick({ x, y });
      }

      return;
    }

    onSelectItem(null);
    onSelectConnection(null);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (isTextEntryTarget(event.target)) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onSelectItem(null);
      onSelectConnection(null);
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const itemElement = target.closest<HTMLElement>(
      "[data-canvas-item-id]",
    );

    if (!itemElement || target.closest("button")) {
      return;
    }

    const itemId = itemElement.dataset.canvasItemId;

    if (!itemId) {
      return;
    }

    const item = items.find(
      (candidate) => candidate.item_id === itemId,
    );

    if (!item) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onSelectItem(itemId);
      onSelectConnection(null);
      return;
    }

    if (
      event.key === "Delete" ||
      event.key === "Backspace"
    ) {
      if (!onDeleteItem) {
        return;
      }

      event.preventDefault();
      onDeleteItem(itemId);
      return;
    }

    const movement = event.shiftKey ? 10 : 1;

    let x = item.x;
    let y = item.y;

    switch (event.key) {
      case "ArrowLeft":
        x -= movement;
        break;
      case "ArrowRight":
        x += movement;
        break;
      case "ArrowUp":
        y -= movement;
        break;
      case "ArrowDown":
        y += movement;
        break;
      default:
        return;
    }

    event.preventDefault();

    const updates = { x, y };

    onSelectItem(itemId);
    onSelectConnection(null);
    onUpdateItemLocal(itemId, updates);
    onSaveItem(itemId, updates);
  };

  const visualItems = getVisualItemOrder(items);
  const visualItemIndex = new Map(
    visualItems.map((item, index) => [item.item_id, index]),
  );

  const itemMap = new Map(
    items.map((item) => [item.item_id, item]),
  );

  const visualConnections = [...connections].sort((a, b) => {
    const aFrom = itemMap.get(a.from_item_id);
    const bFrom = itemMap.get(b.from_item_id);
    const aTo = itemMap.get(a.to_item_id);
    const bTo = itemMap.get(b.to_item_id);

    return (
      (aFrom?.y ?? 0) - (bFrom?.y ?? 0) ||
      (aFrom?.x ?? 0) - (bFrom?.x ?? 0) ||
      (aTo?.y ?? 0) - (bTo?.y ?? 0) ||
      (aTo?.x ?? 0) - (bTo?.x ?? 0) ||
      a.connection_id.localeCompare(b.connection_id)
    );
  });

  const selectedItemIndex =
    selectedItemId === null
      ? -1
      : visualItemIndex.get(selectedItemId) ?? -1;

  const selectedConnectionIndex = visualConnections.findIndex(
    (connection) =>
      connection.connection_id === selectedConnectionId,
  );

  const selectionAnnouncement =
    selectedItemIndex >= 0
      ? `Selected item ${selectedItemIndex + 1} of ${items.length}.`
      : selectedConnectionIndex >= 0
        ? `Connection ${selectedConnectionIndex + 1} of ${connections.length} selected.`
        : "";

  const firstVisualItemId = visualItems[0]?.item_id ?? null;

  return (
    <div
      ref={containerRef}
      className="pm-canvas-viewport"
      role="application"
      aria-label="Canvas workspace"
      aria-describedby="canvas-viewport-instructions"
      tabIndex={-1}
      onMouseDownCapture={handleMouseDown}
      onWheel={handleWheel}
      onClick={handleBackgroundClick}
      onKeyDown={handleKeyDown}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        backgroundColor: "var(--pm-canvas)",
        backgroundImage:
          "linear-gradient(to right, color-mix(in srgb, var(--pm-text-muted) 15%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--pm-text-muted) 15%, transparent) 1px, transparent 1px)",
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning
          ? "grabbing"
          : spacePanActive
            ? "grab"
            : "default",
      }}
    >
      <div
        id="canvas-viewport-instructions"
        className="pm-visually-hidden"
      >
        Canvas keyboard controls. Tab moves through the canvas item and
        then each connection. When an item is focused, use the arrow keys
        to move it by one pixel. Hold Shift with an arrow key to move it
        by ten pixels. Delete or Backspace deletes the focused item.
        Escape clears the current selection. Hold Space and drag to pan
        the canvas. Connection controls can be selected with Enter or
        Space. When a connection is focused, Delete or Backspace deletes
        it when deletion is available.
      </div>

      <div
        className="pm-visually-hidden"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {selectionAnnouncement}
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition:
            isPanning || momentumActive
              ? "none"
              : `transform 120ms ${spring}`,
        }}
      >
        {items.map((item) => {
          const orderIndex = visualItemIndex.get(item.item_id) ?? 0;
          const isSelected = selectedItemId === item.item_id;
          const isRovingItem =
            isSelected ||
            (selectedItemId === null &&
              item.item_id === firstVisualItemId);

          return (
            <CanvasItemComp
              key={item.item_id}
              item={item}
              selected={isSelected}
              tabIndex={isRovingItem ? 0 : -1}
              ariaLabel={`Canvas item ${orderIndex + 1} of ${items.length}: ${
                item.content || item.item_type
              }`}
              zoom={zoom}
              pan={pan}
              tool={tool}
              entering={enteringItemIds?.has(item.item_id)}
              exiting={deletingItemIds?.has(item.item_id)}
              pending={pendingItemIds?.has(item.item_id)}
              failed={failedItemIds?.has(item.item_id)}
              onSelect={(id) => {
                onSelectItem(id);
                onSelectConnection(null);
              }}
              onUpdateLocal={onUpdateItemLocal}
              onSave={onSaveItem}
              onDelete={onDeleteItem}
            />
          );
        })}

        <svg
          width={4000}
          height={4000}
          role="group"
          aria-label="Canvas connections"
          style={{
            position: "absolute",
            zIndex: 0,
            top: 0,
            left: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="canvas-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="var(--pm-text-muted)"
              />
            </marker>
          </defs>

          {visualConnections.map((connection, index) => {
            const fromItem = itemMap.get(connection.from_item_id);
            const toItem = itemMap.get(connection.to_item_id);

            if (!fromItem || !toItem) {
              return null;
            }

            const fromIndex =
              (visualItemIndex.get(connection.from_item_id) ?? 0) + 1;
            const toIndex =
              (visualItemIndex.get(connection.to_item_id) ?? 0) + 1;

            return (
              <ConnectionLine
                key={connection.connection_id}
                connection={connection}
                fromItem={fromItem}
                toItem={toItem}
                selected={
                  selectedConnectionId === connection.connection_id
                }
                ariaLabel={`Connection ${index + 1} of ${connections.length}: from item ${fromIndex} to item ${toIndex}`}
                onClick={(connectionId) => {
                  onSelectConnection(connectionId);
                  onSelectItem(null);
                }}
                onDelete={onDeleteConnection}
              />
            );
          })}
        </svg>

        {loading && items.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="canvas-skeleton"
                style={{
                  position: "absolute",
                  left: 80 + index * 150,
                  top: 80 + (index % 2) * 90,
                  width: 120,
                  height: 80,
                  borderRadius: "var(--pm-radius-sm)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="pm-canvas-zoom-indicator"
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          padding: "4px 8px",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius-sm)",
          color: "var(--pm-text-secondary)",
          background: "var(--pm-glass-strong)",
          boxShadow: "var(--pm-shadow)",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

export default CanvasViewport;
