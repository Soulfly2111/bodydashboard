import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";

export default function Recipes() {
  const [form, setForm] = useState({ name: "", servings: 2, instructions: "" });
  const { data, reload } = useApi<Array<{ id: string; name: string; servings: number; instructions?: string; totals?: { calories: number; protein: number } }>>("/recipes", []);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/recipes", { method: "POST", body: JSON.stringify({ ...form, items: [] }) });
    setForm({ name: "", servings: 2, instructions: "" });
    toast.success("Rezept gespeichert");
    await reload();
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[.7fr_1.3fr]">
      <Card><h2 className="mb-4 font-bold">Rezept anlegen</h2><form onSubmit={save} className="space-y-3"><Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input type="number" placeholder="Portionen" value={form.servings} onChange={(e) => setForm({ ...form, servings: Number(e.target.value) })} /><Input placeholder="Anleitung" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /><Button>Speichern</Button></form></Card>
      <Card><h2 className="mb-4 font-bold">Rezepte</h2><div className="grid gap-3">{data.map((recipe) => <div key={recipe.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="font-semibold">{recipe.name}</p><p className="text-sm text-slate-500">{recipe.servings} Portionen · {Math.round(recipe.totals?.calories ?? 0)} kcal · {Math.round(recipe.totals?.protein ?? 0)} g Protein</p></div>)}</div></Card>
    </div>
  );
}
