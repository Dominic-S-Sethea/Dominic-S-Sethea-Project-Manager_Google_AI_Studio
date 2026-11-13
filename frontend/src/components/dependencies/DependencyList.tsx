import type { Task, TaskDependency } from "../../types";

interface DependencyListProps {
  dependencies: TaskDependency[];
  tasks?: Task[];
  onEdit: (dependency: TaskDependency) => void;
  onDelete: (id: string) => void;
}

export function DependencyList({
  dependencies,
  tasks = [],
  onEdit,
  onDelete,
}: DependencyListProps) {
  const taskTitle = (taskId: string) =>
    tasks.find((task) => task.task_id === taskId)?.title || "Unknown task";

  // Simple cycle detection: check if a dependency chain forms a cycle.
  // Graph edge: blocked task -> blocking task.
  // Returns true if the given dependency would create a cycle.
  const hasCycle = (deps: TaskDependency[]): boolean => {
    // Build adjacency list: blocked -> [blocking]
    const adj = new Map<string, string[]>();
    for (const dep of deps) {
      const from = dep.dependency_type === "blocks" ? dep.depends_on_id : dep.task_id;
      const to = dep.dependency_type === "blocks" ? dep.task_id : dep.depends_on_id;
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push(to);
    }

    // DFS to detect cycle
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

  const cycleDetected = hasCycle(dependencies);

  return (
    <div className="pm-glass-panel">
      {cycleDetected && (
        <div
          className="pm-state-card pm-error-state"
          style={{ marginBottom: "12px" }}
        >
          <strong>Circular dependency detected</strong>
          <span>
            A dependency chain forms a cycle. Review and resolve before adding
            new dependencies.
          </span>
        </div>
      )}

      {dependencies.length ? (
        dependencies.map((dependency) => {
          const fromTitle = taskTitle(
            dependency.dependency_type === "blocks"
              ? dependency.depends_on_id
              : dependency.task_id
          );
          const toTitle = taskTitle(
            dependency.dependency_type === "blocks"
              ? dependency.task_id
              : dependency.depends_on_id
          );

          return (
            <article
              key={dependency.id}
              className="pm-task-row"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{fromTitle}</strong>
                  <p style={{ margin: "2px 0 0", color: "var(--pm-text-muted)", fontSize: "10px" }}>
                    <span
                      className={`pm-status-pill ${
                        dependency.dependency_type === "blocks"
                          ? "blocked"
                          : "in_progress"
                      }`}
                    >
                      {dependency.dependency_type === "blocks"
                        ? "Blocks"
                        : "Blocked by"}
                    </span>{" "}
                    <span className="pm-relationship-arrow">→</span>{" "}
                    {toTitle}
                  </p>
                </div>

                <div className="pm-row-actions">
                  <button
                    type="button"
                    onClick={() => onEdit(dependency)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => onDelete(dependency.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="pm-empty-state">
          <strong>No dependencies yet</strong>
          <p>
            Declare blocking relationships so stalled work is visible rather than
            inferred.
          </p>
        </div>
      )}
    </div>
  );
}
