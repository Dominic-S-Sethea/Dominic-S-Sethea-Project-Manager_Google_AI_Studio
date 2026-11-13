import type { Task } from "../../types";

interface TaskListProps { tasks: Task[]; onEdit: (task: Task) => void; onDelete: (id: string) => void; }
const label: Record<Task["status"], string> = { todo: "To do", in_progress: "In progress", done: "Done", blocked: "Blocked" };

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  if (!tasks.length) return <div className="pm-glass-panel pm-empty-state"><strong>No tasks yet</strong><p>Create the first task to establish a working set.</p></div>;
  return <div className="pm-glass-panel pm-task-table-wrap"><table className="pm-task-table"><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Due</th><th aria-label="Actions" /></tr></thead><tbody>{tasks.map((task) => <tr key={task.task_id}><td><button className="pm-task-title" onClick={() => onEdit(task)}><span className="pm-task-check" /><span><strong>{task.title}</strong><small>{task.description || "No description"}</small></span></button></td><td><span className={`pm-status-pill ${task.status}`}><i />{label[task.status]}</span></td><td><span className={`pm-priority ${task.priority}`}>{task.priority}</span></td><td className="pm-date">{task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}</td><td className="pm-table-actions"><button onClick={() => onEdit(task)}>Edit</button><button className="is-danger" onClick={() => onDelete(task.task_id)}>Delete</button></td></tr>)}</tbody></table></div>;
}
