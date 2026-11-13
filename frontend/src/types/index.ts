// Frontend Type Definitions
// Shared types between components - no external project imports

export interface User {
  user_id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
}

export interface Project {
  project_id: string;
  name: string;
  description: string;
  status: "active" | "archived";
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  task_id: string;
  project_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "normal" | "high" | "urgent";
  assignee_id: string | null;
  created_by: string;
  metadata: Record<string, unknown>;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}


export interface DashboardStats {
  total_tasks: number;
  status_counts: {
    todo: number;
    in_progress: number;
    done: number;
    blocked: number;
  };
  priority_counts: {
    low: number;
    normal: number;
    high: number;
    urgent: number;
  };
  due_soon: Array<{
    task_id: string;
    title: string;
    due_date: string;
    days_until_due: number;
  }>;
  due_soon_count: number;
  overdue_count: number;
  overdue: Array<{
    task_id: string;
    title: string;
    due_date: string;
  }>;
}

export interface Checklist {
  checklist_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  items?: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  item_id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  order_num: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  dependency_type: "blocks" | "blocked_by";
  created_at: string;
}
