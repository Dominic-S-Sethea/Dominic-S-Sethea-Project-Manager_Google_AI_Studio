import { useState } from "react";
import type { FormEvent } from "react";

interface LoginFormProps {
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

export default function LoginForm({ onSuccess, loading }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }
      onSuccess(data.user, data.token);
    } catch {
      setError("Network error. Is the server running?");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="pm-field">
        <label className="pm-field-label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={loading}
          autoComplete="email"
        />
      </div>
      <div className="pm-field">
        <label className="pm-field-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading}
          autoComplete="current-password"
        />
      </div>
      {error && <p className="pm-inline-error" role="alert">{error}</p>}
      <button type="submit" className="pm-primary-button" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
