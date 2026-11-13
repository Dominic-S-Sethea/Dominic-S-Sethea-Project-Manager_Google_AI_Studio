import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  divider?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuStyle: CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    left: x,
    top: y,
    minWidth: "180px",
    padding: "4px 0",
    background: "var(--pm-glass-strong)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm, 8px)",
    boxShadow:
      "var(--pm-shadow-float, 0 12px 32px rgba(0, 0, 0, 0.2))",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  };

  const dividerStyle: CSSProperties = {
    height: 0,
    margin: "4px 0",
    border: 0,
    borderTop: "1px solid var(--pm-border)",
  };

  const getButtonStyle = (
    item: ContextMenuItem
  ): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "9px 12px",
    border: 0,
    background: "transparent",
    color: item.danger
      ? "var(--pm-danger)"
      : "var(--pm-text-secondary)",
    fontSize: "13px",
    lineHeight: 1.4,
    textAlign: "left",
    cursor: item.disabled ? "not-allowed" : "pointer",
    opacity: item.disabled ? 0.5 : 1,
    transition: "background-color 150ms ease, color 150ms ease",
  });

  return (
    <div ref={ref} style={menuStyle}>
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && <hr style={dividerStyle} />}

          <button
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            style={getButtonStyle(item)}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor =
                  item.danger
                    ? "var(--pm-danger-soft, rgba(239, 68, 68, 0.10))"
                    : "var(--pm-glass-hover, var(--pm-glass-soft))";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {item.icon && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "16px",
                  flexShrink: 0,
                  textAlign: "center",
                }}
              >
                {item.icon}
              </span>
            )}

            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
