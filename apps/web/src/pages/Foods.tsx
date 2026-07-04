import { Check, Pencil, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { Food } from "../types/domain";

type OpenFoodFactsProduct = {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  nutriScore?: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  salt: number;
};

type FoodForm = {
  name: string;
  brand: string;
  category: string;
  barcode: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  salt: number;
};

const empty: FoodForm = { name: "", brand: "", category: "", barcode: "", caloriesPer100g: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 };
const nutrientKeys = ["caloriesPer100g", "protein", "carbs", "fat", "fiber", "sugar", "salt"] as const;
const today = new Date().toISOString().slice(0, 10);

export default function Foods() {
  const [q, setQ] = useState("");
  const [form, setForm] = useState<FoodForm>(empty);
  const [editingFood, setEditingFood] = useState<(FoodForm & { id: string }) | null>(null);
  const [offQuery, setOffQuery] = useState({ q: "", brand: "", category: "", barcode: "", country: "Germany", language: "de" });
  const [offResults, setOffResults] = useState<OpenFoodFactsProduct[]>([]);
  const [offSearching, setOffSearching] = useState(false);
  const [offSearched, setOffSearched] = useState(false);
  const [offError, setOffError] = useState("");
  const [selected, setSelected] = useState<OpenFoodFactsProduct | null>(null);
  const [favorite, setFavorite] = useState(true);
  const [addToMeal, setAddToMeal] = useState(false);
  const [mealType, setMealType] = useState("SNACK");
  const [portion, setPortion] = useState(100);
  const { data, reload } = useApi<Food[]>(`/foods?q=${encodeURIComponent(q)}`, []);
  const { data: favoriteFoods, reload: reloadFavorites } = useApi<Food[]>("/favorites/foods", []);

  const favoriteFoodIds = new Set(favoriteFoods.map((food) => food.id));
  const prioritizedFoods = [
    ...favoriteFoods,
    ...data.filter((food) => !favoriteFoodIds.has(food.id))
  ];

  async function createFood(event: FormEvent) {
    event.preventDefault();
    await api("/foods", { method: "POST", body: JSON.stringify(form) });
    setForm(empty);
    toast.success("Lebensmittel gespeichert");
    await reload();
  }

  async function updateFood() {
    if (!editingFood) return;
    const { id, ...payload } = editingFood;
    await api(`/foods/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    setEditingFood(null);
    toast.success("Lebensmittel geändert");
    await Promise.all([reload(), reloadFavorites()]);
  }

  async function remove(id: string) {
    await api(`/foods/${id}`, { method: "DELETE" });
    toast.success("Gelöscht", { icon: <Trash2 size={16} /> });
    await Promise.all([reload(), reloadFavorites()]);
  }

  async function toggleFavorite(food: Food) {
    if (favoriteFoodIds.has(food.id)) {
      await api(`/favorites/foods/${food.id}`, { method: "DELETE" });
      toast.success("Favorit entfernt");
    } else {
      await api("/favorites", { method: "POST", body: JSON.stringify({ type: "FOOD", targetId: food.id, label: food.name }) });
      toast.success("Favorit gespeichert");
    }
    await reloadFavorites();
  }

  async function searchOpenFoodFacts(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams(Object.entries(offQuery).filter(([, value]) => value));
    setOffSearching(true);
    setOffSearched(true);
    setOffError("");
    setSelected(null);
    try {
      const results = await api<OpenFoodFactsProduct[]>(`/open-food-facts/search?${params.toString()}`);
      setOffResults(results);
      toast.success(`${results.length} Produkte gefunden`);
    } catch (error) {
      setOffResults([]);
      const message = error instanceof Error ? error.message : "Open Food Facts Suche fehlgeschlagen";
      setOffError(message);
      toast.error(message);
    } finally {
      setOffSearching(false);
    }
  }

  async function importOpenFoodFactsProduct() {
    if (!selected) return;
    await api("/open-food-facts/import", {
      method: "POST",
      body: JSON.stringify({
        product: selected,
        favorite,
        meal: addToMeal ? { date: today, type: mealType, amount: portion, unit: "g" } : undefined
      })
    });
    setSelected(null);
    toast.success("Produkt übernommen");
    await Promise.all([reload(), reloadFavorites()]);
  }

  async function syncFood(id: string) {
    await api(`/open-food-facts/foods/${id}/sync`, { method: "POST" });
    toast.success("Mit Open Food Facts synchronisiert");
    await reload();
  }

  function startEdit(food: Food) {
    setEditingFood({
      id: food.id,
      name: food.name,
      brand: food.brand ?? "",
      category: food.category ?? "",
      barcode: food.barcode ?? "",
      caloriesPer100g: food.caloriesPer100g,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      sugar: food.sugar,
      salt: food.salt
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex items-center gap-2"><Star className="text-amber" size={20} /><h2 className="font-bold">Favoriten</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {favoriteFoods.map((food) => (
            <div key={food.id} className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{food.name}</p>
                  <p className="text-slate-500">{food.caloriesPer100g} kcal · P {food.protein} C {food.carbs} F {food.fat}</p>
                </div>
                <button aria-label="Favorit entfernen" className="text-amber" onClick={() => toggleFavorite(food)}><Star size={18} fill="currentColor" /></button>
              </div>
            </div>
          ))}
          {!favoriteFoods.length && <p className="text-sm text-slate-500">Noch keine Favoriten gespeichert.</p>}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <h2 className="mb-4 font-bold">Eigenes Lebensmittel</h2>
          <form onSubmit={createFood} className="grid gap-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Hersteller" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <Input placeholder="Kategorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <Input placeholder="Barcode / EAN" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              {nutrientKeys.map((key) => <Input key={key} type="number" step="0.1" placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />)}
            </div>
            <Button>Speichern</Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2"><Search size={20} /><Input placeholder="Lokale Suche, Barcode, Hersteller" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="space-y-3">
            {prioritizedFoods.map((food) => {
              const isOff = food.source === "open_food_facts";
              const isFavorite = favoriteFoodIds.has(food.id);
              const isEditing = editingFood?.id === food.id;
              return (
                <div key={food.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  {isEditing && editingFood ? (
                    <div className="grid min-w-0 gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input placeholder="Name" value={editingFood.name} onChange={(e) => setEditingFood({ ...editingFood, name: e.target.value })} />
                        <Input placeholder="Hersteller" value={editingFood.brand} onChange={(e) => setEditingFood({ ...editingFood, brand: e.target.value })} />
                        <Input placeholder="Kategorie" value={editingFood.category} onChange={(e) => setEditingFood({ ...editingFood, category: e.target.value })} />
                        <Input placeholder="Barcode / EAN" value={editingFood.barcode} onChange={(e) => setEditingFood({ ...editingFood, barcode: e.target.value })} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {nutrientKeys.map((key) => <Input key={key} type="number" step="0.1" placeholder={key} value={editingFood[key]} onChange={(e) => setEditingFood({ ...editingFood, [key]: Number(e.target.value) })} />)}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button aria-label="Speichern" className="grid h-10 w-10 place-items-center rounded-lg bg-mint text-slate-950" onClick={updateFood}><Check size={18} /></button>
                        <button aria-label="Abbrechen" className="grid h-10 w-10 place-items-center rounded-lg bg-slate-200 dark:bg-slate-700" onClick={() => setEditingFood(null)}><X size={18} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate font-semibold">{food.name}</p><p className="text-sm text-slate-500">{food.brand || "Eigenes Lebensmittel"} · {food.caloriesPer100g} kcal · P {food.protein} C {food.carbs} F {food.fat}</p></div>
                      <div className="flex shrink-0 gap-2">
                        {isOff && <button aria-label="Synchronisieren" onClick={() => syncFood(food.id)}><RefreshCw size={18} /></button>}
                        <button aria-label={isFavorite ? "Favorit entfernen" : "Favorit"} className={isFavorite ? "text-amber" : undefined} onClick={() => toggleFavorite(food)}><Star size={18} fill={isFavorite ? "currentColor" : "none"} /></button>
                        <button aria-label="Bearbeiten" onClick={() => startEdit(food)}><Pencil size={18} /></button>
                        <button aria-label="Löschen" onClick={() => remove(food.id)}><Trash2 size={18} /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-bold">Open Food Facts Suche</h2>
        <form onSubmit={searchOpenFoodFacts} className="grid gap-3 lg:grid-cols-6">
          <Input placeholder="Name" value={offQuery.q} onChange={(e) => setOffQuery({ ...offQuery, q: e.target.value })} />
          <Input placeholder="Marke" value={offQuery.brand} onChange={(e) => setOffQuery({ ...offQuery, brand: e.target.value })} />
          <Input placeholder="Kategorie" value={offQuery.category} onChange={(e) => setOffQuery({ ...offQuery, category: e.target.value })} />
          <Input placeholder="Barcode / EAN" value={offQuery.barcode} onChange={(e) => setOffQuery({ ...offQuery, barcode: e.target.value })} />
          <Input placeholder="Land" value={offQuery.country} onChange={(e) => setOffQuery({ ...offQuery, country: e.target.value })} />
          <Button disabled={offSearching}><Search size={18} />{offSearching ? "Sucht..." : "Suchen"}</Button>
        </form>

        {selected && (
          <div className="mt-4 rounded-lg border border-mint/40 bg-mint/5 p-4">
            <h2 className="mb-4 font-bold">Produkt prüfen und übernehmen</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input placeholder="Name" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              <Input placeholder="Hersteller" value={selected.brand ?? ""} onChange={(e) => setSelected({ ...selected, brand: e.target.value })} />
              <Input placeholder="Kategorie" value={selected.category ?? ""} onChange={(e) => setSelected({ ...selected, category: e.target.value })} />
              <Input placeholder="Portion in g" type="number" value={portion} onChange={(e) => setPortion(Number(e.target.value))} />
              {nutrientKeys.map((key) => <Input key={key} type="number" step="0.1" placeholder={key} value={selected[key]} onChange={(e) => setSelected({ ...selected, [key]: Number(e.target.value) })} />)}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />Als Favorit speichern</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addToMeal} onChange={(e) => setAddToMeal(e.target.checked)} />Direkt zu Mahlzeit hinzufügen</label>
              {addToMeal && <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={mealType} onChange={(e) => setMealType(e.target.value)}><option value="BREAKFAST">Frühstück</option><option value="LUNCH">Mittagessen</option><option value="DINNER">Abendessen</option><option value="SNACK">Snack</option></select>}
              <Button type="button" onClick={importOpenFoodFactsProduct}>Speichern</Button>
              <Button type="button" className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={() => setSelected(null)}>Abbrechen</Button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {offResults.map((product) => (
            <div key={product.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[88px_1fr_auto]">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-500">kein Bild</span>}
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{product.name}</p>
                <p className="text-sm text-slate-500">{product.brand || "Unbekannter Hersteller"} · {product.barcode}</p>
                <p className="mt-1 text-sm text-slate-500">{product.caloriesPer100g} kcal · P {product.protein} C {product.carbs} F {product.fat} · Zucker {product.sugar} · Salz {product.salt}</p>
                <p className="mt-1 text-sm text-slate-500">Ballaststoffe {product.fiber} · Nutri-Score {product.nutriScore || "-"}</p>
              </div>
              <Button type="button" className="self-center" onClick={() => { setSelected(product); setPortion(100); }}><Check size={18} />Übernehmen</Button>
            </div>
          ))}
        </div>
        {offSearched && !offSearching && offResults.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
            {offError || "Keine Open-Food-Facts-Produkte gefunden. Prüfe Suchbegriff, Barcode oder Land und versuche es erneut."}
          </div>
        )}
      </Card>
    </div>
  );
}
