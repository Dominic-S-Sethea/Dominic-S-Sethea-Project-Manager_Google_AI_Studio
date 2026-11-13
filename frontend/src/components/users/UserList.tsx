import { useState } from "react";
import type { CSSProperties } from "react";
import type { User } from "../../types";
import { getToken } from "../../hooks/useAuth";

interface UserListProps {
  users: User[];
  currentUserRole: string;
  loading: boolean;
  onEdit: (user: User) => void;
  onNotify?: (type: "success" | "error", message: string) => void;
  onRefresh?: () => void;
}

const ROLES = ["owner", "editor", "viewer"];

const tableHeaderStyle: CSSProperties = {
  padding: "11px 16px",
  color: "var(--pm-text-muted)",
  fontSize: "8px",
  fontWeight: 650,
  letterSpacing: "0.09em",
  textAlign: "left",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const cellStyle: CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--pm-border)",
  color: "var(--pm-text-secondary)",
  fontSize: "10px",
  verticalAlign: "middle",
};

const controlStyle: CSSProperties = {
  minHeight: 30,
  padding: "5px 9px",
  border: "1px solid var(--pm-border)",
  borderRadius: "var(--pm-radius-sm)",
  background: "var(--pm-glass)",
  color: "var(--pm-text)",
  fontSize: "9px",
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  border: "1px solid var(--pm-border)",
  borderRadius: 999,
  background: "var(--pm-glass-soft)",
  color: "var(--pm-text-secondary)",
  fontSize: "8px",
  fontWeight: 600,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

export function UserList({ users, currentUserRole, loading, onEdit, onNotify, onRefresh }: UserListProps) {
  const [sortKey, setSortKey] = useState<"name" | "role" | "status" | "joined">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const sortedUsers = [...users].sort((a, b) => {
    let sortOrder = 0;
    switch (sortKey) {
      case "name":
        sortOrder = (a.username || "").localeCompare(b.username || "");
        break;
      case "role":
        sortOrder = (a.role || "").localeCompare(b.role || "");
        break;
      case "status": {
        const statusOrder: Record<string, number> = { active: 0, inactive: 1 };
        sortOrder = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
        break;
      }
      case "joined":
        sortOrder = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortDirection === "asc" ? sortOrder : -sortOrder;
  });

  const notify = (type: "success" | "error", message: string) => onNotify?.(type, message);

  const handleRoleChange = async (user: User, newRole: string) => {
    if (newRole === user.role) return;
    setUpdatingId(user.user_id);
    try {
      const response = await fetch(`/api/users/${user.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ role: newRole, status: user.status }),
      });
      let body: { message?: string } = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok) throw new Error(body.message || "Failed to update role");
      notify("success", `Role updated to ${newRole}`);
      onRefresh?.();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusToggle = async (user: User) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    setUpdatingId(user.user_id);
    try {
      const response = await fetch(`/api/users/${user.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ role: user.role, status: newStatus }),
      });
      let body: { message?: string } = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok) throw new Error(body.message || "Failed to update status");
      notify("success", `User ${newStatus === "active" ? "enabled" : "disabled"}`);
      onRefresh?.();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <section className="pm-glass-panel" aria-label="Loading users" aria-busy="true">
        <div className="pm-dialog-header">
          <span style={{ color: "var(--pm-text-muted)", fontSize: "9px" }}>Loading users</span>
        </div>
        <div className="pm-skeleton-list">
          {[0, 1, 2].map((item) => <i key={item} />)}
        </div>
      </section>
    );
  }

  if (users.length === 0) {
    return (
      <div className="pm-empty-state">
        <strong>No users found.</strong>
      </div>
    );
  }

  const canManage = (user: User) => currentUserRole === "owner" && user.role !== "owner";

  return (
    <section className="pm-glass-panel" aria-label="Users">
      <div className="pm-task-toolbar">
        <div className="pm-inline-form">
          <label htmlFor="user-sort-key" style={{ color: "var(--pm-text-secondary)", fontSize: "9px", fontWeight: 600 }}>
            Sort by
          </label>
          <select
            id="user-sort-key"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
            style={controlStyle}
          >
            <option value="name">Name</option>
            <option value="role">Role</option>
            <option value="status">Status</option>
            <option value="joined">Joined</option>
          </select>
          <button
            type="button"
            className="pm-secondary-button"
            onClick={() => setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))}
            aria-label={`Sort by ${sortKey} in ${sortDirection} order`}
          >
            {sortDirection === "asc" ? "↑ Ascending" : "↓ Descending"}
          </button>
        </div>
        <span className="pm-task-count">{users.length} user{users.length === 1 ? "" : "s"}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", textAlign: "left" }}>
          <thead style={{ background: "var(--pm-glass-soft)" }}>
            <tr>
              <th scope="col" style={tableHeaderStyle}>Name</th>
              <th scope="col" style={tableHeaderStyle}>Email</th>
              <th scope="col" style={tableHeaderStyle}>Last login</th>
              <th scope="col" style={tableHeaderStyle}>Role</th>
              <th scope="col" style={tableHeaderStyle}>Status</th>
              <th scope="col" style={tableHeaderStyle}>Joined</th>
              <th scope="col" style={{ ...tableHeaderStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => (
              <tr key={user.user_id}>
                <td style={cellStyle}>
                  <div style={{ color: "var(--pm-text)", fontSize: "10px", fontWeight: 620 }}>{user.username}</div>
                  <div style={{ color: "var(--pm-text-muted)", fontSize: "8px", marginTop: 3 }}>{user.email}</div>
                </td>
                <td style={cellStyle}>{user.email}</td>
                <td style={cellStyle}>{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : "—"}</td>
                <td style={cellStyle}>
                  {canManage(user) ? (
                    <select
                      value={user.role}
                      disabled={updatingId === user.user_id}
                      onChange={(event) => handleRoleChange(user, event.target.value)}
                      aria-label={`Change ${user.username}'s role`}
                      style={{ ...controlStyle, minHeight: 27, padding: "3px 7px", borderRadius: 999 }}
                    >
                      {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  ) : (
                    <span className="pm-status-pill" style={pillStyle}>{user.role}</span>
                  )}
                </td>
                <td style={cellStyle}>
                  <span
                    className="pm-status-pill"
                    style={{
                      ...pillStyle,
                      color: user.status === "active" ? "var(--pm-success)" : "var(--pm-danger)",
                    }}
                  >
                    {user.status}
                  </span>
                </td>
                <td style={cellStyle}>{new Date(user.created_at).toLocaleDateString()}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {canManage(user) ? (
                    <div className="pm-row-actions" style={{ justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(user)}
                        disabled={updatingId === user.user_id}
                        aria-label={`${user.status === "active" ? "Disable" : "Enable"} ${user.username}`}
                        style={{ color: user.status === "active" ? "var(--pm-danger)" : "var(--pm-success)" }}
                      >
                        {user.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button type="button" onClick={() => onEdit(user)} aria-label={`Edit ${user.username}`} style={{ color: "var(--pm-accent)" }}>
                        Edit
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "var(--pm-text-muted)", fontSize: "9px" }}>Owner</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, padding: "11px 16px", borderTop: "1px solid var(--pm-border)", color: "var(--pm-text-muted)", fontSize: "8px" }}>
        Note: a backend endpoint is needed to retrieve the last 3 login timestamps for full recent-login history.
      </p>
    </section>
  );
}
