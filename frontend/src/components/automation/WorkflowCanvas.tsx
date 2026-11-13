import type { CanvasItem, CanvasConnection, CanvasTool } from "../../types/canvas";
import { useRef, useEffect } from "react";
import { Icon } from "../layout/Icon";

export function WorkflowCanvas({
  items,
  connections,
  selectedItemId,
  selectedConnectionId,
  tool,
  setTool,
  onSelectItem,
  onSelectConnection,
  onUpdateItemLocal,
  onSaveItem,
  onDeleteItem,
  onDeleteConnection,
}: {
  items: CanvasItem[];
  connections: CanvasConnection[];
  selectedItemId: string | null;
  selectedConnectionId: string | null;
  tool: CanvasTool;
  setTool: (tool: CanvasTool) => void;
  onSelectItem: (id: string) => void;
  onSelectConnection: (id: string | null) => void;
  onUpdateItemLocal: (id: string, updates: Partial<CanvasItem>) => void;
  onSaveItem: (id: string, updates: Partial<CanvasItem>) => void;
  onDeleteItem?: (id: string) => void;
  onDeleteConnection?: (id: string) => void;
}) {
  // Suppress unused parameter warnings
  void selectedItemId;
  void selectedConnectionId;
  void tool;
  void setTool;
  void onSelectConnection;
  void onSaveItem;
  void onDeleteItem;
  void onDeleteConnection;

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pm-node-positions");
    if (stored) {
      const positions = JSON.parse(stored);
      items.forEach((item) => {
        if (positions[item.item_id]) {
          onUpdateItemLocal(item.item_id, { x: positions[item.item_id].x, y: positions[item.item_id].y });
        }
      });
    }
  }, [items, onUpdateItemLocal]);

  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    items.forEach((item) => {
      positions[item.item_id] = { x: item.x, y: item.y };
    });
    localStorage.setItem("pm-node-positions", JSON.stringify(positions));
  }, [items]);

  const getIconForItem = (itemType: CanvasItem["item_type"]): string => {
    const iconMap: Record<string, string> = {
      task: "task",
      square: "square",
      rectangle: "square",
      circle: "circle",
      diamond: "diamond",
      triangle: "triangle",
      line: "arrow",
      arrow: "arrow",
      text: "text",
    };
    return iconMap[itemType] || "square";
  };

  return (
    <div className="pm-automation-canvas" ref={canvasRef}>
      {items.map((item) => (
        <div
          key={item.item_id}
          className="pm-flow-node"
          style={{ transform: `translate(${item.x}px, ${item.y}px) scale(${item.z_index > 0 ? 1.1 : 1})` }}
          onClick={() => onSelectItem(item.item_id)}
          role="button"
          aria-label={item.content || item.item_type}
        >
          <Icon name={getIconForItem(item.item_type) as any} size={12} />
          <span className="pm-node-label">{item.content || item.item_type}</span>
        </div>
      ))}

      {connections.map((conn) => (
        <svg key={conn.connection_id} style={{ position: "absolute", pointerEvents: "none" }}>
          <line
            x1={0} y1={0} x2={0} y2={0}
            stroke={conn.style || "var(--pm-border)"}
            strokeWidth={1}
          />
        </svg>
      ))}

      <div className="pm-zoom">\- &nbsp;100%&nbsp; +</div>
    </div>
  );
}
