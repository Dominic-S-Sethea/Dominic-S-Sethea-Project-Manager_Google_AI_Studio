import { useDesignMode } from "./DesignModeContext";

export default function DesignToolbar() {
  const {
    isDesignMode,
    toggleDesignMode,
    undo,
    redo,
    historyIndex,
    history,
    saveLayout,
    resetLayout,
    elements,
  } = useDesignMode();

  if (!isDesignMode) return null;

  return (
    <div
      className="pm-glass-panel"
      style={{
        position: "fixed",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "8px",
        padding: "10px 14px",
        border: "1px solid var(--pm-border)",
        borderRadius: "var(--pm-radius-lg)",
        boxShadow: "var(--pm-shadow-float)",
        background: "var(--pm-glass-strong)",
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <button
        type="button"
        onClick={undo}
        disabled={historyIndex <= 0}
        className="pm-button pm-button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px" }}
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>

      <button
        type="button"
        onClick={redo}
        disabled={historyIndex >= history.length - 1}
        className="pm-button pm-button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px" }}
        title="Redo (Ctrl+Y)"
      >
        ↪ Redo
      </button>

      <div
        aria-hidden="true"
        style={{
          width: "1px",
          height: "24px",
          background: "var(--pm-border)",
        }}
      />

      <span
        style={{
          padding: "0 8px",
          color: "var(--pm-text-secondary)",
          fontSize: "11px",
          whiteSpace: "nowrap",
        }}
      >
        {elements.length} elements
      </span>

      <div
        aria-hidden="true"
        style={{
          width: "1px",
          height: "24px",
          background: "var(--pm-border)",
        }}
      />

      <button
        type="button"
        onClick={resetLayout}
        className="pm-button pm-button-secondary"
        style={{
          padding: "6px 12px",
          fontSize: "12px",
          color: "var(--pm-danger)",
        }}
        title="Reset to default layout"
      >
        🔄 Reset
      </button>

      <button
        type="button"
        onClick={saveLayout}
        className="pm-button pm-button-primary"
        style={{
          padding: "6px 14px",
          fontSize: "12px",
          fontWeight: 600,
        }}
        title="Save and lock layout"
      >
        💾 Save & Lock
      </button>

      <button
        type="button"
        onClick={toggleDesignMode}
        className="pm-button pm-button-secondary"
        style={{ padding: "6px 12px", fontSize: "12px" }}
      >
        ✕ Exit
      </button>
    </div>
  );
}
