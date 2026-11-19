import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pill, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import "./overview.css";

type Supplement = { id: string; name: string; brand: string | null; unit: string; defaultAmount: number | null; color: string; archived: boolean; calories: number | null; protein: number | null; fat: number | null; carbs: number | null; sugar: number | null; fiber: number | null; salt: number | null };
type Entry = { id: string; date: string; amount: number; unit: string; calories: number | null; protein: number | null; fat: number | null; carbs: number | null; sugar: number | null; fiber: number | null; salt: number | null };
const blank = { name: "", brand: "", unit: "g", defaultAmount: "", color: "#00d4df", calories: "", protein: "", fat: "", carbs: "", sugar: "", fiber: "", salt: "" };
type Form = typeof blank;
export default function Supplements() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Supplement[]>([]);
  const [selected, setSelected] = useState<Supplement | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const id = params.get("id");
  async function reload() { setItems(await api<Supplement[]>("/supplements?archived=true")); }
  useEffect(() => { reload().catch(err => setError(err.message)); api<{ timezone: string }>("/auth/me").then(user => setDate(new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone || "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()))).catch(err => setError(err.message)); }, []);
  useEffect(() => {
    let active = true;
    setEntryId(null); setEntries([]); setSelected(null);
    if (id) setEditing(false);
    if (id) api<Supplement & { entries: Entry[] }>(`/supplements/${id}`).then(item => {
      if (!active) return;
      setSelected(item); setEntries(item.entries); setAmount(item.defaultAmount?.toString() ?? ""); setError("");
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id, items]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); await reload(); } catch (err) { setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen"); } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      const body = { ...form, brand: form.brand || null, ...Object.fromEntries(["defaultAmount", "calories", "protein", "fat", "carbs", "sugar", "fiber", "salt"].map(key => [key, form[key as keyof Form] === "" ? null : Number(form[key as keyof Form])])) };
      const result = await api<Supplement>(selected ? `/supplements/${selected.id}` : "/supplements", { method: selected ? "PATCH" : "POST", body: JSON.stringify(body) });
      setParams({ id: result.id }); setEditing(false); toast.success("Supplement gespeichert");
    });
  }
  function edit(item: Supplement | null) {
    setSelected(item);
    setForm(item ? Object.fromEntries(Object.keys(blank).map(key => [key, String(item[key as keyof Supplement] ?? "")])) as Form : blank);
    setEditing(true);
  }
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><Link className="text-sm text-teal-600" to="/">← Makro-Übersicht</Link><h1 className="mt-2 flex items-center gap-2 text-2xl font-bold"><Pill /> Supplements</h1><p className="text-sm text-slate-500">Produkte verwalten und Einnahmen festhalten</p></div><Button onClick={() => { setParams({}); edit(null); }}><Plus size={16} /> Hinzufügen</Button></header>
    {error && <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-600">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]"><Card><h2 className="mb-3 font-bold">Deine Supplements</h2><div className="space-y-2">{items.map(item => <button key={item.id} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${id === item.id ? "border-teal-500 bg-teal-500/10" : "border-slate-200 dark:border-slate-700"}`} onClick={() => setParams({ id: item.id })}><span className="h-3 w-3 shrink-0 rounded-full border border-slate-400" style={{ background: item.color }} /><span>{item.name}{item.archived && <small className="block text-slate-500">Archiviert</small>}</span></button>)}</div></Card>
    <div className="space-y-5">{editing ? <Card><h2 className="mb-4 text-xl font-bold">{selected ? "Supplement bearbeiten" : "Supplement hinzufügen"}</h2><form className="supplement-form" onSubmit={save}>
      <label>Name<input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Marke (optional)<input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></label>
      <label>Einheit<select aria-label="Einheit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option>g</option><option>ml</option><option>Stück</option></select></label><label>Standardportion (optional)<input type="number" min="0.001" step="any" value={form.defaultAmount} onChange={e => setForm({ ...form, defaultAmount: e.target.value })} /></label>
      <label>LED-Farbe<input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></label><p className="full text-sm text-slate-500">Nährwerte pro 100 {form.unit}. Leer bedeutet unbekannt, 0 bedeutet tatsächlich null. Bestehende Einnahmen behalten ihre bisherigen Werte.</p>
      {([['calories','Kalorien (kcal)'],['protein','Protein (g)'],['fat','Fett (g)'],['carbs','Kohlenhydrate (g)'],['sugar','Zucker (g)'],['fiber','Ballaststoffe (g)'],['salt','Salz (g)']] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" step="any" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <div className="full flex gap-3"><Button disabled={busy}>Speichern</Button><button type="button" onClick={() => { setEditing(false); if (id) reload(); }}>Abbrechen</button></div>
    </form></Card> : selected ? <>
      <Card><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{selected.name}</h2><div className="flex gap-4 text-sm"><button onClick={() => edit(selected)}>Bearbeiten</button><button disabled={busy} onClick={() => perform(async () => { await api(`/supplements/${selected.id}`, { method: "PATCH", body: JSON.stringify({ archived: !selected.archived }) }); })}>{selected.archived ? "Wieder aktivieren" : "Archivieren"}</button></div></div><p className="mt-2 text-sm text-slate-500">{selected.brand || "Keine Marke hinterlegt"} · pro 100 {selected.unit}</p><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{([['calories','kcal'],['protein','Protein'],['fat','Fett'],['carbs','KH'],['sugar','Zucker'],['fiber','Ballaststoffe'],['salt','Salz']] as const).map(([key,label]) => <div key={key}><dt className="text-sm text-slate-500">{label}</dt><dd className="font-semibold">{selected[key] === null ? "Unbekannt" : new Intl.NumberFormat("de-DE").format(selected[key]!)}</dd></div>)}</dl></Card>
      {(!selected.archived || entryId) && <Card><h3 className="mb-4 font-bold">{entryId ? "Einnahme korrigieren" : "Einnahme erfassen"}</h3><form className="supplement-form" onSubmit={e => { e.preventDefault(); perform(async () => { await api(`/supplements/${selected.id}/entries${entryId ? `/${entryId}` : ""}`, { method: entryId ? "PATCH" : "POST", body: JSON.stringify({ date, amount: Number(amount) }) }); setEntryId(null); toast.success("Einnahme gespeichert"); }); }}><label>Datum<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Menge ({selected.unit})<input required type="number" min="0.001" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="full flex gap-3"><Button disabled={busy || !date}>{entryId ? "Korrektur speichern" : "Einnahme speichern"}</Button>{entryId && <button type="button" onClick={() => setEntryId(null)}>Abbrechen</button>}</div></form></Card>}
      <Card><h3 className="mb-3 font-bold">Einnahmehistorie</h3>{!entries.length && <p className="text-slate-500">Noch keine Einnahmen erfasst.</p>}<ul className="divide-y divide-slate-200 dark:divide-slate-700">{entries.map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div>{new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" }).format(new Date(entry.date))} · <strong>{entry.amount} {entry.unit}</strong>{[entry.calories,entry.protein,entry.fat,entry.carbs].some(v => v === null) && <small className="block text-amber-600">Nährwerte unvollständig</small>}</div><div className="flex gap-3 text-sm"><button onClick={() => { setEntryId(entry.id); setDate(entry.date); setAmount(String(entry.amount)); }}>Korrigieren</button><button disabled={busy} className="text-red-600" onClick={() => { if (window.confirm("Diese Einnahme löschen?")) perform(async () => { await api(`/supplements/${selected.id}/entries/${entry.id}`, { method: "DELETE" }); }); }}>Löschen</button></div></li>)}</ul></Card>
    </> : <Card>Wähle ein Supplement aus oder füge ein neues hinzu.</Card>}</div></div>
  </div>;
}
