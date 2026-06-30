import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../lib/api";

type User = { id: string; email: string; name: string };
type AuthContextValue = {
  user: User | null;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("macroflow.user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(email, password) {
        const payload = await api<{ token: string; user: User }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        localStorage.setItem("macroflow.token", payload.token);
        localStorage.setItem("macroflow.user", JSON.stringify(payload.user));
        setUser(payload.user);
      },
      async register(name, email, password) {
        const payload = await api<{ token: string; user: User }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password })
        });
        localStorage.setItem("macroflow.token", payload.token);
        localStorage.setItem("macroflow.user", JSON.stringify(payload.user));
        setUser(payload.user);
      },
      logout() {
        localStorage.removeItem("macroflow.token");
        localStorage.removeItem("macroflow.user");
        setUser(null);
      }
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
