import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: string;
  status: string;
  heightCm?: number | null;
  language?: string;
  units?: string;
  timezone?: string;
  theme?: string;
  trackWeight?: boolean;
  trackBodyFat?: boolean;
  trackMuscleMass?: boolean;
  trackWater?: boolean;
};
type AuthContextValue = {
  user: User | null;
  login(email: string, password: string, rememberMe?: boolean): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  isAdmin: boolean;
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
      isAdmin: user?.role === "ADMIN",
      async login(email, password, rememberMe = false) {
        const payload = await api<{ accessToken: string; refreshToken: string; user: User }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password, rememberMe })
        });
        localStorage.setItem("macroflow.token", payload.accessToken);
        localStorage.setItem("macroflow.refreshToken", payload.refreshToken);
        localStorage.setItem("macroflow.user", JSON.stringify(payload.user));
        setUser(payload.user);
      },
      async register(name, email, password) {
        await api<{ user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
      },
      async logout() {
        const refreshToken = localStorage.getItem("macroflow.refreshToken");
        await api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
        localStorage.removeItem("macroflow.token");
        localStorage.removeItem("macroflow.refreshToken");
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
