import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { Icon } from "../layout/Icon";

interface Checklist {
  checklist_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  items?: {
    item_id: string;
    content: string;
    is_completed: boolean;
    order_num: number;
  }[];
  created_at: string;
  updated_at: string;
}

interface ChecklistFormProps {
  checklist: Checklist | null;
  taskOptions: Task[];
  onSubmit: (data: {
    task_id: string;
    title: string;
    items: { content: string; is_completed?: boolean; order_num?: number }[];
  }) => void;
  onCancel: () => void;
}

export function ChecklistForm({
  checklist,
  taskOptions,
  onSubmit,
  onCancel,
}: ChecklistFormProps) {
  const [taskId, setTaskId] = useState(
    checklist?.task_id || taskOptions[0]?.task_id || ""
  );
  const [title, setTitle] = useState(checklist?.title || "");
  const [items, setItems] = useState(
    (checklist?.items || []).map((item, index) => ({
      id: item.item_id || String(index),
      content: item.content,
      is_completed: item.is_completed,
    }))
  );
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (!taskId && taskOptions[0]) setTaskId(taskOptions[0].task_id);
  }, [taskId, taskOptions]);

  const addItem = () => {
    if (newItem.trim()) {
      setItems((current) => [
        ...current,
        { id: crypto.randomUUID(), content: newItem.trim(), is_completed: false },
      ]);
      setNewItem("");
    }
  };

  const isEditing = checklist !== null;
  const selectedTaskTitle =
    taskOptions.find((task) => task.task_id === taskId)?.title || "";

  return (
    <div
      className="pm-dialog-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        className="pm-dialog pm-dialog-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pm-dialog-header">
          <div>
            <div className="pm-menu-kicker">Checklist</div>
            <h2 id="checklist-dialog-title">
              {isEditing ? "Edit checklist" : "New checklist"}
            </h2>
          </div>
          <button
            className="pm-icon-button"
            onClick={onCancel}
            aria-label="Close checklist form"
          >
            <Icon name="close" />
          </button>
        </header>

        <form
          className="pm-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              task_id: taskId,
              title: title.trim(),
              items: items.map((item, index) => ({
                content: item.content,
                is_completed: item.is_completed,
                order_num: index,
              })),
            });
          }}
        >
          <label className="pm-field pm-field-wide">
            <span>Task {isEditing ? "" : "*"}</span>
            {isEditing ? (
              <input
                value={selectedTaskTitle}
                disabled
                readOnly
                style={{
                  opacity: 0.7,
                  cursor: "not-allowed",
                }}
              />
            ) : (
              <select
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                required
              >
                <option value="">Select task</option>
                {taskOptions.map((task) => (
                  <option key={task.task_id} value={task.task_id}>
                    {task.title}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="pm-field pm-field-wide">
            <span>Checklist title *</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder="What needs to be completed?"
            />
          </label>

          <div className="pm-field pm-field-wide">
            <span>Items</span>
            <div className="pm-inline-form">
              <input
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addItem();
                  }
                }}
                placeholder="Add an item"
              />
              <button
                type="button"
                className="pm-secondary-button"
                onClick={addItem}
              >
                Add
              </button>
            </div>

            <div className="pm-checklist-items">
              {items.length ? (
                items.map((item) => (
                  <div key={item.id}>
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, is_completed: event.target.checked }
                              : entry
                          )
                        )
                      }
                    />
                    <span className={item.is_completed ? "is-complete" : ""}>
                      {item.content}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((entry) => entry.id !== item.id)
                        )
                      }
                      aria-label={`Remove ${item.content}`}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p>No items yet. Add a focused action above.</p>
              )}
            </div>
          </div>

          <footer className="pm-dialog-actions pm-field-wide">
            <button
              type="button"
              className="pm-secondary-button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pm-primary-button"
              disabled={!taskId || !title.trim()}
            >
              {isEditing ? "Save checklist" : "Create checklist"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
