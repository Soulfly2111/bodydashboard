import { Lock, Search, Shield, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

type AdminUser = {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED" | "LOCKED";
  lastLoginAt?: string;
  lockedUntil?: string;
};

type AuditLog = { id: string; action: string; userId?: string; actorUserId?: string; entityType?: string; entityId?: string; createdAt: string };

type UserForm = { username: string; name: string; email: string; password: string; role: "ADMIN" | "USER" };
const empty: UserForm = { username: "", name: "", email: "", password: "", role: "USER" };

export default function Admin() {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(empty);
  const { data: users, reload } = useApi<AdminUser[]>(`/admin/users?q=${encodeURIComponent(query)}`, []);
  const { data: logs, reload: reloadLogs } = useApi<AuditLog[]>("/admin/audit-logs", []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
    setForm(empty);
    toast.success("Benutzer erstellt");
    await Promise.all([reload(), reloadLogs()]);
  }

  async function updateUser(id: string, patch: Partial<AdminUser>) {
    await api(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(patch) });
    toast.success("Benutzer aktualisiert");
    await Promise.all([reload(), reloadLogs()]);
  }

  async function resetPassword(id: string) {
    const password = window.prompt("Neues Passwort", "ChangeMe@1234!");
    if (!password) return;
    await api(`/admin/users/${id}/password`, { method: "POST", body: JSON.stringify({ password }) });
    toast.success("Passwort gesetzt");
    await reloadLogs();
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Benutzer wirklich löschen?")) return;
    await api(`/admin/users/${id}`, { method: "DELETE" });
    toast.success("Benutzer gelöscht");
    await Promise.all([reload(), reloadLogs()]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex items-center gap-2"><Shield size={20} /><h2 className="font-bold">Administration</h2></div>
        <form onSubmit={createUser} className="grid gap-3 lg:grid-cols-5">
          <Input placeholder="Benutzername" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input placeholder="Passwort" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <div className="flex gap-2">
            <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "USER" })}><option value="USER">Standardbenutzer</option><option value="ADMIN">Administrator</option></select>
            <Button><UserPlus size={18} />Erstellen</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2"><Search size={20} /><Input placeholder="Benutzer suchen" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[1.2fr_1fr_.8fr_.8fr_auto]">
              <div><p className="font-semibold">{user.name}</p><p className="text-sm text-slate-500">{user.username || "-"} · {user.email}</p></div>
              <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={user.role} onChange={(e) => updateUser(user.id, { role: e.target.value as AdminUser["role"] })}><option value="USER">Standardbenutzer</option><option value="ADMIN">Administrator</option></select>
              <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={user.status} onChange={(e) => updateUser(user.id, { status: e.target.value as AdminUser["status"] })}><option value="ACTIVE">Aktiv</option><option value="DISABLED">Deaktiviert</option><option value="LOCKED">Gesperrt</option></select>
              <p className="text-sm text-slate-500">Letzter Login<br />{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("de-DE") : "Noch nie"}</p>
              <div className="flex gap-2"><button aria-label="Passwort setzen" onClick={() => resetPassword(user.id)}><Lock size={18} /></button><button aria-label="Löschen" onClick={() => deleteUser(user.id)}><Trash2 size={18} /></button></div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">Audit-Log</h2>
        <div className="space-y-2 text-sm">
          {logs.slice(0, 25).map((log) => <p key={log.id} className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">{new Date(log.createdAt).toLocaleString("de-DE")} · {log.action} · {log.entityType || "-"} {log.entityId || ""}</p>)}
        </div>
      </Card>
    </div>
  );
}
