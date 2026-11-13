import { useId, useMemo, useState } from "react";
import type {
  CanvasItem,
  CanvasItemStyle,
  CanvasConnection,
} from "../../types/canvas";
import { ShapeSelector, type ShapeType } from "./ShapeSelector";

interface PropertiesPanelProps {
  item: CanvasItem | null;
  items?: CanvasItem[];
  connections?: CanvasConnection[];
  connection?: CanvasConnection | null;
  onUpdateLocal: (
    id: string,
    updates: Partial<CanvasItem>,
  ) => void;
  onSave: (
    id: string,
    updates: Partial<CanvasItem>,
  ) => void | Promise<CanvasItem | null | void>;
  onDelete?: (id: string) => void;
  onAddConnection?: (
    fromId: string,
    toId: string,
    type?: "line" | "arrow",
  ) => void;
  onUpdateConnection?: (
    id: string,
    updates: {
      connection_type?: "line" | "arrow";
      style?: string | null;
    },
  ) => void;
  onDeleteConnection?: (id: string) => void;
}

type CanvasTextAlign = "left" | "center" | "right";

interface StylePreset {
  name: string;
  fill: string;
  stroke: string;
}

const PRESETS: StylePreset[] = [
  {
    name: "Accent",
    fill: "var(--pm-accent)",
    stroke: "color-mix(in srgb, var(--pm-accent) 72%, black)",
  },
  {
    name: "Success",
    fill: "var(--pm-success)",
    stroke: "color-mix(in srgb, var(--pm-success) 72%, black)",
  },
  {
    name: "Warning",
    fill: "var(--pm-warning)",
    stroke: "color-mix(in srgb, var(--pm-warning) 72%, black)",
  },
  {
    name: "Danger",
    fill: "var(--pm-danger)",
    stroke: "color-mix(in srgb, var(--pm-danger) 72%, black)",
  },
];

const FIELD_STYLE: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  padding: "6px 8px",
  border: "1px solid var(--pm-border)",
  borderRadius: "var(--pm-radius-sm)",
  background: "var(--pm-glass-strong)",
  color: "var(--pm-text)",
  fontSize: 12,
  fontFamily: "inherit",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  color: "var(--pm-text-muted)",
  fontSize: 10,
};

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  marginBottom: 2,
  color: "var(--pm-text-secondary)",
  fontSize: 10,
  fontWeight: 600,
};

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

function getColorInputValue(
  value: string | undefined,
  fallback: string,
): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return fallback;
}

type CanvasShapeItemType = Extract<
  CanvasItem["item_type"],
  ShapeType
>;

function isCanvasShapeItemType(
  value: string,
): value is CanvasShapeItemType {
  return (
    value === "square" ||
    value === "rectangle" ||
    value === "circle" ||
    value === "diamond" ||
    value === "triangle"
  );
}

export function PropertiesPanel({
  item,
  items,
  connections = [],
  connection,
  onUpdateLocal,
  onSave,
  onDelete,
  onAddConnection,
  onUpdateConnection,
  onDeleteConnection,
}: PropertiesPanelProps) {
  const idPrefix = useId();
  const [fieldError, setFieldError] = useState<string | null>(null);

  const ids = {
    content: `${idPrefix}-content`,
    fillColor: `${idPrefix}-fill-color`,
    fillValue: `${idPrefix}-fill-value`,
    strokeColor: `${idPrefix}-stroke-color`,
    strokeValue: `${idPrefix}-stroke-value`,
    strokeWidth: `${idPrefix}-stroke-width`,
    opacity: `${idPrefix}-opacity`,
    borderRadius: `${idPrefix}-border-radius`,
    textColor: `${idPrefix}-text-color`,
    fontSize: `${idPrefix}-font-size`,
    fontWeight: `${idPrefix}-font-weight`,
    textAlign: `${idPrefix}-text-align`,
    x: `${idPrefix}-x`,
    y: `${idPrefix}-y`,
    width: `${idPrefix}-width`,
    height: `${idPrefix}-height`,
    connectionType: `${idPrefix}-connection-type`,
  };

  const style = useMemo(
    () => parseStyle(item?.style ?? null),
    [item?.style],
  );

  const saveItemUpdates = (
    updates: Partial<CanvasItem>,
  ) => {
    if (!item) return;

    setFieldError(null);

    const result = onSave(item.item_id, updates);

    if (result && typeof result.then === "function") {
      void result.then((saved) => {
        if (saved === null) {
          setFieldError(
            "Could not save this field. The previous server value was restored.",
          );
        }
      });
    }
  };

  if (!item && connection) {
    return (
      <div
        className="pm-properties-panel"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
          color: "var(--pm-text)",
        }}
      >
        <section style={SECTION_STYLE}>
          <div style={SECTION_TITLE_STYLE}>Selected connection</div>
          <div style={{ fontSize: 12, color: "var(--pm-text-secondary)" }}>
            From {connection.from_item_id} to {connection.to_item_id}
          </div>
          <label
            htmlFor={ids.connectionType}
            style={LABEL_STYLE}
          >
            Connection type
          </label>
          <select
            id={ids.connectionType}
            className="pm-field"
            style={FIELD_STYLE}
            value={connection.connection_type}
            onChange={(event) => {
              const value = event.target.value;

              if (
                value === "line" ||
                value === "arrow"
              ) {
                onUpdateConnection?.(
                  connection.connection_id,
                  { connection_type: value },
                );
              }
            }}
          >
            <option value="line">Line</option>
            <option value="arrow">Arrow</option>
          </select>
        </section>

        {onDeleteConnection && (
          <button
            type="button"
            className="pm-button"
            style={{
              width: "100%",
              borderColor: "var(--pm-danger)",
              color: "var(--pm-danger)",
              background: "var(--pm-glass-soft)",
            }}
            onClick={() =>
              onDeleteConnection(connection.connection_id)
            }
          >
            Delete Connection
          </button>
        )}
      </div>
    );
  }

  if (!item) {
    return (
      <div
        style={{
          color: "var(--pm-text-muted)",
          fontSize: 12,
        }}
      >
        Select an item or connection to edit properties.
      </div>
    );
  }

  const updateStyle = (patch: Partial<CanvasItemStyle>) => {
    const current = parseStyle(item.style);
    const next = { ...current, ...patch };
    const styleStr = JSON.stringify(next);

    onUpdateLocal(item.item_id, { style: styleStr });
    saveItemUpdates({ style: styleStr });
  };

  const handleShapeChange = (shape: ShapeType) => {
    const current = parseStyle(item.style);
    const next = { ...current, shape };
    const styleStr = JSON.stringify(next);

    if (!isCanvasShapeItemType(shape)) {
      return;
    }

    const updates: Partial<CanvasItem> = {
      item_type: shape,
      style: styleStr,
    };

    onUpdateLocal(item.item_id, updates);
    saveItemUpdates(updates);
  };

  const isText = item.item_type === "text";

  const updateNumber = (
    field: "x" | "y" | "width" | "height",
    value: string,
  ) => {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      setFieldError(`${field.toUpperCase()} must be a valid number.`);
      return;
    }

    if (
      (field === "width" || field === "height") &&
      numberValue <= 0
    ) {
      setFieldError(`${field.toUpperCase()} must be greater than zero.`);
      return;
    }

    setFieldError(null);
    onUpdateLocal(item.item_id, { [field]: numberValue });
  };

  const saveNumber = (
    field: "x" | "y" | "width" | "height",
    value: string,
  ) => {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      setFieldError(`${field.toUpperCase()} must be a valid number.`);
      return;
    }

    if (
      (field === "width" || field === "height") &&
      numberValue <= 0
    ) {
      setFieldError(`${field.toUpperCase()} must be greater than zero.`);
      return;
    }

    saveItemUpdates({ [field]: numberValue });
  };

  const availableTarget = items?.find((candidate) => {
    if (candidate.item_id === item.item_id) {
      return false;
    }

    return !connections.some(
      (existing) =>
        existing.from_item_id === item.item_id &&
        existing.to_item_id === candidate.item_id,
    );
  });

  return (
    <div
      className="pm-properties-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
        color: "var(--pm-text)",
      }}
    >
      <section>
        <div
          style={{
            ...LABEL_STYLE,
            marginBottom: 4,
          }}
        >
          Type
        </div>
        <div
          style={{
            color: "var(--pm-text)",
            fontSize: 12,
            textTransform: "capitalize",
          }}
        >
          {item.item_type}
        </div>
      </section>

      <ShapeSelector
        value={style.shape || item.item_type}
        onChange={handleShapeChange}
      />

      <section>
        <label htmlFor={ids.content} style={LABEL_STYLE}>
          Content
        </label>
        <textarea
          id={ids.content}
          className="pm-field"
          style={{
            ...FIELD_STYLE,
            resize: "vertical",
          }}
          value={item.content || ""}
          onChange={(event) =>
            onUpdateLocal(item.item_id, {
              content: event.target.value,
            })
          }
          onBlur={(event) =>
            saveItemUpdates({
              content: event.target.value,
            })
          }
          rows={3}
        />
      </section>

      <section style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Style presets</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="pm-button"
              title={preset.name}
              aria-label={`${preset.name} style preset`}
              onClick={() => {
                const current = parseStyle(item.style);
                const next: Partial<CanvasItemStyle> = {
                  fill: preset.fill,
                  stroke: preset.stroke,
                };

                if (isText) {
                  next.textColor = preset.fill;
                }

                const styleStr = JSON.stringify({
                  ...current,
                  ...next,
                });

                onUpdateLocal(item.item_id, {
                  style: styleStr,
                });
                saveItemUpdates({ style: styleStr });
              }}
              style={{
                minWidth: 0,
                height: 32,
                padding: 4,
                border: "1px solid var(--pm-border)",
                borderRadius: "var(--pm-radius-sm)",
                color: "var(--pm-accent-ink)",
                background: preset.fill,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {preset.name[0]}
            </button>
          ))}
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Fill &amp; Stroke</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <label
            htmlFor={ids.fillColor}
            style={{
              color: "var(--pm-text-muted)",
              width: 64,
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            Fill
          </label>

          <input
            id={ids.fillColor}
            type="color"
            aria-label="Fill color picker"
            value={getColorInputValue(style.fill, "#cbd5e1")}
            onChange={(event) =>
              updateStyle({ fill: event.target.value })
            }
            style={{
              width: 40,
              height: 32,
              padding: 2,
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-sm)",
              background: "var(--pm-glass-strong)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          <input
            id={ids.fillValue}
            type="text"
            aria-label="Fill color value"
            value={style.fill || ""}
            onChange={(event) =>
              updateStyle({ fill: event.target.value })
            }
            className="pm-field"
            style={{
              ...FIELD_STYLE,
              flex: 1,
              padding: "4px 8px",
              fontSize: 11,
            }}
            placeholder="#cbd5e1"
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <label
            htmlFor={ids.strokeColor}
            style={{
              color: "var(--pm-text-muted)",
              width: 64,
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            Stroke
          </label>

          <input
            id={ids.strokeColor}
            type="color"
            aria-label="Stroke color picker"
            value={getColorInputValue(style.stroke, "#475569")}
            onChange={(event) =>
              updateStyle({ stroke: event.target.value })
            }
            style={{
              width: 40,
              height: 32,
              padding: 2,
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-sm)",
              background: "var(--pm-glass-strong)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          <input
            id={ids.strokeValue}
            type="text"
            aria-label="Stroke color value"
            value={style.stroke || ""}
            onChange={(event) =>
              updateStyle({ stroke: event.target.value })
            }
            className="pm-field"
            style={{
              ...FIELD_STYLE,
              flex: 1,
              padding: "4px 8px",
              fontSize: 11,
            }}
            placeholder="#475569"
          />
        </div>

        <div>
          <label htmlFor={ids.strokeWidth} style={LABEL_STYLE}>
            Stroke width: {style.strokeWidth ?? 2}px
          </label>

          <input
            id={ids.strokeWidth}
            type="range"
            min={0}
            max={12}
            step={1}
            value={style.strokeWidth ?? 2}
            onChange={(event) =>
              updateStyle({
                strokeWidth: Number(event.target.value),
              })
            }
            style={{
              width: "100%",
              accentColor: "var(--pm-accent)",
            }}
          />
        </div>

        <div>
          <label htmlFor={ids.opacity} style={LABEL_STYLE}>
            Opacity: {Math.round((style.opacity ?? 1) * 100)}%
          </label>

          <input
            id={ids.opacity}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={style.opacity ?? 1}
            onChange={(event) =>
              updateStyle({
                opacity: Number(event.target.value),
              })
            }
            style={{
              width: "100%",
              accentColor: "var(--pm-accent)",
            }}
          />
        </div>

        <div>
          <label htmlFor={ids.borderRadius} style={LABEL_STYLE}>
            Border radius
          </label>

          <input
            id={ids.borderRadius}
            type="number"
            value={style.borderRadius ?? 8}
            onChange={(event) =>
              updateStyle({
                borderRadius: Number(event.target.value),
              })
            }
            className="pm-field"
            style={FIELD_STYLE}
          />
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Text formatting</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <label
            htmlFor={ids.textColor}
            style={{
              color: "var(--pm-text-muted)",
              width: 64,
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            Color
          </label>

          <input
            id={ids.textColor}
            type="color"
            aria-label="Text color picker"
            value={getColorInputValue(
              style.textColor || style.color,
              "#1e293b",
            )}
            onChange={(event) =>
              updateStyle({
                textColor: event.target.value,
                color: event.target.value,
              })
            }
            style={{
              width: 40,
              height: 32,
              padding: 2,
              border: "1px solid var(--pm-border)",
              borderRadius: "var(--pm-radius-sm)",
              background: "var(--pm-glass-strong)",
              cursor: "pointer",
            }}
          />
        </div>

        <div>
          <label htmlFor={ids.fontSize} style={LABEL_STYLE}>
            Font size
          </label>

          <input
            id={ids.fontSize}
            type="number"
            value={style.fontSize ?? 14}
            onChange={(event) =>
              updateStyle({
                fontSize: Number(event.target.value),
              })
            }
            className="pm-field"
            style={FIELD_STYLE}
          />
        </div>

        <div>
          <label htmlFor={ids.fontWeight} style={LABEL_STYLE}>
            Font weight
          </label>

          <select
            id={ids.fontWeight}
            value={style.fontWeight || "normal"}
            onChange={(event) =>
              updateStyle({ fontWeight: event.target.value })
            }
            className="pm-field"
            style={FIELD_STYLE}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>

        <div>
          <label htmlFor={ids.textAlign} style={LABEL_STYLE}>
            Text align
          </label>

          <select
            id={ids.textAlign}
            value={style.textAlign || "center"}
            onChange={(event) =>
              updateStyle({
                textAlign: event.target.value as CanvasTextAlign,
              })
            }
            className="pm-field"
            style={FIELD_STYLE}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <div>
          <label htmlFor={ids.x} style={LABEL_STYLE}>
            X
          </label>
          <input
            id={ids.x}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.x)}
            onChange={(event) =>
              updateNumber("x", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("x", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor={ids.y} style={LABEL_STYLE}>
            Y
          </label>
          <input
            id={ids.y}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.y)}
            onChange={(event) =>
              updateNumber("y", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("y", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor={ids.width} style={LABEL_STYLE}>
            W
          </label>
          <input
            id={ids.width}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.width)}
            onChange={(event) =>
              updateNumber("width", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("width", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor={ids.height} style={LABEL_STYLE}>
            H
          </label>
          <input
            id={ids.height}
            type="number"
            className="pm-field"
            style={FIELD_STYLE}
            value={Math.round(item.height)}
            onChange={(event) =>
              updateNumber("height", event.target.value)
            }
            onBlur={(event) =>
              saveNumber("height", event.target.value)
            }
          />
        </div>
      </section>

      {fieldError && (
        <div
          role="alert"
          style={{
            color: "var(--pm-danger)",
            fontSize: 11,
          }}
        >
          {fieldError}
        </div>
      )}

      {onAddConnection && availableTarget && (
        <button
          type="button"
          className="pm-button pm-button-quiet"
          style={{ width: "100%" }}
          onClick={() => {
            onAddConnection(
              item.item_id,
              availableTarget.item_id,
              "arrow",
            );
          }}
        >
          Connect to first other item
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          className="pm-button"
          aria-label={`Delete canvas item: ${
            item.content || item.item_type
          }`}
          style={{
            width: "100%",
            borderColor: "var(--pm-danger)",
            color: "var(--pm-danger)",
            background: "var(--pm-glass-soft)",
          }}
          onClick={() => onDelete(item.item_id)}
        >
          Delete Item
        </button>
      )}
    </div>
  );
}

export default PropertiesPanel;
