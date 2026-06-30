import { Activity, Apple, CalendarDays, DatabaseZap, Droplet, Dumbbell, Home, Moon, Scale, Settings, Soup, Sun } from "lucide-react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { useAuth } from "../../hooks/useAuth";

const nav = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/foods", label: "Lebensmittel", icon: Apple },
  { to: "/meals", label: "Mahlzeiten", icon: Soup },
  { to: "/week", label: "Woche", icon: CalendarDays },
  { to: "/goals", label: "Ziele", icon: Dumbbell },
  { to: "/weight", label: "Gewicht", icon: Scale },
  { to: "/recipes", label: "Rezepte", icon: Activity },
  { to: "/import", label: "Import", icon: DatabaseZap },
  { to: "/settings", label: "Einstellungen", icon: Settings }
];

export function AppShell() {
  const { user } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem("macroflow.theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("macroflow.theme", dark ? "dark" : "light");
  }, [dark]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed bottom-0 z-30 w-full border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:bottom-auto lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:border-r lg:border-t-0">
        <div className="hidden h-16 items-center gap-3 px-5 lg:flex">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-white dark:bg-mint dark:text-slate-950">
            <Droplet size={20} />
          </div>
          <div>
            <p className="font-bold">Bodydashboard</p>
            <p className="text-xs text-slate-500">{user.name}</p>
          </div>
        </div>
        <nav className="flex overflow-x-auto p-2 lg:block lg:space-y-1 lg:p-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-w-16 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition lg:min-w-0 lg:flex-row lg:text-sm",
                  isActive && "bg-mint/12 text-mint"
                )
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="pb-24 lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Heute</p>
            <h1 className="text-xl font-bold">Ernährung & Makros</h1>
          </div>
          <button aria-label="Theme wechseln" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 dark:border-slate-800" onClick={() => setDark((value) => !value)}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>
        <div className="mx-auto max-w-7xl p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
