import { Activity, Apple, CalendarDays, Camera, Droplet, Dumbbell, Home, Menu, Moon, Scale, Settings, Shield, Soup, Sun } from "lucide-react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { useAuth } from "../../hooks/useAuth";

const nav = [
  { id: "dashboard", to: "/", label: "Dashboard", icon: Home, alwaysVisible: true },
  { id: "foods", to: "/foods", label: "Lebensmittel", icon: Apple },
  { id: "meals", to: "/meals", label: "Mahlzeiten", icon: Soup },
  { id: "activities", to: "/activities", label: "Aktivitäten", icon: Activity },
  { id: "aiMeals", to: "/ai-meals", label: "Foto-KI", icon: Camera },
  { id: "week", to: "/week", label: "Woche", icon: CalendarDays },
  { id: "goals", to: "/goals", label: "Ziele", icon: Dumbbell },
  { id: "weight", to: "/weight", label: "Gewicht", icon: Scale },
  { id: "recipes", to: "/recipes", label: "Rezepte", icon: Activity },
  { id: "admin", to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { id: "settings", to: "/settings", label: "Einstellungen", icon: Settings, alwaysVisible: true }
];

function parseVisiblePages(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === "string")) : null;
  } catch {
    return null;
  }
}

export function AppShell() {
  const { user } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem("macroflow.theme") === "dark");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("macroflow.theme", dark ? "dark" : "light");
  }, [dark]);

  if (!user) return <Navigate to="/login" replace />;

  const configuredPages = parseVisiblePages(user.visiblePagesJson);
  const visibleNav = nav.filter((item) => {
    if (item.adminOnly && user.role !== "ADMIN") return false;
    if (item.alwaysVisible || !configuredPages) return true;
    return configuredPages.has(item.id);
  });
  const primaryMobileNav = visibleNav.slice(0, 4);
  const secondaryMobileNav = visibleNav.slice(4);

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
        <nav className="hidden lg:block lg:space-y-1 lg:p-4">
          {visibleNav.map((item) => (
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

        <div className="lg:hidden">
          {mobileMoreOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 rounded-lg border border-slate-200 bg-white p-2 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-1">
                {secondaryMobileNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setMobileMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 transition",
                        isActive && "bg-mint/12 text-mint"
                      )
                    }
                  >
                    <item.icon size={19} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
          <nav className="grid grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2">
            {primaryMobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMobileMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "grid min-h-[58px] min-w-0 place-items-center gap-1 rounded-lg px-1 py-1 text-[0.65rem] font-medium leading-none text-slate-500 transition",
                    isActive && "bg-mint/12 text-mint"
                  )
                }
              >
                <item.icon size={20} />
                <span className="w-full truncate text-center">{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              aria-label="Mehr Navigation"
              className={cn(
                "grid min-h-[58px] min-w-0 place-items-center gap-1 rounded-lg px-1 py-1 text-[0.65rem] font-medium leading-none text-slate-500 transition",
                mobileMoreOpen && "bg-mint/12 text-mint"
              )}
              onClick={() => setMobileMoreOpen((value) => !value)}
            >
              <Menu size={20} />
              <span className="w-full truncate text-center">Mehr</span>
            </button>
          </nav>
        </div>
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
