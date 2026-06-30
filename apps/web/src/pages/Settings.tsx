import { LogOut } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";

export default function Settings() {
  const { logout, user } = useAuth();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><h2 className="mb-4 font-bold">Benutzerprofil</h2><div className="space-y-3"><Input value={user?.name ?? ""} readOnly /><Input value={user?.email ?? ""} readOnly /><Button onClick={logout}><LogOut size={18} />Ausloggen</Button></div></Card>
      <Card><h2 className="mb-4 font-bold">Einheiten & Sprache</h2><div className="grid gap-3"><select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950"><option>Metrisch</option><option>Imperial</option></select><select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950"><option>Deutsch</option><option>English</option></select><p className="text-sm text-slate-500">Theme wird oben rechts umgeschaltet. Tagesziele liegen im Bereich Ziele.</p></div></Card>
    </div>
  );
}
