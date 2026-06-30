import { DatabaseZap } from "lucide-react";
import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";

export default function Import() {
  const [form, setForm] = useState({
    name: "Confluence Lebensmittel",
    baseUrl: "",
    spaceKey: "",
    pageTitle: "",
    username: "",
    apiToken: "",
    authType: "apiToken",
    mapping: { recordType: "food", columns: { Lebensmittel: "name", kcal: "caloriesPer100g", Protein: "protein", Kohlenhydrate: "carbs", Fett: "fat", Ballaststoffe: "fiber" } }
  });
  const { data, reload } = useApi<Array<{ id: string; name: string; baseUrl: string; lastImportedAt?: string }>>("/import-sources", []);
  const [preview, setPreview] = useState<unknown[]>([]);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/import-sources", { method: "POST", body: JSON.stringify(form) });
    toast.success("Quelle gespeichert");
    await reload();
  }

  async function previewSource(id: string) {
    setPreview(await api<unknown[]>(`/import-sources/${id}/preview`, { method: "POST" }));
  }

  async function runSource(id: string) {
    await api(`/import-sources/${id}/run`, { method: "POST" });
    toast.success("Import abgeschlossen");
    await reload();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <Card><div className="mb-4 flex items-center gap-2"><DatabaseZap className="text-mint" /><h2 className="font-bold">Confluence-Quelle</h2></div><form onSubmit={save} className="grid gap-3">{(["name", "baseUrl", "spaceKey", "pageTitle", "username", "apiToken"] as const).map((key) => <Input key={key} placeholder={key} type={key === "apiToken" ? "password" : "text"} value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}<Button>Quelle speichern</Button></form></Card>
      <Card><h2 className="mb-4 font-bold">Importquellen</h2><div className="space-y-3">{data.map((source) => <div key={source.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="font-semibold">{source.name}</p><p className="text-sm text-slate-500">{source.baseUrl} · {source.lastImportedAt || "noch nicht importiert"}</p><div className="mt-3 flex gap-2"><Button onClick={() => previewSource(source.id)}>Vorschau</Button><Button onClick={() => runSource(source.id)}>Import starten</Button></div></div>)}</div>{preview.length > 0 && <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">{JSON.stringify(preview.slice(0, 10), null, 2)}</pre>}</Card>
    </div>
  );
}
