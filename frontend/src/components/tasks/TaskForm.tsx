import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { getToken } from "../../hooks/useAuth";
import { Icon } from "../layout/Icon";

interface TaskFormProps {
  task: Task | null;
  onSubmit: (data: { project_id: string; title: string; description: string; status: "todo" | "in_progress" | "done" | "blocked"; priority: "low" | "normal" | "high" | "urgent"; assignee_id: string | null; due_date: string | null }) => void;
  onCancel: () => void;
}

const statusOptions = [["todo", "To do"], ["in_progress", "In progress"], ["done", "Done"], ["blocked", "Blocked"]] as const;
const priorityOptions = [["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]] as const;

function toDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<Task["status"]>(task?.status || "todo");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority || "normal");
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || "");
  const [dueDate, setDueDate] = useState(toDateTimeInput(task?.due_date));
  const [projectId, setProjectId] = useState(task?.project_id || "");
  const [projects, setProjects] = useState<Array<{ project_id: string; name: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch("/api/projects", { headers: { Authorization: `Bearer ${getToken()}` } });
        if (!response.ok) return;
        const body = await response.json() as { projects: Array<{ project_id: string; name: string }> };
        setProjects(body.projects || []);
        if (!task?.project_id && body.projects?.length === 1) setProjectId(body.projects[0].project_id);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, [task?.project_id]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ project_id: projectId, title: title.trim(), description: description.trim(), status, priority, assignee_id: assigneeId.trim() || null, due_date: dueDate ? new Date(dueDate).toISOString() : null });
  };

  return <div className="pm-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
    <section className="pm-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="pm-dialog-header"><div><div className="pm-menu-kicker">Task</div><h2 id="task-dialog-title">{task ? "Edit task" : "New task"}</h2></div><button className="pm-icon-button" onClick={onCancel} aria-label="Close task form"><Icon name="close" /></button></header>
      <form onSubmit={submit} className="pm-form-grid">
        <label className="pm-field pm-field-wide"><span>Title <b>*</b></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe the outcome" required autoFocus /></label>
        <label className="pm-field"><span>Project <b>*</b></span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} required disabled={loadingProjects}><option value="">{loadingProjects ? "Loading projects…" : "Select a project"}</option>{projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.name}</option>)}</select></label>
        <label className="pm-field"><span>Due date</span><input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="pm-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as Task["status"])}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="pm-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])}>{priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="pm-field pm-field-wide"><span>Assignee ID <em>optional</em></span><input value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} placeholder="Add an existing user ID" /></label>
        <label className="pm-field pm-field-wide"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Add context, acceptance criteria, or a decision record." /></label>
        {!loadingProjects && projects.length === 0 ? <p className="pm-form-help pm-field-wide">No projects are available yet. Create a project before creating a task.</p> : null}
        <footer className="pm-dialog-actions pm-field-wide"><button type="button" className="pm-secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="pm-primary-button" disabled={!projectId}>{task ? "Save task" : "Create task"}</button></footer>
      </form>
    </section>
  </div>;
}
