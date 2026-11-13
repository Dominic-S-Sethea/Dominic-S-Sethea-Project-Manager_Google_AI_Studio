import { useId, useMemo } from "react";

export type ShapeType =
  | "square"
  | "rectangle"
  | "circle"
  | "diamond"
  | "triangle";

interface ShapeSelectorProps {
  value: ShapeType | string;
  onChange: (shape: ShapeType) => void;
  className?: string;
  label?: string;
}

const SHAPES: { id: ShapeType; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rectangle", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "diamond", label: "Diamond" },
  { id: "triangle", label: "Triangle" },
];

export function ShapeSelector({
  value,
  onChange,
  className,
  label = "Shape",
}: ShapeSelectorProps) {
  const selectId = useId();

  const current = useMemo(() => {
    const found = SHAPES.find((shape) => shape.id === value);
    return found ? found.id : "square";
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            display: "block",
            marginBottom: 4,
            color: "var(--pm-text-muted)",
            fontSize: 11,
          }}
        >
          {label}
        </label>
      )}

      <select
        id={selectId}
        value={current}
        onChange={(event) => {
          const selectedShape = SHAPES.find(
            (shape) => shape.id === event.target.value,
          );

          if (selectedShape) {
            onChange(selectedShape.id);
          }
        }}
        className="pm-field"
        style={{
          width: "100%",
          minHeight: 32,
          padding: "5px 8px",
          border: "1px solid var(--pm-border)",
          borderRadius: "var(--pm-radius-sm)",
          background: "var(--pm-glass-strong)",
          color: "var(--pm-text)",
          fontSize: 12,
          fontFamily: "inherit",
        }}
      >
        {SHAPES.map((shape) => (
          <option key={shape.id} value={shape.id}>
            {shape.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ShapeSelector;
