import { useState, useRef, useCallback, useEffect } from "react";
import { useDesignMode, DesignElement } from "./DesignModeContext";
import ContextMenu from "./ContextMenu";

interface DraggableElementProps {
  element: DesignElement;
  children: React.ReactNode;
  positionMode?: "absolute" | "relative";
}

export default function DraggableElement({ element, children, positionMode = "absolute" }: DraggableElementProps) {
  const { isDesignMode, selectedId, selectElement, updateElement, removeElement, duplicateElement, bringToFront, sendToBack, lockElement, unlockElement } = useDesignMode();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: element.x, y: element.y, w: element.width, h: element.height });
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isSelected = selectedId === element.id;
  const isLocked = element.locked;

  useEffect(() => {
    if (!isDesignMode || positionMode !== "absolute" || ready || !ref.current) return;
    const timer = setTimeout(() => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const canvas = document.querySelector(".design-canvas-bg");
      const canvasRect = canvas?.getBoundingClientRect();
      const x = canvasRect ? rect.left - canvasRect.left : rect.left;
      const y = canvasRect ? rect.top - canvasRect.top : rect.top;
      setPos({ x, y, w: rect.width || element.width, h: rect.height || element.height });
      setReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [isDesignMode, positionMode, ready, element]);

  useEffect(() => {
    if (!isDesignMode) {
      setReady(false);
      setOffset({ x: 0, y: 0 });
    }
  }, [isDesignMode]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDesignMode || isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    selectElement(element.id);
    setIsDragging(true);
    if (positionMode === "absolute") {
      setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    } else {
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [isDesignMode, isLocked, element.id, selectElement, positionMode, pos, offset]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isDesignMode || isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDesignMode, isLocked]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        if (positionMode === "absolute") {
          setPos((prev) => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
        } else {
          setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
      } else if (isResizing) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPos((prev) => ({ ...prev, w: Math.max(50, prev.w + dx), h: Math.max(30, prev.h + dy) }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, positionMode]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isDesignMode) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [isDesignMode]);

  const handleLeftClick = useCallback((e: React.MouseEvent) => {
    if (isDesignMode) {
      e.preventDefault();
      e.stopPropagation();
      selectElement(element.id);
      return;
    }
  }, [isDesignMode, element.id, selectElement]);

  const contextItems = [
    { label: "Move", icon: "hand", onClick: () => selectElement(element.id) },
    { label: "Resize", icon: "ruler", onClick: () => selectElement(element.id) },
    { label: "Duplicate", icon: "copy", onClick: () => duplicateElement(element.id) },
    { label: "Bring to Front", icon: "up", onClick: () => bringToFront(element.id) },
    { label: "Send to Back", icon: "down", onClick: () => sendToBack(element.id) },
    { label: "Change Color", icon: "palette", onClick: () => {
      const color = prompt("Enter background color (hex):", element.style?.backgroundColor || "#ffffff");
      if (color) updateElement(element.id, { style: { ...element.style, backgroundColor: color } });
    }},
    { label: "Change Font Size", icon: "font", onClick: () => {
      const size = prompt("Enter font size (px):", element.style?.fontSize || "14");
      if (size) updateElement(element.id, { style: { ...element.style, fontSize: size + "px" } });
    }},
    { divider: true, label: "", onClick: () => {} },
    ...(isLocked
      ? [{ label: "Unlock", icon: "unlock", onClick: () => unlockElement(element.id) }]
      : [{ label: "Lock", icon: "lock", onClick: () => lockElement(element.id) }]),
    { label: "Delete", icon: "trash", onClick: () => removeElement(element.id), danger: true },
  ];

  if (!isDesignMode) {
    return <>{children}</>;
  }

  if (positionMode === "absolute" && !ready) {
    return (
      <div ref={ref} style={{ position: "relative", opacity: 0.01, pointerEvents: "none" }}>
        {children}
      </div>
    );
  }

  if (positionMode === "relative") {
    return (
      <>
        <div
          ref={ref}
          onClickCapture={(e) => { if (isDesignMode) { e.preventDefault(); e.stopPropagation(); selectElement(element.id); } }}
          onClick={handleLeftClick}
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          style={{
            position: "relative",
            transform: "translate(" + offset.x + "px, " + offset.y + "px)",
            cursor: isLocked ? "not-allowed" : "move",
            border: isSelected ? "2px solid #3b82f6" : "1px dashed rgba(59,130,246,0.3)",
            borderRadius: "4px",
            zIndex: isSelected ? 999 : element.zIndex,
            ...element.style,
          }}
        >
          <div style={{ pointerEvents: "none" }}>
            {children}
          </div>
          {isSelected && !isLocked && (
            <div style={{
              position: "absolute",
              top: -20,
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "#3b82f6",
              color: "white",
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}>
              {element.label}
            </div>
          )}
        </div>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextItems}
            onClose={() => setContextMenu(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={ref}
        data-draggable="true"
        onClickCapture={(e) => { if (isDesignMode) { e.preventDefault(); e.stopPropagation(); selectElement(element.id); } }}
        onClick={handleLeftClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          width: pos.w || element.width || undefined,
          height: pos.h || element.height || undefined,
          zIndex: isSelected ? 999 : element.zIndex,
          cursor: isLocked ? "not-allowed" : "move",
          border: isSelected ? "2px solid #3b82f6" : "1px dashed rgba(59,130,246,0.3)",
          borderRadius: "4px",
          overflow: "hidden",
          ...element.style,
        }}
      >
        <div style={{ pointerEvents: "none" }}>
          {children}
        </div>
        {isSelected && !isLocked && (
          <>
            <div
              onMouseDown={handleResizeStart}
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 8,
                height: 8,
                backgroundColor: "#3b82f6",
                cursor: "nwse-resize",
                borderRadius: "2px",
                zIndex: 10,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: -20,
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#3b82f6",
                color: "white",
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {element.label}
            </div>
          </>
        )}
        {isLocked && (
          <div style={{ position: "absolute", top: 2, right: 2, fontSize: "10px", opacity: 0.5 }}>
            🔒
          </div>
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}