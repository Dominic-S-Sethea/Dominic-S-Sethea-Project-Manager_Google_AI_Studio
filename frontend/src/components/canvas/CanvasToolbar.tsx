import type { CanvasTool } from "../../types/canvas";

interface CanvasToolbarProps {
  tool: CanvasTool;
  setTool: (tool: CanvasTool) => void;
  orientation?: "vertical" | "horizontal";
}

const tools: { id: CanvasTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "\u2196" },
  { id: "square", label: "Square", icon: "\u25A1" },
  { id: "line", label: "Line", icon: "\u2192" },
  { id: "text", label: "Text", icon: "T" },
  { id: "task", label: "Task", icon: "\u2713" },
];

const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function CanvasToolbar({
  tool,
  setTool,
  orientation = "vertical",
}: CanvasToolbarProps) {
  const horizontal = orientation === "horizontal";

  return (
    <div
      className="pm-glass-panel"
      role="toolbar"
      aria-label="Canvas tools"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        justifyContent: horizontal ? "flex-start" : "flex-start",
        gap: "4px",
        padding: "8px",
        borderRadius: 0,
        borderRight: horizontal
          ? "none"
          : "1px solid var(--pm-border)",
        borderBottom: horizontal
          ? "1px solid var(--pm-border)"
          : "none",
        borderTop: "none",
        borderLeft: "none",
        flexShrink: 0,
        width: horizontal ? "100%" : "56px",
        minWidth: horizontal ? 0 : "56px",
      }}
    >
      {tools.map((t) => {
        const active = tool === t.id;

        return (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={active}
            onClick={() => setTool(t.id)}
            className={
              active
                ? "pm-button pm-button-primary"
                : "pm-button pm-button-quiet"
            }
            style={{
              width: "40px",
              height: "40px",
              minWidth: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transitionTimingFunction: spring,
              padding: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                transition: `transform 200ms ${spring}`,
                transform: active
                  ? "rotate(8deg) scale(1.15)"
                  : "rotate(0deg) scale(1)",
              }}
            >
              {t.icon}
            </span>
          </button>
        );
      })}

      <div
        aria-live="polite"
        style={{
          fontSize: "9px",
          textAlign: "center",
          color: "var(--pm-text-muted)",
          marginTop: horizontal ? 0 : "4px",
          marginLeft: horizontal ? "4px" : 0,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          minWidth: horizontal ? "44px" : 0,
        }}
      >
        {tool}
      </div>
    </div>
  );
}

export default CanvasToolbar;
