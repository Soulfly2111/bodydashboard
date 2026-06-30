import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Apple } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "Demo User", email: "demo@example.com", password: "DemoPassword123!" });

  if (user) return <Navigate to="/" />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login fehlgeschlagen");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-mint/15 text-mint"><Apple /></div>
          <div><h1 className="text-2xl font-bold">Bodydashboard</h1><p className="text-sm text-slate-500">Schnelles Tracking für Alltag und Ziele</p></div>
        </div>
        {mode === "register" && <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mb-3" />}
        <Input placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mb-3" />
        <Input placeholder="Passwort" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mb-4" />
        <Button className="w-full">{mode === "login" ? "Einloggen" : "Konto erstellen"}</Button>
        <button type="button" className="mt-4 w-full text-sm text-mint" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Neues Konto erstellen" : "Zum Login wechseln"}
        </button>
      </form>
    </main>
  );
}
