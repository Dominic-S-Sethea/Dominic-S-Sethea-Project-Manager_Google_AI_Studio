import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCommitForm } from "../components/git/GitCommitForm";
import { getToken } from "../hooks/useAuth";
import { Icon } from "../components/layout/Icon";

interface GitCommit {
  commit_id: string;
  commit_hash: string;
  commit_message: string;
  task_id: string | null;
  author: string | null;
  committed_at: string;
  created_at: string;
}

export default function GitCommitsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["git-commits"],
    queryFn: async () => {
      const res = await fetch("/api/git/commits", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch commits");
      return res.json();
    },
  });

  const commits: GitCommit[] = data?.commits || [];

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">WORK · GIT ACTIVITY</span>
          <h1>Recorded commits.</h1>
          <p>Track git commits linked to project tasks.</p>
        </div>

        <button
          type="button"
          className="pm-button pm-button-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Icon name="plus" size={15} />
          {showForm ? "Hide Form" : "Record Commit"}
        </button>
      </div>

      <section className="pm-glass-panel pm-task-surface">
        {showForm && (
          <div style={{ padding: "12px", marginBottom: "12px" }}>
            <GitCommitForm
              onCommitRecorded={() => {
                queryClient.invalidateQueries({ queryKey: ["git-commits"] });
                setShowForm(false);
              }}
            />
          </div>
        )}

        {isLoading ? (
          <div className="pm-skeleton-list">
            <i />
            <i />
            <i />
          </div>
        ) : error ? (
          <div className="pm-state-card pm-error-state">
            <Icon name="shield" size={18} />
            <div>
              <strong>Commits could not be loaded.</strong>
              <span>Check the connection and try again.</span>
            </div>
          </div>
        ) : commits.length === 0 ? (
          <div className="pm-empty-state">
            <strong>No commits recorded yet</strong>
            <p>Click "Record Commit" to add one.</p>
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--pm-border)",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--pm-text-secondary)",
              }}
            >
              Recorded Commits ({commits.length})
            </div>
            <div>
              {commits.map((commit) => (
                <div
                  key={commit.commit_id}
                  className="pm-task-row"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <code
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "var(--pm-accent)",
                      }}
                    >
                      {commit.commit_hash.slice(0, 8)}
                    </code>
                    {commit.task_id && (
                      <span
                        className="pm-status done"
                        style={{ fontSize: "9px" }}
                      >
                        Task: {commit.task_id}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--pm-text)",
                      margin: 0,
                    }}
                  >
                    {commit.commit_message}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      fontSize: "9px",
                      color: "var(--pm-text-muted)",
                    }}
                  >
                    {commit.author && <span>By: {commit.author}</span>}
                    <span>
                      {new Date(commit.committed_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
