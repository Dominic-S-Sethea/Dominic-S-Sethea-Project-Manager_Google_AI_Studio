import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Task } from "../../types";

interface TaskPickerProps {
  tasks: Task[];
  value?: string | null;
  onChange: (taskId: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function TaskPicker({
  tasks,
  value = null,
  onChange,
  placeholder = "Select a task...",
  className = "",
}: TaskPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = tasks.filter((task) => {
    const normalizedQuery = query.toLowerCase();

    return (
      task.title.toLowerCase().includes(normalizedQuery) ||
      (task.description || "").toLowerCase().includes(normalizedQuery)
    );
  });

  const selected = tasks.find((task) => task.task_id === value) || null;

  const triggerStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.625rem 0.75rem",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-glass)",
    color: "var(--pm-text)",
    fontSize: "0.875rem",
    textAlign: "left",
    cursor: "pointer",
  };

  const dropdownStyle: CSSProperties = {
    position: "absolute",
    zIndex: 50,
    top: "calc(100% + 0.25rem)",
    left: 0,
    width: "100%",
    maxHeight: "16rem",
    overflowY: "auto",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-glass-strong, var(--pm-glass))",
    boxShadow: "var(--pm-shadow-float)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  };

  const searchInputStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "0.5rem 0.625rem",
    border: "1px solid var(--pm-border)",
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-glass-soft)",
    color: "var(--pm-text)",
    fontSize: "0.875rem",
    outlineColor: "var(--pm-accent)",
  };

  const optionStyle: CSSProperties = {
    width: "100%",
    display: "block",
    padding: "0.625rem 0.75rem",
    border: 0,
    borderRadius: "var(--pm-radius-sm)",
    background: "transparent",
    color: "var(--pm-text)",
    textAlign: "left",
    cursor: "pointer",
  };

  return (
    <div
      ref={containerRef}
      className={`pm-task-picker ${className}`.trim()}
      style={{ position: "relative", width: "100%" }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="pm-button pm-button-secondary"
        style={triggerStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.title : placeholder}
        </span>

        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "var(--pm-text-muted)",
          }}
        >
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="pm-glass-panel" style={dropdownStyle}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              padding: "0.5rem",
              borderBottom: "1px solid var(--pm-border)",
              background: "var(--pm-glass-strong, var(--pm-glass))",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              style={searchInputStyle}
            />
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label="Available tasks"
            style={{
              margin: 0,
              padding: "0.25rem",
              listStyle: "none",
            }}
          >
            {filtered.length === 0 && (
              <li
                style={{
                  padding: "0.625rem 0.75rem",
                  color: "var(--pm-text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                No tasks found
              </li>
            )}

            {filtered.map((task) => {
              const isSelected = value === task.task_id;

              return (
                <li key={task.task_id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="pm-task-picker-option"
                    style={{
                      ...optionStyle,
                      background: isSelected
                        ? "var(--pm-accent-soft)"
                        : "transparent",
                      color: isSelected
                        ? "var(--pm-accent)"
                        : "var(--pm-text)",
                    }}
                    onClick={() => {
                      onChange(task.task_id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}
                    >
                      {task.title}
                    </div>

                    <div
                      style={{
                        marginTop: "0.125rem",
                        color: "var(--pm-text-muted)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {task.status} · {task.priority}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {value && (
            <div
              style={{
                padding: "0.5rem",
                borderTop: "1px solid var(--pm-border)",
              }}
            >
              <button
                type="button"
                className="pm-button pm-button-secondary"
                style={{
                  width: "100%",
                  padding: "0.375rem 0.75rem",
                  border: 0,
                  background: "transparent",
                  color: "var(--pm-danger)",
                  textAlign: "left",
                  fontSize: "0.75rem",
                }}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
              >
                Unlink task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskPicker;
