import { useQuery } from "@tanstack/react-query";
import { getToken } from "../hooks/useAuth";
import type { DashboardStats, Task } from "../types";
import { Icon } from "../components/ui/Icon";

interface WorkspaceOverviewProps {
  onOpenWork: () => void;
  onNewTask: () => void;
}

const statusWeight: Record<Task["status"], number> = { blocked: 0, in_progress: 1, todo: 2, done: 3 };

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Due date unavailable";
  const today = new Date();
  const days = Math.ceil((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function taskStatusLabel(status: Task["status"]) {
  return { todo: "To do", in_progress: "In progress", done: "Done", blocked: "Blocked" }[status];
}

export default function WorkspaceOverview({ onOpenWork, onNewTask }: WorkspaceOverviewProps) {
  const dashboard = useQuery<DashboardStats>({
    queryKey: ["workspace-dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error("Dashboard data could not be loaded.");
      return response.json() as Promise<DashboardStats>;
    },
  });
  const tasksQuery = useQuery<Task[]>({
    queryKey: ["workspace-tasks"],
    queryFn: async () => {
      const response = await fetch("/api/tasks", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error("Tasks could not be loaded.");
      const body = await response.json() as { tasks: Task[] };
      return body.tasks;
    },
  });

  const tasks = tasksQuery.data ?? [];
  const focusTasks = [...tasks]
    .filter((task) => task.status !== "done")
    .sort((first, second) => statusWeight[first.status] - statusWeight[second.status] || (first.due_date ?? "9999").localeCompare(second.due_date ?? "9999"))
    .slice(0, 4);
  const stats = dashboard.data;
  const isLoading = dashboard.isLoading || tasksQuery.isLoading;
  const hasError = dashboard.error || tasksQuery.error;

  return (
    <section className="pm-view">
      <div className="pm-view-heading"><div><span className="pm-eyebrow">OPERATE · TODAY</span><h1>Work should reveal the next decision.</h1><p>Blocked work and near-term action come first. The signals below use live task and dashboard data.</p></div><div className="pm-heading-actions"><button type="button" className="pm-button pm-button-quiet" onClick={onOpenWork}>Open work</button><button type="button" className="pm-button pm-button-primary" onClick={onNewTask}><Icon name="plus" size={15} />New task</button></div></div>
      {hasError ? <div className="pm-state-card pm-error-state"><Icon name="shield" size={18} /><div><strong>Workspace data could not be loaded.</strong><span>Check the connection, then try again.</span></div><button type="button" className="pm-button pm-button-small" onClick={() => { void dashboard.refetch(); void tasksQuery.refetch(); }}>Retry</button></div> : null}
      <div className="pm-overview-layout">
        <section className="pm-glass-panel pm-focus-panel"><div className="pm-panel-header"><div><h2>Focus queue</h2><p>Items most likely to change the work state today.</p></div><span className="pm-live-marker"><i />LIVE</span></div>{isLoading ? <div className="pm-skeleton-list"><i /><i /><i /><i /></div> : <div className="pm-focus-list">{focusTasks.length ? focusTasks.map((task) => <button type="button" className="pm-focus-row" key={task.task_id} onClick={onOpenWork}><span className={`pm-state-glyph ${task.status}`}><Icon name={task.status === "blocked" ? "close" : task.status === "in_progress" ? "activity" : "arrow"} size={13} /></span><span className="pm-focus-copy"><strong>{task.title}</strong><small>{dueLabel(task.due_date)} · {task.priority} priority</small></span><span className={`pm-status ${task.status}`}><i />{taskStatusLabel(task.status)}</span><Icon name="arrow" size={14} /></button>) : <div className="pm-empty-row"><Icon name="check" size={17} /><div><strong>No active tasks yet</strong><span>Create a task to start a focused work queue.</span></div><button type="button" className="pm-button pm-button-small" onClick={onNewTask}>Create task</button></div>}</div>}</section>
        <aside className="pm-overview-dock"><section className="pm-glass-panel pm-signal-panel"><div className="pm-panel-header"><div><h2>Project pulse</h2><p>Actual aggregate task state</p></div></div>{isLoading ? <div className="pm-signal-skeleton" /> : <div className="pm-signal-grid"><div><small>Open</small><strong>{Math.max(0, (stats?.total_tasks ?? 0) - (stats?.status_counts.done ?? 0))}</strong></div><div><small>In progress</small><strong>{stats?.status_counts.in_progress ?? 0}</strong></div><div><small>Blocked</small><strong className="is-danger">{stats?.status_counts.blocked ?? 0}</strong></div><div><small>Due soon</small><strong className="is-warning">{stats?.due_soon_count ?? 0}</strong></div></div>}</section><section className="pm-glass-panel pm-attention-panel"><span className="pm-eyebrow">ATTENTION DESIGN</span><h2>Human decisions stay visible.</h2><p>Approval and automation surfaces are intentionally separate from task movement. The proposed Automation Studio makes consequences and node data inspectable.</p><button type="button" className="pm-inline-link" onClick={onOpenWork}>Review task context <Icon name="arrow" size={14} /></button></section></aside>
      </div>
      <section className="pm-glass-panel pm-activity-panel"><div className="pm-panel-header"><div><h2>Current work state</h2><p>One source of truth, shown as operational signals instead of decorative metric cards.</p></div><button type="button" className="pm-button pm-button-quiet pm-button-small" onClick={onOpenWork}>View all tasks</button></div><div className="pm-state-strip"><div><span className="pm-strip-icon"><Icon name="list" size={16} /></span><div><small>Total tasks</small><strong>{stats?.total_tasks ?? 0}</strong></div></div><div><span className="pm-strip-icon"><Icon name="activity" size={16} /></span><div><small>In progress</small><strong>{stats?.status_counts.in_progress ?? 0}</strong></div></div><div><span className="pm-strip-icon"><Icon name="check" size={16} /></span><div><small>Completed</small><strong>{stats?.status_counts.done ?? 0}</strong></div></div><div><span className="pm-strip-icon"><Icon name="branch" size={16} /></span><div><small>Urgent</small><strong>{stats?.priority_counts.urgent ?? 0}</strong></div></div></div></section>
    </section>
  );
}
