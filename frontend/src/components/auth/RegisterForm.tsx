import { useState } from "react";
import type { FormEvent } from "react";

interface RegisterFormProps {
  onSuccess: (user: {
    user_id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
  }, token?: string) => void;
  loading: boolean;
}

export default function RegisterForm({ onSuccess, loading }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const labels = ["Weak", "Fair", "Good", "Strong"];
    const colors = ["var(--pm-danger)", "var(--pm-warning)", "var(--pm-info)", "var(--pm-success)"];
    return {
      score,
      label: labels[Math.max(0, score - 1)] || "Weak",
      color: colors[Math.max(0, score - 1)] || "var(--pm-danger)",
    };
  };

  const strength = passwordStrength(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Registration failed");
        return;
      }
      onSuccess(data.user, data.token);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="pm-field">
        <label className="pm-field-label" htmlFor="register-username">Username</label>
        <input
          id="register-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="johndoe"
          required
          disabled={loading || submitting}
          autoComplete="username"
        />
      </div>
      <div className="pm-field">
        <label className="pm-field-label" htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={loading || submitting}
          autoComplete="email"
        />
      </div>
      <div className="pm-field">
        <label className="pm-field-label" htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading || submitting}
          autoComplete="new-password"
        />
        {password && (
          <div style={{ marginTop: 5 }}>
            <div
              role="progressbar"
              aria-label="Password strength"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={strength.score}
              style={{ display: "flex", gap: 4, marginBottom: 5 }}
            >
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  style={{
                    display: "block",
                    height: 4,
                    flex: 1,
                    borderRadius: 999,
                    background: index < strength.score ? strength.color : "var(--pm-border)",
                  }}
                />
              ))}
            </div>
            <p className="pm-form-help" style={{ margin: 0 }}>{strength.label}</p>
          </div>
        )}
      </div>
      <div className="pm-field">
        <label className="pm-field-label" htmlFor="register-confirm-password">Confirm Password</label>
        <input
          id="register-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading || submitting}
          autoComplete="new-password"
        />
        {confirmPassword && password !== confirmPassword && (
          <p className="pm-form-help" role="status" style={{ margin: 0, color: "var(--pm-danger)" }}>
            Passwords do not match
          </p>
        )}
      </div>
      {error && <p className="pm-inline-error" role="alert">{error}</p>}
      <button
        type="submit"
        className="pm-primary-button"
        disabled={loading || submitting}
      >
        {submitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
