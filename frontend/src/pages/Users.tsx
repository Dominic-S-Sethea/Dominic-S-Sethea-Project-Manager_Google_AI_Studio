import { useState, useEffect } from "react";
import { UserProfile } from "../components/users/UserProfile";
import { UserList } from "../components/users/UserList";
import { UserFormDialog } from "../components/users/UserFormDialog";
import { useAuth, getToken } from "../hooks/useAuth";
import { Icon } from "../components/layout/Icon";

interface User {
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

interface UserFormData {
  username: string;
  email: string;
  role: string;
  status: string;
}

const generateTempPassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (response.status === 403) {
        setUsers([]);
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch users";
      setError(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentProfile = async () => {
    try {
      const response = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch profile");
      }
      const data = await response.json();
      setCurrentUserProfile(data.user || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch profile";
      setError(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchCurrentProfile();
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setDialogMode("edit");
  };

  const handleSaveUser = async (data: UserFormData) => {
    try {
      const isEditing = Boolean(editingUser);
      const body: Record<string, unknown> = { ...data };
      if (!isEditing && tempPassword) {
        body.password = tempPassword;
      }
      const response = await fetch(
        isEditing ? `/api/users/${editingUser!.user_id}` : "/api/users",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(body),
        }
      );

      let responseBody: { message?: string; user?: User } = {};
      try {
        responseBody = await response.json();
      } catch {
        responseBody = {};
      }

      if (!response.ok) {
        throw new Error(responseBody.message || `Failed to ${isEditing ? "update" : "create"} user`);
      }

      const listResponse = await fetch("/api/users", { headers: { Authorization: `Bearer ${getToken()}` } });
      const listData = await listResponse.json();
      setUsers(listData.users || []);
      setError(null);
      setEditingUser(null);
      setDialogMode("create");
      if (!isEditing && tempPassword) {
        showToast("success", `User invited. Temporary password: ${tempPassword}`);
        setTempPassword(null);
      } else {
        showToast("success", isEditing ? "User updated" : "User created");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save user";
      setError(msg);
      showToast("error", msg);
    }
  };

  const handleCancelDialog = () => {
    setEditingUser(null);
    setDialogMode("create");
    setTempPassword(null);
  };

  const handleInviteUser = () => {
    const pwd = generateTempPassword();
    setTempPassword(pwd);
    setEditingUser(null);
    setDialogMode("create");
    showToast("success", `Temporary password generated: ${pwd}`);
  };

  return (
    <section className="pm-view">
      <div className="pm-view-heading">
        <div>
          <span className="pm-eyebrow">WORK · PEOPLE & ACCESS</span>
          <h1>User management.</h1>
          <p>Manage user profiles and track access.</p>
        </div>

        <button
          type="button"
          className="pm-button pm-button-primary"
          onClick={handleInviteUser}
        >
          <Icon name="plus" size={15} />
          Invite User
        </button>
      </div>

      {toast && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: "12px",
            borderRadius: "var(--pm-radius-sm)",
            background:
              toast.type === "success"
                ? "rgba(34,197,94,0.1)"
                : "rgba(239,68,68,0.1)",
            border:
              toast.type === "success"
                ? "1px solid rgba(34,197,94,0.3)"
                : "1px solid rgba(239,68,68,0.3)",
            color: toast.type === "success" ? "#22c55e" : "#ef4444",
            fontSize: "12px",
          }}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: "12px",
            borderRadius: "var(--pm-radius-sm)",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      <section className="pm-glass-panel pm-task-surface">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "16px",
          }}
        >
          <div>
            <UserList
              users={users}
              currentUserRole={currentUser?.role || "viewer"}
              loading={loading}
              onEdit={handleEditUser}
              onNotify={showToast}
              onRefresh={fetchUsers}
            />
          </div>
          <div>
            <UserProfile user={currentUserProfile} loading={loading} />
          </div>
        </div>

        <UserFormDialog
          user={editingUser}
          mode={dialogMode}
          onSave={handleSaveUser}
          onCancel={handleCancelDialog}
        />
      </section>
    </section>
  );
}
