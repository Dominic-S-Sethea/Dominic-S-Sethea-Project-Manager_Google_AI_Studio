import type { Checklist, Task } from "../../types";

interface ChecklistListProps {
  checklists: Checklist[];
  tasks?: Task[];
  onEdit: (checklist: Checklist) => void;
  onDelete: (id: string) => void;
}

export function ChecklistList({
  checklists,
  tasks = [],
  onEdit,
  onDelete,
}: ChecklistListProps) {
  const taskTitle = (taskId: string) =>
    tasks.find((task) => task.task_id === taskId)?.title || "Unknown task";

  return (
    <div className="pm-glass-panel">
      {checklists.length ? (
        checklists.map((checklist) => {
          const completedItems =
            checklist.items?.filter((item) => item.is_completed).length ?? 0;
          const totalItems = checklist.items?.length ?? 0;
          const progress = checklist.is_completed
            ? 100
            : totalItems > 0
              ? Math.round((completedItems / totalItems) * 100)
              : 0;

          return (
            <article
              key={checklist.checklist_id}
              className="pm-task-row"
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <strong>{checklist.title}</strong>
                <div className="pm-row-actions">
                  <button
                    type="button"
                    onClick={() => onEdit(checklist)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => onDelete(checklist.checklist_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p style={{ margin: 0, color: "var(--pm-text-muted)", fontSize: "10px" }}>
                {totalItems > 0
                  ? `${completedItems}/${totalItems} items · `
                  : ""}
                {taskTitle(checklist.task_id)}
              </p>

              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: "var(--pm-border)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "var(--pm-accent)",
                    borderRadius: "2px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <small
                style={{
                  color: "var(--pm-text-muted)",
                  fontSize: "9px",
                }}
              >
                {progress}% complete
              </small>
            </article>
          );
        })
      ) : (
        <div className="pm-empty-state">
          <strong>No checklists yet</strong>
          <p>Use a checklist for one level of concrete task actions.</p>
        </div>
      )}
    </div>
  );
}
