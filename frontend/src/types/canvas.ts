// Canvas Type Definitions

export interface Canvas {
  canvas_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  item_id: string;
  canvas_id: string;
  item_type:
    | "task"
    | "square"
    | "rectangle"
    | "circle"
    | "diamond"
    | "triangle"
    | "line"
    | "arrow"
    | "text";
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
  connection_type: "line" | "arrow";
  style: string | null;
  created_at: string;
}

export type CanvasConnectionUpdates = Partial<
  Pick<CanvasConnection, "connection_type" | "style">
>;

export interface CanvasWithItems extends Canvas {
  items: CanvasItem[];
  connections: CanvasConnection[];
}

export interface CanvasItemStyle {
  shape?: "square" | "rectangle" | "circle" | "diamond" | "triangle";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  borderRadius?: number;
}

export type CanvasTool =
  | "select"
  | "square"
  | "line"
  | "arrow"
  | "text"
  | "task";

export interface DragState {
  isDragging: boolean;
  itemId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  translateX: number;
  translateY: number;
}
