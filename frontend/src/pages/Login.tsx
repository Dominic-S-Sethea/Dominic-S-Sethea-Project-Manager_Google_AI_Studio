import { useState } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";
import { useAuth } from "../hooks/useAuth";
import { Icon } from "../components/layout/Icon";

export default function Login() {
  const { login, user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  if (user) return <Navigate to="/dashboard" replace />;
  return <main className="pm-auth-shell"><div className="pm-auth-orb pm-auth-orb-one" /><div className="pm-auth-orb pm-auth-orb-two" /><section className="pm-auth-card"><header><div className="pm-auth-brand"><span>P</span>Project Manager</div><div className="pm-menu-kicker">PRIVATE WORKSPACE</div><h1>{mode === "login" ? "Welcome back" : "Create a workspace account"}</h1><p>{mode === "login" ? "Sign in to your glass workspace." : "Start with a focused, local-first project workspace."}</p></header><div className="pm-auth-tabs"><button className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>Sign in</button><button className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")}>Create account</button></div>{mode === "login" ? <LoginForm onSuccess={login} loading={false} /> : <RegisterForm onSuccess={login} loading={false} />}<footer><Icon name="theme" size={13} />Graphite-black glass · crystal-bright-blue emphasis</footer></section></main>;
}
