import { getDb } from "../database/index.ts";
import { randomUUID } from "node:crypto";

export interface ExportData {
  projects: any[];
  tasks: any[];
  checklists: any[];
  checklist_items: any[];
  dependencies: any[];
  comments: any[];
  exported_at: string;
  version: string;
}

export class ImportExportService {
  exportJSON(maskPII: boolean = true): ExportData {
    const db = getDb();
    const projects = db.prepare("SELECT * FROM projects").all() as any[];
    const tasks = db.prepare("SELECT * FROM tasks").all() as any[];
    const checklists = db.prepare("SELECT * FROM checklists").all() as any[];
    const checklistItems = db.prepare("SELECT * FROM checklist_items").all() as any[];
    const dependencies = db.prepare("SELECT * FROM task_dependencies").all() as any[];
    const comments = db.prepare("SELECT * FROM comments").all() as any[];

    return {
      projects,
      tasks,
      checklists,
      checklist_items: checklistItems,
      dependencies,
      comments,
      exported_at: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  exportTasksCSV(maskPII: boolean = true): string {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.username as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN users u ON t.assignee_id = u.user_id
    `).all() as any[];

    const headers = ["task_id", "title", "description", "status", "priority", "project_name", "assignee_name", "due_date", "created_at", "updated_at"];
    const esc = (s: string) => '"' + (s || "").replace(/"/g, '""') + '"';
    const rows = tasks.map((t) => [
      t.task_id,
      esc(t.title),
      esc(t.description),
      t.status,
      t.priority,
      esc(t.project_name),
      maskPII ? (t.assignee_name ? "***" : "") : esc(t.assignee_name),
      t.due_date || "",
      t.created_at,
      t.updated_at,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  exportTasksMarkdown(maskPII: boolean = true): string {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.project_id
    `).all() as any[];

    const lines: string[] = [];
    lines.push("# Task Export");
    lines.push("");
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Total tasks: ${tasks.length}`);
    lines.push("");

    const statusGroups: Record<string, any[]> = {};
    for (const t of tasks) {
      if (!statusGroups[t.status]) statusGroups[t.status] = [];
      statusGroups[t.status]!.push(t);
    }

    for (const [status, group] of Object.entries(statusGroups)) {
      lines.push(`## ${status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")} (${group.length})`);
      lines.push("");
      for (const t of group) {
        lines.push(`### ${t.title}`);
        lines.push(`- **Project:** ${t.project_name || "N/A"}`);
        lines.push(`- **Priority:** ${t.priority}`);
        if (t.due_date) lines.push(`- **Due:** ${t.due_date}`);
        if (t.description) lines.push(`- **Description:** ${t.description}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  importJSON(data: any): { imported: { projects: number; tasks: number; checklists: number } } {
    const db = getDb();
    let projectsImported = 0;
    let tasksImported = 0;
    let checklistsImported = 0;

    for (const project of data.projects || []) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO projects (project_id, name, description, status, created_by, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          project.project_id,
          project.name,
          project.description,
          project.status || "active",
          project.created_by,
          project.metadata,
          project.created_at || new Date().toISOString(),
          project.updated_at || new Date().toISOString()
        );
        projectsImported++;
      } catch (e) {
        // Skip duplicates
      }
    }

    for (const task of data.tasks || []) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO tasks (task_id, project_id, title, description, status, priority, assignee_id, created_by, metadata, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.task_id,
          task.project_id,
          task.title,
          task.description,
          task.status || "todo",
          task.priority || "normal",
          task.assignee_id,
          task.created_by,
          task.metadata,
          task.due_date,
          task.created_at || new Date().toISOString(),
          task.updated_at || new Date().toISOString()
        );
        tasksImported++;
      } catch (e) {
        // Skip duplicates
      }
    }

    for (const checklist of data.checklists || []) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO checklists (checklist_id, task_id, title, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          checklist.checklist_id,
          checklist.task_id,
          checklist.title,
          checklist.is_completed || 0,
          checklist.created_at || new Date().toISOString(),
          checklist.updated_at || new Date().toISOString()
        );
        checklistsImported++;
      } catch (e) {
        // Skip duplicates
      }
    }

    for (const item of data.checklist_items || []) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO checklist_items (item_id, checklist_id, content, is_completed, order_num, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.item_id,
          item.checklist_id,
          item.content,
          item.is_completed || 0,
          item.order_num || 0,
          item.created_at || new Date().toISOString(),
          item.updated_at || new Date().toISOString()
        );
      } catch (e) {
        // Skip duplicates
      }
    }

    for (const dep of data.dependencies || []) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, dependency_type, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          dep.id,
          dep.task_id,
          dep.depends_on_id,
          dep.dependency_type,
          dep.created_at || new Date().toISOString()
        );
      } catch (e) {
        // Skip duplicates
      }
    }

    return {
      imported: {
        projects: projectsImported,
        tasks: tasksImported,
        checklists: checklistsImported,
      },
    };
  }

  exportPDF(): string {
    const db = getDb();
    const projects = db.prepare("SELECT * FROM projects").all() as any[];
    const tasks = db.prepare("SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.project_id").all() as any[];
    const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done");
    const done = tasks.filter((t: any) => t.status === "done");
    const inProgress = tasks.filter((t: any) => t.status === "in_progress");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Project Manager Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; }
  h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
  h2 { color: #334155; margin-top: 24px; }
  .stats { display: flex; gap: 16px; margin: 16px 0; }
  .stat { background: #f1f5f9; padding: 12px 20px; border-radius: 8px; text-align: center; }
  .stat .num { font-size: 24px; font-weight: bold; color: #2563eb; }
  .stat .label { font-size: 12px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #f8fafc; font-weight: 600; }
  tr:nth-child(even) { background: #f8fafc; }
  .overdue { color: #dc2626; font-weight: 600; }
  .status-done { color: #16a34a; }
  .status-todo { color: #64748b; }
  .status-in_progress { color: #d97706; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Project Manager Report</h1>
<p>Generated: ${new Date().toISOString()}</p>
<div class="stats">
  <div class="stat"><div class="num">${projects.length}</div><div class="label">Projects</div></div>
  <div class="stat"><div class="num">${tasks.length}</div><div class="label">Total Tasks</div></div>
  <div class="stat"><div class="num">${done.length}</div><div class="label">Completed</div></div>
  <div class="stat"><div class="num">${inProgress.length}</div><div class="label">In Progress</div></div>
  <div class="stat"><div class="num">${overdue.length}</div><div class="label">Overdue</div></div>
</div>
<h2>Projects</h2>
<table>
<tr><th>Name</th><th>Status</th><th>Created</th></tr>
${projects.map((p: any) => `<tr><td>${p.name}</td><td>${p.status}</td><td>${p.created_at}</td></tr>`).join("")}
</table>
<h2>Overdue Tasks</h2>
${overdue.length === 0 ? "<p>No overdue tasks.</p>" : `<table><tr><th>Title</th><th>Project</th><th>Due Date</th><th>Status</th></tr>${overdue.map((t: any) => `<tr><td class="overdue">${t.title}</td><td>${t.project_name || "N/A"}</td><td class="overdue">${t.due_date}</td><td>${t.status}</td></tr>`).join("")}</table>`}
<h2>All Tasks</h2>
<table>
<tr><th>Title</th><th>Project</th><th>Status</th><th>Priority</th><th>Due Date</th></tr>
${tasks.map((t: any) => `<tr><td>${t.title}</td><td>${t.project_name || "N/A"}</td><td class="status-${t.status}">${t.status}</td><td>${t.priority}</td><td>${t.due_date || "-"}</td></tr>`).join("")}
</table>
</body>
</html>`;
    return html;
  }

  exportXLSX(): string {
    const db = getDb();
    const tasks = db.prepare("SELECT t.*, p.name as project_name, u.username as assignee_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.project_id LEFT JOIN users u ON t.assignee_id = u.user_id").all() as any[];
    const headers = ["Task ID", "Title", "Description", "Status", "Priority", "Project", "Assignee", "Due Date", "Created At", "Updated At"];
    const rows = tasks.map((t: any) => [
      t.task_id,
      t.title || "",
      (t.description || "").replace(/[\t\n\r]/g, " "),
      t.status,
      t.priority,
      t.project_name || "",
      t.assignee_name || "",
      t.due_date || "",
      t.created_at,
      t.updated_at,
    ]);
    const tsv = [headers.join("\t"), ...rows.map((r: any) => r.map((c: any) => String(c).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t"))].join("\n");
    return "\uFEFF" + tsv;
  }

  exportProjectBundle(projectId: string): any {
    const db = getDb();
    const project = db.prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId) as any;
    if (!project) throw new Error("Project not found");
    const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(projectId) as any[];
    const taskIds = tasks.map((t: any) => t.task_id);
    const checklists = taskIds.length > 0
      ? db.prepare("SELECT * FROM checklists WHERE task_id IN (" + taskIds.map(() => "?").join(",") + ")").all(...taskIds) as any[]
      : [];
    const checklistIds = checklists.map((c: any) => c.checklist_id);
    const checklistItems = checklistIds.length > 0
      ? db.prepare("SELECT * FROM checklist_items WHERE checklist_id IN (" + checklistIds.map(() => "?").join(",") + ")").all(...checklistIds) as any[]
      : [];
    const dependencies = taskIds.length > 0
      ? db.prepare("SELECT * FROM task_dependencies WHERE task_id IN (" + taskIds.map(() => "?").join(",") + ")").all(...taskIds) as any[]
      : [];
    const comments = taskIds.length > 0
      ? db.prepare("SELECT * FROM comments WHERE task_id IN (" + taskIds.map(() => "?").join(",") + ")").all(...taskIds) as any[]
      : [];

    return {
      project,
      tasks,
      checklists,
      checklist_items: checklistItems,
      dependencies,
      comments,
      exported_at: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  importCSV(csvText: string, projectId: string, createdByParam: string): { imported: { tasks: number; skipped: number; errors: string[] } } {
    const db = getDb();
    let createdBy = createdByParam;
    // Ensure createdBy references a valid user
    const userCheck = db.prepare("SELECT user_id FROM users WHERE user_id = ?").get(createdBy);
    if (!userCheck) {
      const fallback = db.prepare("SELECT user_id FROM users LIMIT 1").get() as any;
      if (fallback) createdBy = fallback.user_id;
    }
    const lines = csvText.split("\n").filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV must have header and at least one data row");

    const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const titleIdx = headers.findIndex((h) => h.includes("title"));
    const descIdx = headers.findIndex((h) => h.includes("description"));
    const statusIdx = headers.findIndex((h) => h.includes("status"));
    const priorityIdx = headers.findIndex((h) => h.includes("priority"));
    const dueIdx = headers.findIndex((h) => h.includes("due"));

    if (titleIdx < 0) throw new Error("CSV must have a 'title' column");

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i]!);
      const title = cols[titleIdx] || "";
      if (!title) { skipped++; continue; }

      const taskId = randomUUID();
      const now = new Date().toISOString();
      try {
        db.prepare(`
          INSERT INTO tasks (task_id, project_id, title, description, status, priority, created_by, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          projectId,
          title,
          descIdx >= 0 ? cols[descIdx] || null : null,
          statusIdx >= 0 ? (cols[statusIdx] || "todo") : "todo",
          priorityIdx >= 0 ? (cols[priorityIdx] || "normal") : "normal",
          createdBy,
          dueIdx >= 0 ? cols[dueIdx] || null : null,
          now,
          now
        );
        imported++;
      } catch (e: any) {
        skipped++;
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    return { imported: { tasks: imported, skipped, errors } };
  }

  importProjectBundle(data: any, createdByParam: string): { imported: { project: string; tasks: number } } {
    const db = getDb();
    let createdBy = createdByParam;
    // Ensure createdBy references a valid user
    const userCheck = db.prepare("SELECT user_id FROM users WHERE user_id = ?").get(createdBy);
    if (!userCheck) {
      const fallback = db.prepare("SELECT user_id FROM users LIMIT 1").get() as any;
      if (fallback) createdBy = fallback.user_id;
    }
    if (!data || !data.project) throw new Error("Invalid bundle: missing project");

    const project = data.project;
    const projectId = project.project_id || randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO projects (project_id, name, description, status, created_by, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      project.name,
      project.description,
      project.status || "active",
      createdBy,
      project.metadata,
      project.created_at || now,
      project.updated_at || now
    );

    let tasksImported = 0;
    for (const task of (data.tasks || [])) {
      const taskId = task.task_id || randomUUID();
      try {
        db.prepare(`
          INSERT OR IGNORE INTO tasks (task_id, project_id, title, description, status, priority, assignee_id, created_by, metadata, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          projectId,
          task.title,
          task.description,
          task.status || "todo",
          task.priority || "normal",
          task.assignee_id,
          createdBy,
          task.metadata,
          task.due_date,
          task.created_at || now,
          task.updated_at || now
        );
        tasksImported++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Import checklists and items
    for (const cl of (data.checklists || [])) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO checklists (checklist_id, task_id, title, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          cl.checklist_id || randomUUID(),
          cl.task_id,
          cl.title,
          cl.is_completed || 0,
          cl.created_at || now,
          cl.updated_at || now
        );
      } catch (e) {
        // Skip duplicates
      }
    }

    for (const item of (data.checklist_items || [])) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO checklist_items (item_id, checklist_id, content, is_completed, order_num, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.item_id || randomUUID(),
          item.checklist_id,
          item.content,
          item.is_completed || 0,
          item.order_num || 0,
          item.created_at || now,
          item.updated_at || now
        );
      } catch (e) {
        // Skip duplicates
      }
    }

    return { imported: { project: projectId, tasks: tasksImported } };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}

export const importExportService = new ImportExportService();