import { useState } from "react";
import type { FormEvent } from "react";
import { getToken } from "../../hooks/useAuth";

interface GitCommitResult {
  message: string;
  linked_tasks?: string[];
  closed_tasks?: string[];
}

interface GitCommitFormProps {
  onCommitRecorded?: (result: GitCommitResult) => void;
}

export function GitCommitForm({ onCommitRecorded }: GitCommitFormProps) {
  const [commitHash, setCommitHash] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<GitCommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/git/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          commit_hash: commitHash,
          commit_message: commitMessage,
          author: author || undefined,
          auto_close: true,
        }),
      });
      const data = await res.json() as GitCommitResult & { message?: string };
      if (!res.ok) {
        setError(data.message || "Failed to record commit");
        return;
      }
      setResult(data);
      setCommitHash("");
      setCommitMessage("");
      setAuthor("");
      onCommitRecorded?.(data);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const previewRefs = commitMessage
    ? commitMessage.match(/(?:fixes|closes|resolves|completes)\s+#?([a-zA-Z0-9-]+)/gi) || []
    : [];

  return (
    <div className="pm-view" style={{ maxWidth: "42rem", margin: "0 auto", padding: 0 }}>
      <section className="pm-glass-panel" aria-labelledby="git-commit-form-title">
        <header className="pm-dialog-header">
          <div>
            <h2 id="git-commit-form-title" style={{ margin: 0, color: "var(--pm-text)", fontSize: "16px", fontWeight: 660 }}>
              Record Git Commit
            </h2>
            <p style={{ margin: "6px 0 0", color: "var(--pm-text-secondary)", fontSize: "9px", lineHeight: 1.5 }}>
              Link a git commit to tasks. Use "fixes #TASK-ID" or "closes TASK-ID" in the message to auto-close tasks.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="pm-form-grid" style={{ padding: 16 }}>
          {error && <p className="pm-inline-error pm-field-wide" role="alert">{error}</p>}
          <label className="pm-field pm-field-wide" htmlFor="git-commit-hash">
            <span>Commit Hash *</span>
            <input
              id="git-commit-hash"
              type="text"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
              placeholder="e.g. abc123def456"
              required
            />
          </label>
          <label className="pm-field pm-field-wide" htmlFor="git-commit-message">
            <span>Commit Message *</span>
            <textarea
              id="git-commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="e.g. fixes #task-123: Fix login bug"
              rows={3}
              required
            />
            {previewRefs.length > 0 && (
              <span className="pm-form-help">Detected task references: {previewRefs.join(", ")}</span>
            )}
          </label>
          <label className="pm-field pm-field-wide" htmlFor="git-commit-author">
            <span>Author (optional)</span>
            <input
              id="git-commit-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </label>
          <div className="pm-dialog-actions pm-field-wide" style={{ marginTop: 0 }}>
            <button type="submit" className="pm-button pm-button-primary" disabled={loading}>
              {loading ? "Recording..." : "Record Commit"}
            </button>
          </div>
        </form>

        {result && (
          <div
            className="pm-state-card"
            role="status"
            style={{ margin: "0 16px 16px", borderColor: "var(--pm-success)", color: "var(--pm-success)" }}
          >
            <div>
              <strong style={{ color: "var(--pm-success)" }}>{result.message}</strong>
              {result.linked_tasks && result.linked_tasks.length > 0 && (
                <span style={{ display: "block", marginTop: 5, color: "var(--pm-text-secondary)" }}>
                  Linked tasks: {result.linked_tasks.join(", ")}
                </span>
              )}
              {result.closed_tasks && result.closed_tasks.length > 0 && (
                <span style={{ display: "block", marginTop: 3, color: "var(--pm-text-secondary)" }}>
                  Auto-closed: {result.closed_tasks.join(", ")}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default GitCommitForm;
