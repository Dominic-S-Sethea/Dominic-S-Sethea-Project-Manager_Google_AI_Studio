import { useEffect, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { getToken } from "../../hooks/useAuth";
import type { Task } from "../../types";
import type { CanvasItem as CanvasItemType } from "../../types/canvas";

interface TaskCardProps {
  item: CanvasItemType;
  task?: Task | null;
  selected?: boolean;
  onClick?: () => void;
}

const statusStyles: Record<string, CSSProperties> = {
  todo: {
    background: "var(--pm-glass-soft)",
    color: "var(--pm-text-secondary)",
    border: "1px solid var(--pm-border)",
  },
  in_progress: {
    background: "var(--pm-accent-soft)",
    color: "var(--pm-accent)",
    border: "1px solid var(--pm-border)",
  },
  done: {
    background: "var(--pm-success)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
  blocked: {
    background: "var(--pm-danger)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
};

const priorityStyles: Record<string, CSSProperties> = {
  low: {
    background: "var(--pm-glass-soft)",
    color: "var(--pm-text-secondary)",
    border: "1px solid var(--pm-border)",
  },
  normal: {
    background: "var(--pm-accent-soft)",
    color: "var(--pm-accent)",
    border: "1px solid var(--pm-border)",
  },
  high: {
    background: "var(--pm-warning)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
  urgent: {
    background: "var(--pm-danger)",
    color: "var(--pm-text)",
    border: "1px solid var(--pm-border)",
  },
};

export function TaskCard({
  item,
  task: taskProp,
  selected = false,
  onClick,
}: TaskCardProps) {
  const [task, setTask] = useState<Task | null>(taskProp ?? null);
  const [loading, setLoading] = useState(!taskProp && !!item.task_id);

  useEffect(() => {
    setTask(taskProp ?? null);

    if (taskProp) {
      setLoading(false);
      return;
    }

    if (!item.task_id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/tasks/${item.task_id}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        if (res.ok) {
          const data = (await res.json()) as { task?: Task };

          if (!cancelled && data.task) {
            setTask(data.task);
          }
        }
      } catch {
        // Ignore fetch errors; the canvas item content remains available.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.task_id, taskProp]);

  const title = task?.title || item.content || "Untitled task";
  const status = task?.status || "todo";
  const priority = task?.priority || "normal";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onClick();
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    padding: "0.5rem",
    overflow: "hidden",
    border: `1px solid ${
      selected ? "var(--pm-accent)" : "var(--pm-border)"
    }`,
    borderRadius: "var(--pm-radius-sm)",
    background: "var(--pm-accent-soft)",
    color: "var(--pm-text)",
    outline: selected ? "2px solid var(--pm-accent)" : "none",
    outlineOffset: "1px",
    cursor: onClick ? "pointer" : "default",
  };

  const badgeBaseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    padding: "0.125rem 0.375rem",
    borderRadius: "999px",
    fontSize: "0.625rem",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div
      className="pm-glass-panel pm-task-card"
      style={cardStyle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.25rem",
          minWidth: 0,
        }}
      >
        <div
          style={{
            minWidth: 0,
            overflow: "hidden",
            color: "var(--pm-accent)",
            fontSize: "0.75rem",
            fontWeight: 700,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Task
        </div>

        {loading && (
          <div
            aria-label="Loading task"
            style={{
              flexShrink: 0,
              color: "var(--pm-text-muted)",
              fontSize: "0.625rem",
            }}
          >
            …
          </div>
        )}
      </div>

      <div
        style={{
          overflow: "hidden",
          color: "var(--pm-text)",
          fontSize: "0.875rem",
          fontWeight: 600,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.25rem",
          minWidth: 0,
        }}
      >
        <span
          style={{
            ...badgeBaseStyle,
            ...(statusStyles[status] ?? statusStyles.todo),
          }}
        >
          {status}
        </span>

        <span
          style={{
            ...badgeBaseStyle,
            ...(priorityStyles[priority] ?? priorityStyles.normal),
          }}
        >
          {priority}
        </span>
      </div>
    </div>
  );
}

export default TaskCard;
