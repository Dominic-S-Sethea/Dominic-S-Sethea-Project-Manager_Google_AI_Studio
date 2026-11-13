import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { User } from "../../types";

interface UserFormData {
  username: string;
  email: string;
  role: string;
  status: string;
}

interface UserFormDialogProps {
  user: User | null;
  mode: "create" | "edit";
  onSave: (data: UserFormData) => void;
  onCancel: () => void;
}

const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: 36,
  padding: "8px 10px",
  border: "1px solid var(--pm-border)",
  borderRadius: 7,
  background: "var(--pm-glass)",
  color: "var(--pm-text)",
  fontSize: "10px",
};

export function UserFormDialog({ user, mode, onSave, onCancel }: UserFormDialogProps) {
  const isEdit = mode === "edit";
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "viewer");
  const [status, setStatus] = useState<string>(user?.status ?? "active");
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (!username.trim()) nextErrors.push("Username is required.");
    if (!email.trim()) nextErrors.push("Email is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.push("Enter a valid email address.");
    if (!role) nextErrors.push("Role is required.");
    if (!status) nextErrors.push("Status is required.");
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    onSave({ username: username.trim(), email: email.trim(), role, status });
  };

  return (
    <div className="pm-dialog-backdrop" role="presentation">
      <section className="pm-task-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" style={{ width: "min(448px, 100%)" }}>
        <header className="pm-dialog-header">
          <div>
            <h2 id="user-dialog-title" style={{ margin: 0, color: "var(--pm-text)", fontSize: "15px", fontWeight: 650 }}>
              {isEdit ? "Edit user" : "Create user"}
            </h2>
            <p style={{ margin: "5px 0 0", color: "var(--pm-text-muted)", fontSize: "9px" }}>
              {isEdit ? "Update the user's profile and account settings." : "Add a new user to the system."}
            </p>
          </div>
          <button
            type="button"
            className="pm-icon-button"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="17" height="17">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="pm-form-grid">
            {errors.length > 0 && (
              <div className="pm-field-wide" role="alert" aria-live="polite">
                {errors.map((error, index) => (
                  <p className="pm-inline-error" key={`${error}-${index}`} style={{ marginTop: index === 0 ? 0 : 4 }}>
                    {error}
                  </p>
                ))}
              </div>
            )}
            <label className="pm-field pm-field-wide" htmlFor="user-form-username">
              <span>Username</span>
              <input
                id="user-form-username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                style={fieldStyle}
                placeholder="e.g. jdoe"
                autoComplete="username"
              />
            </label>
            <label className="pm-field pm-field-wide" htmlFor="user-form-email">
              <span>Email</span>
              <input
                id="user-form-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={fieldStyle}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="pm-field" htmlFor="user-form-role">
              <span>Role</span>
              <select id="user-form-role" value={role} onChange={(event) => setRole(event.target.value)} style={fieldStyle}>
                <option value="owner">Owner</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <label className="pm-field" htmlFor="user-form-status">
              <span>Status</span>
              <select id="user-form-status" value={status} onChange={(event) => setStatus(event.target.value)} style={fieldStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="pm-dialog-actions">
            <button type="button" className="pm-secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="pm-button pm-button-primary">
              {isEdit ? "Save changes" : "Create user"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default UserFormDialog;
