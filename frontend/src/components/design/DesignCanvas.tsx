import { useState, useRef, useCallback } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useDesignMode } from "./DesignModeContext";
import ContextMenu, { ContextMenuItem } from "./ContextMenu";
import DraggableElement from "./DraggableElement";
import DesignToolbar from "./DesignToolbar";

interface DesignCanvasProps {
  children: ReactNode;
  page: string;
}

export default function DesignCanvas({
  children,
  page: _page,
}: DesignCanvasProps) {
  const { isDesignMode, toggleDesignMode, elements, addElement } =
    useDesignMode();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!isDesignMode) return;

      // Don't show the empty-space menu when clicking a draggable element.
      const target = e.target;

      if (
        target instanceof HTMLElement &&
        target.closest("[data-draggable]")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
      });
    },
    [isDesignMode]
  );

  const handleAddText = () => {
    addElement({
      id: `text-${Date.now()}`,
      type: "text",
      label: "Text",
      x: contextMenu?.x || 100,
      y: contextMenu?.y || 100,
      width: 200,
      height: 40,
      zIndex: elements.length + 1,
      locked: false,
      style: {
        fontSize: "16px",
        color: "var(--pm-text, #1e293b)",
        backgroundColor: "transparent",
      },
    });

    setContextMenu(null);
  };

  const handleAddButton = () => {
    addElement({
      id: `button-${Date.now()}`,
      type: "button",
      label: "Button",
      x: contextMenu?.x || 100,
      y: contextMenu?.y || 100,
      width: 120,
      height: 40,
      zIndex: elements.length + 1,
      locked: false,
      style: {
        backgroundColor: "var(--pm-accent, #3b82f6)",
        color: "var(--pm-accent-ink, #ffffff)",
        borderRadius: "6px",
        fontSize: "14px",
      },
    });

    setContextMenu(null);
  };

  const handleAddPanel = () => {
    addElement({
      id: `panel-${Date.now()}`,
      type: "panel",
      label: "Panel",
      x: contextMenu?.x || 100,
      y: contextMenu?.y || 100,
      width: 300,
      height: 200,
      zIndex: elements.length + 1,
      locked: false,
      style: {
        backgroundColor: "var(--pm-glass-soft, #f8fafc)",
        border: "1px solid var(--pm-border, #e2e8f0)",
        borderRadius: "8px",
      },
    });

    setContextMenu(null);
  };

  const handleChangeBg = () => {
    const color = prompt(
      "Enter background color (hex):",
      "#f1f5f9"
    );

    if (color && containerRef.current) {
      containerRef.current.style.backgroundColor = color;
    }

    setContextMenu(null);
  };

  const handleReset = () => {
    if (
      confirm(
        "Reset layout to default? This will remove all customizations."
      )
    ) {
      // Reset will be handled by parent.
      setContextMenu(null);
    }
  };

  const emptySpaceItems: ContextMenuItem[] = [
    {
      label: "Add Text",
      icon: "📝",
      onClick: handleAddText,
    },
    {
      label: "Add Button",
      icon: "🔘",
      onClick: handleAddButton,
    },
    {
      label: "Add Panel",
      icon: "📦",
      onClick: handleAddPanel,
    },
    {
      divider: true,
      label: "",
      onClick: () => {},
    },
    {
      label: "Change Background",
      icon: "🎨",
      onClick: handleChangeBg,
    },
    {
      label: "Reset Layout",
      icon: "🔄",
      onClick: handleReset,
      danger: true,
    },
  ];

  const canvasStyle: CSSProperties = {
    position: "relative",
    minHeight: "100vh",
    backgroundColor: isDesignMode
      ? "var(--pm-accent-soft, rgba(59, 130, 246, 0.02))"
      : "transparent",
  };

  const elementStyle = (el: (typeof elements)[number]): CSSProperties => ({
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: el.style?.fontSize || "14px",
    color: el.style?.color || "var(--pm-text, #1e293b)",
    backgroundColor: el.style?.backgroundColor || "transparent",
    borderRadius: el.style?.borderRadius || "0",
    border: el.style?.border || "none",
    cursor: "default",
  });

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
      }}
    >
      {/* Design Mode Toggle */}
      <button
        type="button"
        onClick={toggleDesignMode}
        className={
          isDesignMode
            ? "pm-button pm-button-primary"
            : "pm-button pm-button-secondary"
        }
        style={{
          position: "fixed",
          top: "16px",
          right: "16px",
          zIndex: 9997,
          borderRadius: "999px",
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: 600,
          boxShadow: "var(--pm-shadow, 0 4px 12px rgba(0, 0, 0, 0.12))",
          transition: "all 180ms ease",
        }}
      >
        {isDesignMode ? "🎨 Design Mode ON" : "🎨 Design Mode"}
      </button>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        className="design-canvas-bg"
        style={canvasStyle}
      >
        {/* Render original children */}
        {children}

        {/* Render draggable elements in design mode */}
        {isDesignMode &&
          elements.map((el) => (
            <DraggableElement key={el.id} element={el}>
              <div style={elementStyle(el)}>{el.label}</div>
            </DraggableElement>
          ))}
      </div>

      {/* Context Menu for empty space */}
      {contextMenu && isDesignMode && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={emptySpaceItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Design Toolbar */}
      <DesignToolbar />
    </div>
  );
}
