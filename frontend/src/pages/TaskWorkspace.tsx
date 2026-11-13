import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getToken } from "../hooks/useAuth";
import type { Checklist, Project, Task, TaskDependency } from "../types";
import { Icon } from "../components/ui/Icon";
import { ChecklistList } from "../components/checklists/ChecklistList";
import { ChecklistForm } from "../components/checklists/ChecklistForm";
import { DependencyList } from "../components/dependencies/DependencyList";
import { DependencyForm } from "../components/dependencies/DependencyForm";

interface TaskWorkspaceProps {
  createSignal: number;
  scope?: "all" | "mine";
  currentUserId?: string | null;
  projectId?: string | null;
}

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];
type ViewMode = "list" | "board";
type TabMode = "tasks" | "checklists" | "dependencies";

interface TaskDraft {
  task_id?: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  assignee_id: string;
}

interface MoveTaskStatusPayload {
  taskId: string;
  status: TaskStatus;
}

const emptyDraft = (): TaskDraft => ({
  project_id: "",
  title: "",
  description: "",
  status: "todo",
  priority: "normal",
  due_date: "",
  assignee_id: "",
});

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const boardStatuses: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

function dateForInput(value: string | null): string {
  if (!value) return "";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 16);
}

function dateLabel(value: string | null): string {
  if (!value) return "—";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

export default function TaskWorkspace({
  createSignal,
  scope = "all",
  currentUserId = null,
  projectId = null,
}: TaskWorkspaceProps) {
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [activeTab, setActiveTab] = useState<TabMode>("tasks");
  const [checklistDraft, setChecklistDraft] = useState<Checklist | null>(null);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [dependencyDraft, setDependencyDraft] = useState<TaskDependency | null>(null);
  const [showDependencyForm, setShowDependencyForm] = useState(false);

  // Project-aware query: switching projects produces a separate cache entry.
  const tasksQuery = useQuery<Task[]>({
    queryKey: ["workspace-tasks", projectId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (projectId) {
        params.set("project_id", projectId);
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/api/tasks?${queryString}`
        : "/api/tasks";

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Tasks could not be loaded.");
      }

      const data = (await response.json()) as {
        tasks: Task[];
      };

      return data.tasks;
    },
  });

  const projectsQuery = useQuery<Project[]>({
    queryKey: ["workspace-projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Projects could not be loaded.");
      }

      const data = (await response.json()) as {
        projects: Project[];
      };

      return data.projects;
    },
  });

  // Checklist query: fetches all checklists (items not populated in list view).
  const checklistsQuery = useQuery<Checklist[]>({
    queryKey: ["workspace-checklists"],
    queryFn: async () => {
      const response = await fetch("/api/checklists", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Checklists could not be loaded.");
      }

      const data = (await response.json()) as {
        checklists: Checklist[];
      };

      return data.checklists;
    },
  });

  // Dependency query
  const dependenciesQuery = useQuery<TaskDependency[]>({
    queryKey: ["workspace-dependencies"],
    queryFn: async () => {
      const response = await fetch("/api/dependencies", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Dependencies could not be loaded.");
      }

      const data = (await response.json()) as {
        dependencies: TaskDependency[];
      };

      return data.dependencies;
    },
  });

  useEffect(() => {
    if (createSignal) {
      setDraft(emptyDraft());
    }
  }, [createSignal]);

  // Existing task create/edit behavior is preserved.
  const saveTask = useMutation({
    mutationFn: async (payload: TaskDraft) => {
      const method = payload.task_id ? "PUT" : "POST";

      const target = payload.task_id
        ? `/api/tasks/${encodeURIComponent(payload.task_id)}`
        : "/api/tasks";

      const response = await fetch(target, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          project_id: payload.project_id,
          title: payload.title.trim(),
          description: payload.description.trim(),
          status: payload.status,
          priority: payload.priority,
          due_date: payload.due_date || null,
          assignee_id: payload.assignee_id || null,
          metadata: {},
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(body?.message || "Task could not be saved.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-tasks"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["workspace-dashboard"],
      });

      setDraft(null);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Task could not be deleted.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-tasks"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["workspace-dashboard"],
      });
    },
  });

  // Kanban quick status transition. The backend accepts partial TaskUpdate
  // payloads, so only the status field is sent.
  const moveTaskStatus = useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: MoveTaskStatusPayload) => {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(
          body?.message || "Task status could not be updated."
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-tasks"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["workspace-dashboard"],
      });
    },
  });

  // Checklist CRUD mutations.
  const saveChecklist = useMutation({
    mutationFn: async (payload: {
      task_id: string;
      title: string;
      items: { content: string; is_completed?: boolean; order_num?: number }[];
    }) => {
      const method = checklistDraft ? "PUT" : "POST";
      const target = checklistDraft
        ? `/api/checklists/${encodeURIComponent(checklistDraft.checklist_id)}`
        : "/api/checklists";

      const response = await fetch(target, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(
          body?.message || "Checklist could not be saved."
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-checklists"],
      });
      setShowChecklistForm(false);
      setChecklistDraft(null);
    },
  });

  const deleteChecklist = useMutation({
    mutationFn: async (checklistId: string) => {
      const response = await fetch(
        `/api/checklists/${encodeURIComponent(checklistId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Checklist could not be deleted.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-checklists"],
      });
    },
  });

  // Dependency CRUD mutations.
  const saveDependency = useMutation({
    mutationFn: async (payload: {
      task_id: string;
      depends_on_id: string;
      dependency_type: "blocks" | "blocked_by";
    }) => {
      const method = dependencyDraft ? "PUT" : "POST";
      const target = dependencyDraft
        ? `/api/dependencies/${encodeURIComponent(dependencyDraft.id)}`
        : "/api/dependencies";

      const response = await fetch(target, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(
          body?.message || "Dependency could not be saved."
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-dependencies"],
      });
      setShowDependencyForm(false);
      setDependencyDraft(null);
    },
  });

  const deleteDependency = useMutation({
    mutationFn: async (dependencyId: string) => {
      const response = await fetch(
        `/api/dependencies/${encodeURIComponent(dependencyId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Dependency could not be deleted.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-dependencies"],
      });
    },
  });

  const handleEditDependency = (dependency: TaskDependency) => {
    setDependencyDraft(dependency);
    setShowDependencyForm(true);
  };

  // Fetch individual checklist (with items) before editing.
  const handleEditChecklist = async (checklist: Checklist) => {
    try {
      const response = await fetch(
        `/api/checklists/${encodeURIComponent(checklist.checklist_id)}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Checklist could not be loaded.");
      }

      const data = (await response.json()) as { checklist: Checklist };
      setChecklistDraft(data.checklist);
      setShowChecklistForm(true);
    } catch (err) {
      console.error(err);
    }
  };

  const tasks = tasksQuery.data ?? [];

  // Apply both project and scope filters before either view is rendered.
  const scopedTasks = useMemo(() => {
    const projectTasks = projectId
      ? tasks.filter((task) => task.project_id === projectId)
      : tasks;

    return scope === "mine"
      ? projectTasks.filter(
          (task) => task.assignee_id === currentUserId
        )
      : projectTasks;
  }, [currentUserId, projectId, scope, tasks]);

  // The list honors the selected status filter.
  const visibleTasks = useMemo(
    () =>
      filter === "all"
        ? scopedTasks
        : scopedTasks.filter((task) => task.status === filter),
    [filter, scopedTasks]
  );

  // The board deliberately ignores the status filter.
  const boardTasks = useMemo(
    () => ({
      todo: scopedTasks.filter((task) => task.status === "todo"),
      in_progress: scopedTasks.filter(
        (task) => task.status === "in_progress"
      ),
      blocked: scopedTasks.filter(
        (task) => task.status === "blocked"
      ),
      done: scopedTasks.filter((task) => task.status === "done"),
    }),
    [scopedTasks]
  );

  // Filter checklists by whether their task belongs to the scoped task set.
  const scopedChecklists = useMemo(() => {
    const allChecklists = checklistsQuery.data ?? [];
    const scopedTaskIds = new Set(scopedTasks.map((task) => task.task_id));
    return allChecklists.filter((checklist) =>
      scopedTaskIds.has(checklist.task_id)
    );
  }, [checklistsQuery.data, scopedTasks]);

  // Filter dependencies by whether their task belongs to the scoped task set.
  const scopedDependencies = useMemo(() => {
    const allDeps = dependenciesQuery.data ?? [];
    const scopedTaskIds = new Set(scopedTasks.map((task) => task.task_id));
    return allDeps.filter(
      (dep) =>
        scopedTaskIds.has(dep.task_id) ||
        scopedTaskIds.has(dep.depends_on_id)
    );
  }, [dependenciesQuery.data, scopedTasks]);

  const projectName = (id: string) =>
    projectsQuery.data?.find(
      (project) => project.project_id === id
    )?.name || "Unassigned project";

  const openEdit = (task: Task) => {
    setDraft({
      task_id: task.task_id,
      project_id: task.project_id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: dateForInput(task.due_date),
      assignee_id: task.assignee_id || "",
    });
  };

  const updateDraft = <K extends keyof TaskDraft>(
    key: K,
    value: TaskDraft[K]
  ) => {
    setDraft((current) =>
      current ? { ...current, [key]: value } : current
    );
  };

  const isMyWork = scope === "mine";

  const handleDeleteTask = (task: Task) => {
    if (
      window.confirm(
        `Delete "${task.title}"? This cannot be undone.`
      )
    ) {
      deleteTask.mutate(task.task_id);
    }
  };

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">
            {isMyWork
              ? "WORK · ASSIGNED TO YOU"
              : "WORK · TASK SYSTEM"}
          </span>

          <h1>
            {isMyWork
              ? "My work, without the noise."
              : "One work source. Clear lenses."}
          </h1>

          <p>
            {isMyWork
              ? "Tasks assigned to your account, using the same task records as every project view."
              : "Switch between a detailed task list and a visual Kanban board."}
          </p>
        </div>

        <button
          type="button"
          className="pm-button pm-button-primary"
          onClick={() => setDraft(emptyDraft())}
        >
          <Icon name="plus" size={15} />
          New task
        </button>
      </div>

      <section className="pm-glass-panel pm-task-surface">
        <div
          className="pm-filter-tabs"
          role="group"
          aria-label="Workspace tabs"
          style={{ marginBottom: "12px" }}
        >
          <button
            type="button"
            className={activeTab === "tasks" ? "is-active" : ""}
            aria-pressed={activeTab === "tasks"}
            onClick={() => setActiveTab("tasks")}
          >
            Tasks
          </button>
          <button
            type="button"
            className={activeTab === "checklists" ? "is-active" : ""}
            aria-pressed={activeTab === "checklists"}
            onClick={() => setActiveTab("checklists")}
          >
            Checklists
          </button>
          <button
            type="button"
            className={activeTab === "dependencies" ? "is-active" : ""}
            aria-pressed={activeTab === "dependencies"}
            onClick={() => setActiveTab("dependencies")}
          >
            Dependencies
          </button>
        </div>

        {activeTab === "tasks" && (
          <>
            <div
              className="pm-task-toolbar"
              style={{
                flexWrap: "wrap",
              }}
            >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              minWidth: 0,
            }}
          >
            <div className="pm-filter-tabs" role="group" aria-label="Filter tasks by status">
              {(
                ["all", "todo", "in_progress", "blocked", "done"] as const
              ).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={filter === item ? "is-active" : ""}
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {item === "all" ? "All work" : statusLabels[item]}
                </button>
              ))}
            </div>

            <div
              className="pm-filter-tabs"
              role="group"
              aria-label="Task view"
            >
              <button
                type="button"
                className={viewMode === "list" ? "is-active" : ""}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                <Icon name="list" size={12} />
                List
              </button>

              <button
                type="button"
                className={viewMode === "board" ? "is-active" : ""}
                aria-pressed={viewMode === "board"}
                onClick={() => setViewMode("board")}
              >
                <Icon name="tasks" size={12} />
                Board
              </button>
            </div>
          </div>

          <span className="pm-task-count" aria-live="polite">
            {viewMode === "list"
              ? visibleTasks.length
              : scopedTasks.length}{" "}
            {(viewMode === "list"
              ? visibleTasks.length
              : scopedTasks.length) === 1
              ? "task"
              : "tasks"}
          </span>
        </div>

        {tasksQuery.isLoading ? (
          <div className="pm-skeleton-list">
            <i />
            <i />
            <i />
            <i />
          </div>
        ) : tasksQuery.error ? (
          <div className="pm-state-card pm-error-state">
            <Icon name="shield" size={18} />

            <div>
              <strong>Tasks could not be loaded.</strong>
              <span>Check the connection and try again.</span>
            </div>

            <button
              type="button"
              className="pm-button pm-button-small"
              onClick={() => void tasksQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : viewMode === "list" ? (
          // Existing list view: filter behavior and CRUD actions preserved.
          <div className="pm-task-table">
            <div className="pm-task-head">
              <span>Task</span>
              <span>Project</span>
              <span>Due</span>
              <span>Status</span>
              <span />
            </div>

            {visibleTasks.length ? (
              visibleTasks.map((task) => (
                <div className="pm-task-row" key={task.task_id}>
                  <div className="pm-task-title">
                    <i
                      className={`pm-priority-dot ${task.priority}`}
                      title={`${priorityLabels[task.priority]} priority`}
                    />

                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        {task.description || "No description"}
                      </small>
                    </div>
                  </div>

                  <span className="pm-project-name">
                    {projectName(task.project_id)}
                  </span>

                  <span className="pm-date">
                    {dateLabel(task.due_date)}
                  </span>

                  <span className={`pm-status ${task.status}`}>
                    <i />
                    {statusLabels[task.status]}
                  </span>

                  <div className="pm-row-actions">
                    <button
                      type="button"
                      onClick={() => openEdit(task)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => handleDeleteTask(task)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="pm-empty-row">
                <Icon name="check" size={18} />

                <div>
                  <strong>No matching tasks</strong>
                  <span>Change the filter or create a task.</span>
                </div>

                <button
                  type="button"
                  className="pm-button pm-button-small"
                  onClick={() => setDraft(emptyDraft())}
                >
                  Create task
                </button>
              </div>
            )}
          </div>
        ) : (
          // Kanban board: scope and project filters apply, status filter does not.
          <div
            style={{
              overflowX: "auto",
              padding: "12px",
            }}
          >
            {moveTaskStatus.error ? (
              <p
                className="pm-inline-error"
                role="alert"
                style={{ margin: "0 0 12px" }}
              >
                {moveTaskStatus.error.message}
              </p>
            ) : null}

            <div
              className="pm-kanban-board"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(225px, 1fr))",
                gap: "12px",
                minWidth: "960px",
                alignItems: "start",
              }}
            >
              {boardStatuses.map((status) => {
                const columnTasks = boardTasks[status];

                return (
                  <section
                    key={status}
                    className="pm-glass-panel"
                    aria-label={`${statusLabels[status]} tasks`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      minWidth: 0,
                      minHeight: "260px",
                      padding: "11px",
                    }}
                  >
                    <header
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        padding: "2px 2px 9px",
                        borderBottom: "1px solid var(--pm-border)",
                      }}
                    >
                      <span className={`pm-status ${status}`}>
                        <i />
                        <strong>{statusLabels[status]}</strong>
                      </span>

                      <span className="pm-task-count">
                        {columnTasks.length}
                      </span>
                    </header>

                    {columnTasks.length ? (
                      columnTasks.map((task) => (
                        <article
                          key={task.task_id}
                          className="pm-task-row pm-glass-panel"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "stretch",
                            gap: "9px",
                            padding: "11px",
                            minHeight: 0,
                            borderBottom: "1px solid var(--pm-border)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                color: "var(--pm-text-secondary)",
                                fontSize: "9px",
                              }}
                            >
                              <i
                                className={`pm-priority-dot ${task.priority}`}
                                title={`${priorityLabels[task.priority]} priority`}
                              />
                              {priorityLabels[task.priority]}
                            </span>

                            <span
                              style={{
                                padding: "3px 6px",
                                border: "1px solid var(--pm-border)",
                                borderRadius: "var(--pm-radius-sm)",
                                background: "var(--pm-accent-soft)",
                                color: "var(--pm-text-secondary)",
                                fontSize: "9px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Due {dateLabel(task.due_date)}
                            </span>
                          </div>

                          <strong
                            style={{
                              color: "var(--pm-text)",
                              fontSize: "11px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {task.title}
                          </strong>

                          <p
                            style={{
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 2,
                              overflow: "hidden",
                              margin: 0,
                              color: "var(--pm-text-muted)",
                              fontSize: "9px",
                              lineHeight: 1.5,
                              minHeight: "27px",
                            }}
                          >
                            {task.description || "No description"}
                          </p>

                          <span
                            className="pm-project-name"
                            title={projectName(task.project_id)}
                            style={{
                              fontSize: "9px",
                            }}
                          >
                            {projectName(task.project_id)}
                          </span>

                          <span className={`pm-status ${task.status}`}>
                            <i />
                            {statusLabels[task.status]}
                          </span>

                          <label
                            style={{
                              display: "grid",
                              gap: "5px",
                              color: "var(--pm-text-muted)",
                              fontSize: "8px",
                            }}
                          >
                            Move to status

                            <select
                              aria-label={`Move ${task.title} to status`}
                              value={task.status}
                              disabled={moveTaskStatus.isPending}
                              onChange={(event) => {
                                const nextStatus = event.target.value as TaskStatus;

                                if (nextStatus !== task.status) {
                                  moveTaskStatus.mutate({
                                    taskId: task.task_id,
                                    status: nextStatus,
                                  });
                                }
                              }}
                              style={{
                                width: "100%",
                                minHeight: "29px",
                                padding: "4px 7px",
                                border: "1px solid var(--pm-border)",
                                borderRadius: "var(--pm-radius-sm)",
                                background: "var(--pm-glass-strong)",
                                color: "var(--pm-text)",
                                font: "inherit",
                                fontSize: "9px",
                              }}
                            >
                              {boardStatuses.map((option) => (
                                <option key={option} value={option}>
                                  {statusLabels[option]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div
                            className="pm-row-actions"
                            style={{
                              justifyContent: "flex-start",
                              paddingTop: "4px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => openEdit(task)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => handleDeleteTask(task)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          placeItems: "center",
                          minHeight: "105px",
                          padding: "12px",
                          border: "1px dashed var(--pm-border)",
                          borderRadius: "var(--pm-radius)",
                          color: "var(--pm-text-muted)",
                          fontSize: "10px",
                        }}
                      >
                        No tasks
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

        {activeTab === "checklists" && (
          <div style={{ padding: "12px 0" }}>
            <div
              className="pm-task-toolbar"
              style={{ flexWrap: "wrap", marginBottom: "12px" }}
            >
              <button
                type="button"
                className="pm-button pm-button-primary"
                onClick={() => {
                  setChecklistDraft(null);
                  setShowChecklistForm(true);
                }}
              >
                <Icon name="plus" size={15} />
                New checklist
              </button>

              <span className="pm-task-count" aria-live="polite">
                {scopedChecklists.length}{" "}
                {scopedChecklists.length === 1 ? "checklist" : "checklists"}
              </span>
            </div>

            {checklistsQuery.isLoading ? (
              <div className="pm-skeleton-list">
                <i />
                <i />
                <i />
              </div>
            ) : checklistsQuery.error ? (
              <div className="pm-state-card pm-error-state">
                <Icon name="shield" size={18} />
                <div>
                  <strong>Checklists could not be loaded.</strong>
                  <span>Check the connection and try again.</span>
                </div>
                <button
                  type="button"
                  className="pm-button pm-button-small"
                  onClick={() => void checklistsQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <ChecklistList
                checklists={scopedChecklists}
                tasks={scopedTasks}
                onEdit={handleEditChecklist}
                onDelete={(id) => deleteChecklist.mutate(id)}
              />
            )}
          </div>
        )}

        {activeTab === "dependencies" && (
          <div style={{ padding: "12px 0" }}>
            <div
              className="pm-task-toolbar"
              style={{ flexWrap: "wrap", marginBottom: "12px" }}
            >
              <button
                type="button"
                className="pm-button pm-button-primary"
                onClick={() => {
                  setDependencyDraft(null);
                  setShowDependencyForm(true);
                }}
              >
                <Icon name="plus" size={15} />
                New dependency
              </button>

              <span className="pm-task-count" aria-live="polite">
                {scopedDependencies.length}{" "}
                {scopedDependencies.length === 1
                  ? "dependency"
                  : "dependencies"}
              </span>
            </div>

            {dependenciesQuery.isLoading ? (
              <div className="pm-skeleton-list">
                <i />
                <i />
                <i />
              </div>
            ) : dependenciesQuery.error ? (
              <div className="pm-state-card pm-error-state">
                <Icon name="shield" size={18} />
                <div>
                  <strong>Dependencies could not be loaded.</strong>
                  <span>Check the connection and try again.</span>
                </div>
                <button
                  type="button"
                  className="pm-button pm-button-small"
                  onClick={() => void dependenciesQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <DependencyList
                dependencies={scopedDependencies}
                tasks={scopedTasks}
                onEdit={handleEditDependency}
                onDelete={(id) => deleteDependency.mutate(id)}
              />
            )}
          </div>
        )}
      </section>

      {draft ? (
        <div className="pm-dialog-backdrop" role="presentation">
          <section
            className="pm-task-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
          >
            <div className="pm-dialog-heading">
              <div>
                <span className="pm-eyebrow">
                  {draft.task_id ? "EDIT TASK" : "FAST TASK CAPTURE"}
                </span>

                <h2 id="task-dialog-title">
                  {draft.task_id ? "Edit task" : "Create task"}
                </h2>
              </div>

              <button
                type="button"
                className="pm-icon-button"
                aria-label="Close task editor"
                onClick={() => setDraft(null)}
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();

                if (!draft.title.trim() || !draft.project_id) {
                  return;
                }

                saveTask.mutate(draft);
              }}
            >
              <div className="pm-form-grid">
                <label className="pm-field pm-field-wide">
                  <span>Task title</span>
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={(event) =>
                      updateDraft("title", event.target.value)
                    }
                    placeholder="What needs to happen?"
                    required
                  />
                </label>

                <label className="pm-field">
                  <span>Project</span>
                  <select
                    value={draft.project_id}
                    onChange={(event) =>
                      updateDraft("project_id", event.target.value)
                    }
                    required
                  >
                    <option value="">Select a project</option>

                    {(projectsQuery.data ?? []).map((project) => (
                      <option
                        key={project.project_id}
                        value={project.project_id}
                      >
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pm-field">
                  <span>Due date</span>
                  <input
                    type="datetime-local"
                    value={draft.due_date}
                    onChange={(event) =>
                      updateDraft("due_date", event.target.value)
                    }
                  />
                </label>

                <label className="pm-field">
                  <span>Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      updateDraft(
                        "status",
                        event.target.value as TaskStatus
                      )
                    }
                  >
                    {(Object.keys(statusLabels) as TaskStatus[]).map(
                      (status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="pm-field">
                  <span>Priority</span>
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      updateDraft(
                        "priority",
                        event.target.value as TaskPriority
                      )
                    }
                  >
                    {(Object.keys(priorityLabels) as TaskPriority[]).map(
                      (priority) => (
                        <option key={priority} value={priority}>
                          {priorityLabels[priority]}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="pm-field pm-field-wide">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={draft.description}
                    onChange={(event) =>
                      updateDraft("description", event.target.value)
                    }
                    placeholder="Add useful context, acceptance criteria, or a decision note."
                  />
                </label>
              </div>

              {saveTask.error ? (
                <p className="pm-inline-error" role="alert">
                  {saveTask.error.message}
                </p>
              ) : null}

              <div className="pm-dialog-actions">
                <button
                  type="button"
                  className="pm-button pm-button-quiet"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="pm-button pm-button-primary"
                  disabled={
                    saveTask.isPending ||
                    !draft.title.trim() ||
                    !draft.project_id
                  }
                >
                  {saveTask.isPending
                    ? "Saving…"
                    : draft.task_id
                      ? "Save changes"
                      : "Create task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {showChecklistForm ? (
        <ChecklistForm
          checklist={checklistDraft}
          taskOptions={scopedTasks}
          onSubmit={(data) => saveChecklist.mutate(data)}
          onCancel={() => {
            setShowChecklistForm(false);
            setChecklistDraft(null);
          }}
        />
      ) : null}

      {showDependencyForm ? (
        <DependencyForm
          dependency={dependencyDraft}
          taskOptions={scopedTasks}
          existingDependencies={dependenciesQuery.data ?? []}
          onSubmit={(data) => saveDependency.mutate(data)}
          onCancel={() => {
            setShowDependencyForm(false);
            setDependencyDraft(null);
          }}
        />
      ) : null}
    </section>
  );
}
