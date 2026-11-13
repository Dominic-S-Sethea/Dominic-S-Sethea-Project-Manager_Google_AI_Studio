import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.ts";

export interface GitCommit {
  commit_id: string;
  commit_hash: string;
  commit_message: string;
  task_id: string | null;
  author: string | null;
  committed_at: string;
  created_at: string;
}

export class GitService {
  parseTaskReferences(message: string): string[] {
    const taskIds: string[] = [];
    const patterns = [
      /(?:fixes|closes|resolves|completes)\s+#?([a-zA-Z0-9-]+)/gi,
      /#([a-zA-Z0-9-]+)/g,
      /task[:\s]+([a-zA-Z0-9-]+)/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const id = match[1];
        if (id && !taskIds.includes(id)) {
          taskIds.push(id);
        }
      }
    }
    return taskIds;
  }

  async recordCommit(
    commitHash: string,
    commitMessage: string,
    author?: string,
    committedAt?: string,
    autoClose: boolean = true
  ): Promise<{ commit: GitCommit; linkedTasks: string[]; closedTasks: string[] }> {
    const db = getDb();
    const now = new Date().toISOString();
    const commitId = uuidv4();
    const committedAtValue = committedAt || now;

    const taskRefs = this.parseTaskReferences(commitMessage);
    const linkedTasks: string[] = [];
    const closedTasks: string[] = [];

    const existingTaskIds: string[] = [];
    for (const taskId of taskRefs) {
      const task = db.prepare("SELECT task_id, status FROM tasks WHERE task_id = ?").get(taskId) as { task_id: string; status: string } | undefined;
      if (task) {
        existingTaskIds.push(taskId);
      }
    }

    const primaryTaskId = existingTaskIds.length > 0 ? existingTaskIds[0] : null;
    db.prepare(
      "INSERT INTO git_commits (commit_id, commit_hash, commit_message, task_id, author, committed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(commitId, commitHash, commitMessage, primaryTaskId as string | null, (author ?? null) as string | null, committedAtValue, now);

    for (const taskId of existingTaskIds) {
      linkedTasks.push(taskId);
      if (autoClose) {
        const task = db.prepare("SELECT status FROM tasks WHERE task_id = ?").get(taskId) as { status: string };
        if (task.status !== "done") {
          db.prepare("UPDATE tasks SET status = 'done', updated_at = ? WHERE task_id = ?").run(now, taskId);
          closedTasks.push(taskId);
        }
      }
    }

    for (let i = 1; i < existingTaskIds.length; i++) {
      const additionalCommitId = uuidv4();
      db.prepare(
        "INSERT INTO git_commits (commit_id, commit_hash, commit_message, task_id, author, committed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(additionalCommitId, commitHash, commitMessage, existingTaskIds[i]! as string, (author ?? null) as string | null, committedAtValue, now);
    }

    const commit: GitCommit = {
      commit_id: commitId,
      commit_hash: commitHash,
      commit_message: commitMessage,
      task_id: primaryTaskId as string | null,
      author: author ?? null,
      committed_at: committedAtValue,
      created_at: now,
    };

    return { commit, linkedTasks, closedTasks };
  }

  async getCommitsByTask(taskId: string): Promise<GitCommit[]> {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM git_commits WHERE task_id = ? ORDER BY committed_at DESC").all(taskId) as any[];
    return rows.map((r) => ({
      commit_id: r.commit_id,
      commit_hash: r.commit_hash,
      commit_message: r.commit_message,
      task_id: r.task_id,
      author: r.author,
      committed_at: r.committed_at,
      created_at: r.created_at,
    }));
  }

  async getAllCommits(limit: number = 50): Promise<GitCommit[]> {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM git_commits ORDER BY committed_at DESC LIMIT ?").all(limit) as any[];
    return rows.map((r) => ({
      commit_id: r.commit_id,
      commit_hash: r.commit_hash,
      commit_message: r.commit_message,
      task_id: r.task_id,
      author: r.author,
      committed_at: r.committed_at,
      created_at: r.created_at,
    }));
  }

  async linkCommitToTask(commitId: string, taskId: string): Promise<boolean> {
    const db = getDb();
    const result = db.prepare("UPDATE git_commits SET task_id = ? WHERE commit_id = ?").run(taskId, commitId);
    return result.changes > 0;
  }
}

export const gitService = new GitService();
