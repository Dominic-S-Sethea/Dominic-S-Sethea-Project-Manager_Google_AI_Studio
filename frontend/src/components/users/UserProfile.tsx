import type { CSSProperties } from "react";
import type { User } from "../../types";

interface UserProfileProps {
  user: User | null;
  loading: boolean;
}

const valueStyle: CSSProperties = {
  margin: 0,
  color: "var(--pm-text)",
  fontSize: "10px",
  fontWeight: 550,
  overflowWrap: "anywhere",
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  padding: "4px 8px",
  border: "1px solid var(--pm-border)",
  borderRadius: 999,
  background: "var(--pm-glass-soft)",
  color: "var(--pm-accent)",
  fontSize: "8px",
  fontWeight: 600,
};

export function UserProfile({ user, loading }: UserProfileProps) {
  if (loading) {
    return (
      <div className="pm-state-card" aria-live="polite" aria-busy="true">
        <span>Loading profile...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pm-empty-state">
        <strong>No profile data available.</strong>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="pm-glass-panel" aria-labelledby="user-profile-title">
      <header className="pm-dialog-header">
        <h2 id="user-profile-title" style={{ margin: 0, color: "var(--pm-text)", fontSize: "14px", fontWeight: 650 }}>
          Your Profile
        </h2>
      </header>

      <div style={{ padding: 18 }}>
        <div className="pm-form-grid">
          <div className="pm-field">
            <span>Name</span>
            <p style={valueStyle}>{user.username}</p>
          </div>
          <div className="pm-field">
            <span>Email</span>
            <p style={valueStyle}>{user.email}</p>
          </div>
          <div className="pm-field">
            <span>Role</span>
            <span className="pm-status-pill" style={pillStyle}>{user.role}</span>
          </div>
          <div className="pm-field">
            <span>Status</span>
            <span
              className="pm-status-pill"
              style={{ ...pillStyle, color: user.status === "active" ? "var(--pm-success)" : "var(--pm-danger)" }}
            >
              {user.status}
            </span>
          </div>
          <div className="pm-field">
            <span>Joined</span>
            <p style={valueStyle}>{formatDate(user.created_at)}</p>
          </div>
          {user.last_login_at && (
            <div className="pm-field">
              <span>Last login</span>
              <p style={valueStyle}>{formatDate(user.last_login_at)}</p>
            </div>
          )}
        </div>

        <section style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--pm-border)" }} aria-labelledby="user-access-tracking-title">
          <h3 id="user-access-tracking-title" style={{ margin: "0 0 12px", color: "var(--pm-text-secondary)", fontSize: "10px", fontWeight: 650 }}>
            Access tracking
          </h3>
          <div className="pm-form-grid">
            <div className="pm-field">
              <span>Last login</span>
              <p style={valueStyle}>{user.last_login_at ? formatDate(user.last_login_at) : "Not recorded"}</p>
            </div>
            <div className="pm-field">
              <span>IP Address</span>
              <p style={valueStyle}>{user.ip_address || "Not recorded"}</p>
            </div>
            <div className="pm-field">
              <span>Device</span>
              <p style={valueStyle}>{user.device_fingerprint || "Not recorded"}</p>
            </div>
            <p className="pm-form-help pm-field-wide" style={{ margin: 0 }}>
              A backend endpoint is needed to retrieve the last 3 login timestamps for full recent-login history.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
