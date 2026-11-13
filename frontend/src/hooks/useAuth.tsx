import { createContext, useContext, useState, type ReactNode } from "react";

interface User { user_id: string; username: string; email: string; role: string; status: string; created_at: string; }
interface AuthContextType { user: User | null; login: (user: User, token?: string) => void; logout: () => void; }
const AuthContext = createContext<AuthContextType | null>(null);

function readStoredUser(): User | null {
  try { const stored = localStorage.getItem("pm_user"); return stored ? JSON.parse(stored) as User : null; } catch { localStorage.removeItem("pm_user"); return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const login = (nextUser: User, token?: string) => { setUser(nextUser); localStorage.setItem("pm_user", JSON.stringify(nextUser)); if (token) localStorage.setItem("pm_token", token); };
  const logout = () => { setUser(null); localStorage.removeItem("pm_user"); localStorage.removeItem("pm_token"); };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
export function getToken(): string | null { return localStorage.getItem("pm_token"); }
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }
