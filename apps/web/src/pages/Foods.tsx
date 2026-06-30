import { Search, Star, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { Food } from "../types/domain";

const empty = { name: "", brand: "", category: "", caloriesPer100g: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 };

export default function Foods() {
  const [q, setQ] = useState("");
  const [form, setForm] = useState(empty);
  const { data, reload } = useApi<Food[]>(`/foods?q=${encodeURIComponent(q)}`, []);

  async function createFood(event: FormEvent) {
    event.preventDefault();
    await api("/foods", { method: "POST", body: JSON.stringify(form) });
    setForm(empty);
    toast.success("Lebensmittel gespeichert");
    await reload();
  }

  async function remove(id: string) {
    await api(`/foods/${id}`, { method: "DELETE" });
    toast.success("Gelöscht", { icon: <Trash2 size={16} /> });
    await reload();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <Card>
        <h2 className="mb-4 font-bold">Eigenes Lebensmittel</h2>
        <form onSubmit={createFood} className="grid gap-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Hersteller" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /><Input placeholder="Kategorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">{(["caloriesPer100g", "protein", "carbs", "fat", "fiber", "sugar", "salt"] as const).map((key) => <Input key={key} type="number" step="0.1" placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />)}</div>
          <Button>Speichern</Button>
        </form>
      </Card>
      <Card>
        <div className="mb-4 flex items-center gap-2"><Search size={20} /><Input placeholder="Suche, Barcode, Hersteller" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="space-y-3">
          {data.map((food) => (
            <div key={food.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div><p className="font-semibold">{food.name}</p><p className="text-sm text-slate-500">{food.brand || "Eigenes Lebensmittel"} · {food.caloriesPer100g} kcal · P {food.protein} C {food.carbs} F {food.fat}</p></div>
              <div className="flex gap-2"><button aria-label="Favorit"><Star size={18} /></button><button aria-label="Löschen" onClick={() => remove(food.id)}><Trash2 size={18} /></button></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
