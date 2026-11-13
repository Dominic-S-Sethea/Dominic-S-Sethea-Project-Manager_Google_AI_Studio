import type { CSSProperties } from "react";
import type {
  CanvasConnection,
  CanvasItem,
} from "../../types/canvas";

interface ConnectionLineProps {
  connection: CanvasConnection;
  fromItem: CanvasItem;
  toItem: CanvasItem;
  selected?: boolean;
  ariaLabel?: string;
  onClick?: (connectionId: string) => void;
  onDelete?: (connectionId: string) => void;
}

function center(item: CanvasItem) {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
}

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function ConnectionLine({
  connection,
  fromItem,
  toItem,
  selected = false,
  ariaLabel,
  onClick,
  onDelete,
}: ConnectionLineProps) {
  const from = center(fromItem);
  const to = center(toItem);
  const arrow = connection.connection_type === "arrow";

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));

  const handleKeyDown = (
    event: React.KeyboardEvent<SVGGElement>,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onClick?.(connection.connection_id);
      return;
    }

    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      onDelete &&
      selected
    ) {
      event.preventDefault();
      event.stopPropagation();
      onDelete(connection.connection_id);
    }
  };

  const lineStyle = {
    strokeDasharray: length,
    strokeDashoffset: 0,
    "--dash-len": length,
    animation: `canvas-draw-line 0.6s ${spring} both`,
    transitionTimingFunction: spring,
  } as CSSProperties & { "--dash-len": number };

  return (
    <g
      data-canvas-connection-id={connection.connection_id}
      className="pm-canvas-connection"
      role="button"
      tabIndex={0}
      aria-label={
        ariaLabel ||
        `Connection from item ${connection.from_item_id} to item ${connection.to_item_id}`
      }
      aria-pressed={selected}
      aria-keyshortcuts={
        onDelete ? "Enter Space Delete Backspace" : "Enter Space"
      }
      onFocus={() => {
        if (!selected) {
          onClick?.(connection.connection_id);
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(connection.connection_id);
      }}
      onKeyDown={handleKeyDown}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        outlineOffset: "2px",
      }}
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={selected ? "var(--pm-accent)" : "var(--pm-text-muted)"}
        strokeWidth={selected ? 2.5 : 2}
        markerEnd={arrow ? "url(#canvas-arrowhead)" : undefined}
        className="transition-all duration-200"
        style={lineStyle}
      />
    </g>
  );
}

export default ConnectionLine;
