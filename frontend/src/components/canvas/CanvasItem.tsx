import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
} from "react";
import type {
  CanvasItem as CanvasItemType,
  CanvasTool,
  CanvasItemStyle,
} from "../../types/canvas";

interface CanvasItemProps {
  item: CanvasItemType;
  selected: boolean;
  tabIndex?: 0 | -1;
  ariaLabel?: string;
  zoom: number;
  pan: { x: number; y: number };
  tool: CanvasTool;
  entering?: boolean;
  exiting?: boolean;
  pending?: boolean;
  failed?: boolean;
  onSelect: (id: string) => void;
  onUpdateLocal: (
    id: string,
    updates: Partial<CanvasItemType>,
  ) => void;
  onSave: (
    id: string,
    updates: Partial<CanvasItemType>,
  ) => void;
  onDelete?: (id: string) => void;
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function parseStyle(style: string | null): CanvasItemStyle {
  if (!style) {
    return {};
  }

  try {
    return JSON.parse(style) as CanvasItemStyle;
  } catch {
    return {};
  }
}

function resolveShape(item: CanvasItemType): string {
  const style = parseStyle(item.style);
  return (style.shape as string) || item.item_type;
}

const SHAPE_TYPES = new Set([
  "square",
  "rectangle",
  "circle",
  "diamond",
  "triangle",
]);

export function CanvasItem({
  item,
  selected,
  tabIndex = -1,
  ariaLabel,
  zoom,
  pan,
  tool,
  entering,
  exiting,
  pending,
  failed,
  onSelect,
  onUpdateLocal,
  onSave,
  onDelete,
}: CanvasItemProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [hovered, setHovered] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({
    w: 0,
    h: 0,
    mx: 0,
    my: 0,
  });
  const moved = useRef(false);

  const handleMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (tool !== "select") {
      return;
    }

    event.stopPropagation();
    onSelect(item.item_id);
    setDragging(true);
    moved.current = false;

    dragOffset.current = {
      x: (event.clientX - pan.x) / zoom - item.x,
      y: (event.clientY - pan.y) / zoom - item.y,
    };
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      moved.current = true;

      const x =
        (event.clientX - pan.x) / zoom - dragOffset.current.x;
      const y =
        (event.clientY - pan.y) / zoom - dragOffset.current.y;

      onUpdateLocal(item.item_id, { x, y });
    };

    const onUp = (event: MouseEvent) => {
      setDragging(false);

      if (moved.current) {
        const x =
          (event.clientX - pan.x) / zoom - dragOffset.current.x;
        const y =
          (event.clientY - pan.y) / zoom - dragOffset.current.y;

        onSave(item.item_id, { x, y });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    dragging,
    item.item_id,
    pan.x,
    pan.y,
    zoom,
    onUpdateLocal,
    onSave,
  ]);

  const handleResizeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (tool !== "select") {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    setResizing(true);
    moved.current = false;

    resizeStart.current = {
      w: item.width,
      h: item.height,
      mx: event.clientX,
      my: event.clientY,
    };
  };

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      moved.current = true;

      const dw =
        (event.clientX - resizeStart.current.mx) / zoom;
      const dh =
        (event.clientY - resizeStart.current.my) / zoom;
      const width = Math.max(20, resizeStart.current.w + dw);
      const height = Math.max(20, resizeStart.current.h + dh);

      onUpdateLocal(item.item_id, { width, height });
    };

    const onUp = (event: MouseEvent) => {
      setResizing(false);

      if (moved.current) {
        const dw =
          (event.clientX - resizeStart.current.mx) / zoom;
        const dh =
          (event.clientY - resizeStart.current.my) / zoom;
        const width = Math.max(20, resizeStart.current.w + dw);
        const height = Math.max(20, resizeStart.current.h + dh);

        onSave(item.item_id, { width, height });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, item.item_id, zoom, onUpdateLocal, onSave]);

  const scale = dragging
    ? 1.05
    : exiting
      ? 0.85
      : selected
        ? 1.02
        : 1;

  const translateY = hovered && !dragging && !exiting ? -2 : 0;

  let boxShadow: string | undefined;

  if (dragging) {
    boxShadow = "var(--pm-shadow-float)";
  } else if (hovered && !exiting) {
    boxShadow = "var(--pm-shadow)";
  }

  const baseStyle: CSSProperties = {
    position: "absolute",
    left: item.x,
    top: item.y,
    width: item.width,
    height: item.height,
    transform: `translateY(${translateY}px) rotate(${item.rotation}deg) scale(${scale})`,
    transition:
      dragging || resizing
        ? "none"
        : `transform 200ms ${spring}, box-shadow 200ms ${spring}, border-color 200ms ${spring}`,
    zIndex: item.z_index || 1,
    boxShadow,
    pointerEvents: exiting ? "none" : undefined,
    userSelect: "none",
    cursor:
      tool === "select"
        ? dragging
          ? "grabbing"
          : "grab"
        : "default",
  };

  const renderContent = () => {
    const type = item.item_type;
    const style = parseStyle(item.style);

    if (
      SHAPE_TYPES.has(type) ||
      SHAPE_TYPES.has(resolveShape(item))
    ) {
      const shape = resolveShape(item);
      const fill = style.fill ?? "var(--pm-glass-soft, #cbd5e1)";
      const stroke =
        style.stroke ?? "var(--pm-border-strong, #475569)";
      const strokeWidth = style.strokeWidth ?? 2;
      const opacity = style.opacity ?? 1;
      const radius = style.borderRadius ?? 8;

      let clipPath: string | undefined;

      if (shape === "diamond") {
        clipPath =
          "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      }

      if (shape === "triangle") {
        clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
      }

      const borderRadius =
        shape === "circle"
          ? "50%"
          : shape === "diamond" || shape === "triangle"
            ? "0px"
            : `${radius}px`;

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
            backgroundColor: fill,
            border: `${strokeWidth}px solid ${stroke}`,
            opacity,
            borderRadius,
            clipPath,
          }}
        >
          {item.content ? (
            <span
              style={{
                padding: "0 0.25rem",
                color: "var(--pm-text)",
                fontSize: "0.75rem",
                textAlign: "center",
                overflowWrap: "anywhere",
              }}
            >
              {item.content}
            </span>
          ) : null}
        </div>
      );
    }

    if (type === "text") {
      const color =
        style.textColor || style.color || "var(--pm-text)";
      const fontSize = style.fontSize || 14;
      const fontWeight = style.fontWeight || "normal";
      const textAlign = (style.textAlign || "center") as
        | "left"
        | "right"
        | "center"
        | "justify";
      const opacity = style.opacity ?? 1;

      const justify =
        textAlign === "left"
          ? "flex-start"
          : textAlign === "right"
            ? "flex-end"
            : "center";

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            whiteSpace: "pre-wrap",
            padding: "0.5rem",
            boxSizing: "border-box",
            color,
            fontSize,
            fontWeight,
            opacity,
            justifyContent: justify,
            textAlign,
          }}
        >
          {item.content || "Text"}
        </div>
      );
    }

    if (type === "task") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            padding: "0.5rem",
            overflow: "hidden",
            border: "1px solid var(--pm-accent)",
            borderRadius: "var(--pm-radius-sm)",
            background: "var(--pm-accent-soft)",
            color: "var(--pm-text)",
          }}
        >
          <div
            style={{
              color: "var(--pm-accent)",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            Task
          </div>

          <div
            style={{
              overflow: "hidden",
              color: "var(--pm-text)",
              fontSize: "0.875rem",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.content || "Untitled task"}
          </div>
        </div>
      );
    }

    if (type === "line" || type === "arrow") {
      const stroke =
        style.stroke ?? "var(--pm-border-strong, #475569)";
      const strokeWidth = style.strokeWidth ?? 2;
      const opacity = style.opacity ?? 1;

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            opacity,
          }}
        >
          <div
            style={{
              width: "100%",
              borderTop: `${strokeWidth}px solid ${stroke}`,
            }}
          />
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius-sm)",
          background: "var(--pm-glass-soft)",
        }}
      />
    );
  };

  const itemClasses = [
    "canvas-item",
    "pm-canvas-item",
    selected ? "canvas-item-selected" : "",
    entering ? "canvas-item-enter" : "",
    exiting ? "canvas-item-exit" : "",
    dragging ? "canvas-item-dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const resizeHandleStyle: CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    border: "1px solid var(--pm-glass)",
    borderRadius: "2px",
    background: "var(--pm-accent)",
    boxSizing: "border-box",
  };

  const syncLabel = failed
    ? "Needs attention"
    : pending
      ? "Syncing…"
      : null;

  return (
    <div
      data-canvas-item-id={item.item_id}
      data-canvas-item-selected={selected ? "true" : "false"}
      role="group"
      aria-roledescription="canvas item"
      aria-label={`${ariaLabel || `Canvas item: ${item.content || item.item_type}`}${syncLabel ? `. ${syncLabel}` : ""}`}
      aria-current={selected ? "true" : undefined}
      tabIndex={tabIndex}
      style={{
        ...baseStyle,
        outline: failed
          ? "2px solid var(--pm-danger)"
          : pending
            ? "2px solid var(--pm-warning)"
            : undefined,
        outlineOffset: 2,
      }}
      className={itemClasses}
      onMouseDown={handleMouseDown}
      onClick={(event) => event.stopPropagation()}
      onFocus={() => {
        if (!selected) {
          onSelect(item.item_id);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="canvas-item-inner">{renderContent()}</div>

      {syncLabel && (
        <span
          role="status"
          style={{
            position: "absolute",
            top: -22,
            left: 0,
            zIndex: 5,
            padding: "2px 6px",
            borderRadius: "var(--pm-radius-sm)",
            border: `1px solid ${
              failed ? "var(--pm-danger)" : "var(--pm-warning)"
            }`,
            background: "var(--pm-glass-strong)",
            color: failed
              ? "var(--pm-danger)"
              : "var(--pm-text-secondary)",
            fontSize: 10,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {syncLabel}
        </span>
      )}

      {selected && tool === "select" && (
        <>
          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              right: "-6px",
              bottom: "-6px",
              cursor: "se-resize",
            }}
            onMouseDown={handleResizeMouseDown}
          />

          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              top: "-6px",
              left: "-6px",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              top: "-6px",
              right: "-6px",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              ...resizeHandleStyle,
              bottom: "-6px",
              left: "-6px",
            }}
          />
        </>
      )}

      {selected && onDelete && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="pm-button pm-button-secondary"
            style={{
              position: "absolute",
              top: "-1.5rem",
              right: 0,
              padding: "0.125rem 0.5rem",
              borderColor: "var(--pm-border)",
              background: "var(--pm-glass)",
              color: "var(--pm-danger)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.item_id);
            }}
          >
            Delete
          </button>

          <button
            type="button"
            className="pm-visually-hidden-focusable"
            aria-label="Delete selected canvas item"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.item_id);
            }}
          >
            Delete selected canvas item
          </button>
        </>
      )}
    </div>
  );
}

export default CanvasItem;
