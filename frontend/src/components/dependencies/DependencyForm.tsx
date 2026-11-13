import { useState } from "react";
import type { Task, TaskDependency } from "../../types";
import { Icon } from "../layout/Icon";

interface DependencyFormProps {
  dependency: TaskDependency | null;
  taskOptions: Task[];
  existingDependencies?: TaskDependency[];
  onSubmit: (data: {
    task_id: string;
    depends_on_id: string;
    dependency_type: "blocks" | "blocked_by";
  }) => void;
  onCancel: () => void;
}

export function DependencyForm({
  dependency,
  taskOptions,
  existingDependencies = [],
  onSubmit,
  onCancel,
}: DependencyFormProps) {
  const [taskId, setTaskId] = useState(dependency?.task_id || "");
  const [dependsOnId, setDependsOnId] = useState(
    dependency?.depends_on_id || ""
  );
  const [type, setType] = useState<"blocks" | "blocked_by">(
    dependency?.dependency_type || "blocks"
  );

  const isEditing = dependency !== null;

  // Cycle detection: check if adding this dependency would create a cycle.
  // Graph edge: blocked task -> blocking task.
  const wouldCreateCycle = (): boolean => {
    if (!taskId || !dependsOnId || taskId === dependsOnId) return false;

    // Build adjacency list from existing dependencies + proposed new one
    const adj = new Map<string, string[]>();

    const addEdge = (from: string, to: string) => {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push(to);
    };

    for (const dep of existingDependencies) {
      // Skip the dependency being edited
      if (isEditing && dep.id === dependency?.id) continue;
      const from =
        dep.dependency_type === "blocks"
          ? dep.depends_on_id
          : dep.task_id;
      const to =
        dep.dependency_type === "blocks" ? dep.task_id : dep.depends_on_id;
      addEdge(from, to);
    }

    // Add proposed edge
    const from = type === "blocks" ? dependsOnId : taskId;
    const to = type === "blocks" ? taskId : dependsOnId;
    addEdge(from, to);

    // DFS cycle detection
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      for (const neighbor of adj.get(node) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }
      recStack.delete(node);
      return false;
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }
    return false;
  };

  const cycleWarning = wouldCreateCycle();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (cycleWarning) return;
    onSubmit({
      task_id: taskId,
      depends_on_id: dependsOnId,
      dependency_type: type,
    });
  };

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
        aria-labelledby="dependency-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pm-dialog-header">
          <div>
            <div className="pm-menu-kicker">Dependency</div>
            <h2 id="dependency-dialog-title">
              {isEditing ? "Edit dependency" : "New dependency"}
            </h2>
          </div>
          <button
            className="pm-icon-button"
            onClick={onCancel}
            aria-label="Close dependency form"
          >
            <Icon name="close" />
          </button>
        </header>

        <form className="pm-form-grid" onSubmit={handleSubmit}>
          <label className="pm-field">
            <span>Task *</span>
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
          </label>

          <label className="pm-field">
            <span>Depends on *</span>
            <select
              value={dependsOnId}
              onChange={(event) => setDependsOnId(event.target.value)}
              required
            >
              <option value="">Select task</option>
              {taskOptions
                .filter((task) => task.task_id !== taskId)
                .map((task) => (
                  <option key={task.task_id} value={task.task_id}>
                    {task.title}
                  </option>
                ))}
            </select>
          </label>

          <label className="pm-field pm-field-wide">
            <span>Relationship</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as "blocks" | "blocked_by")
              }
            >
              <option value="blocks">
                Blocks (this task blocks another)
              </option>
              <option value="blocked_by">
                Blocked by (this task waits for another)
              </option>
            </select>
          </label>

          {cycleWarning && (
            <div
              className="pm-state-card pm-error-state"
              style={{ gridColumn: "1 / -1" }}
            >
              <strong>Circular dependency detected</strong>
              <span>
                The proposed relationship would create a circular task
                dependency. Prevent saving until resolved.
              </span>
            </div>
          )}

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
              disabled={cycleWarning || !taskId || !dependsOnId}
            >
              {isEditing ? "Save dependency" : "Create dependency"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
