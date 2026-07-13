import { CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { Food } from "../types/domain";

const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
const labels = { BREAKFAST: "Frühstück", LUNCH: "Mittagessen", DINNER: "Abendessen", SNACK: "Snacks" };
const today = new Date().toISOString().slice(0, 10);
const dateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

type MealType = keyof typeof labels;
type DayMeal = { id: string; type: MealType; items: Array<{ id: string; amount: number; food: Food }> };
type MealTotals = { calories: number; protein: number; carbs: number; fat: number };

function calculateTotals(items: DayMeal["items"] = []): MealTotals {
  return items.reduce(
    (totals, item) => {
      const factor = item.amount / 100;
      totals.calories += item.food.caloriesPer100g * factor;
      totals.protein += item.food.protein * factor;
      totals.carbs += item.food.carbs * factor;
      totals.fat += item.food.fat * factor;
      return totals;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export default function Meals() {
  const [selectedDate, setSelectedDate] = useState(today);
  const [foodId, setFoodId] = useState("");
  const [amount, setAmount] = useState(100);
  const [editing, setEditing] = useState<{ id: string; foodId: string; amount: number } | null>(null);
  const { data: foods } = useApi<Food[]>("/foods", []);
  const { data: favoriteFoods } = useApi<Food[]>("/favorites/foods", []);
  const { data: meals, reload } = useApi<DayMeal[]>(`/meals/day/${selectedDate}`, []);

  async function add(type: MealType) {
    if (!foodId) return;
    await api("/meals/items", { method: "POST", body: JSON.stringify({ date: selectedDate, type, foodId, amount, unit: "g" }) });
    toast.success("Mahlzeit aktualisiert");
    await reload();
  }

  async function updateItem() {
    if (!editing) return;
    await api(`/meals/items/${editing.id}`, { method: "PUT", body: JSON.stringify({ foodId: editing.foodId, amount: editing.amount, unit: "g" }) });
    setEditing(null);
    toast.success("Eintrag geändert");
    await reload();
  }

  async function deleteItem(id: string) {
    await api(`/meals/items/${id}`, { method: "DELETE" });
    toast.success("Eintrag gelöscht");
    await reload();
  }

  function shiftDay(days: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  }

  const isToday = selectedDate === today;
  const selectedDateLabel = isToday ? "Heute" : dateFormatter.format(new Date(`${selectedDate}T12:00:00`));
  const favoriteFoodIds = new Set(favoriteFoods.map((food) => food.id));
  const selectableFoods = [
    ...favoriteFoods,
    ...foods.filter((food) => !favoriteFoodIds.has(food.id))
  ];
  const dayTotals = meals.reduce((totals, meal) => {
    const mealTotals = calculateTotals(meal.items);
    totals.calories += mealTotals.calories;
    totals.protein += mealTotals.protein;
    totals.carbs += mealTotals.carbs;
    totals.fat += mealTotals.fat;
    return totals;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-mint" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Mahlzeiten</p>
              <h2 className="text-lg font-bold">{selectedDateLabel}</h2>
            </div>
          </div>

          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <button aria-label="Vorheriger Tag" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 transition hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800" onClick={() => shiftDay(-1)}>
              <ChevronLeft size={22} />
            </button>
            <label className="block">
              <span className="sr-only">Datum auswählen</span>
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-11 text-center font-semibold" />
            </label>
            <button aria-label="Nächster Tag" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 transition hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800" onClick={() => shiftDay(1)}>
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            {!isToday && <Button type="button" className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={() => setSelectedDate(today)}><RotateCcw size={18} />Heute</Button>}
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              <span className="font-semibold">{Math.round(dayTotals.calories)}</span> kcal
              <span className="mx-2 text-slate-400">|</span>
              P {Math.round(dayTotals.protein)} C {Math.round(dayTotals.carbs)} F {Math.round(dayTotals.fat)}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
            <option value="">Lebensmittel auswählen</option>
            {favoriteFoods.length > 0 && (
              <optgroup label="Favoriten">
                {favoriteFoods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
              </optgroup>
            )}
            <optgroup label="Alle Lebensmittel">
              {foods.filter((food) => !favoriteFoodIds.has(food.id)).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
            </optgroup>
          </select>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {mealTypes.map((type) => {
          const meal = meals.find((item) => item.type === type);
          const mealTotals = calculateTotals(meal?.items);
          return (
            <Card key={type} className="min-w-0">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-bold">{labels[type]}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span><span className="font-semibold text-ink dark:text-white">{Math.round(mealTotals.calories)}</span> kcal</span>
                    <span>P {Math.round(mealTotals.protein)}</span>
                    <span>C {Math.round(mealTotals.carbs)}</span>
                    <span>F {Math.round(mealTotals.fat)}</span>
                  </div>
                </div>
                <Button onClick={() => add(type)}><Plus size={18} />Hinzufügen</Button>
              </div>
              <div className="space-y-2">
                {meal?.items.map((item) => {
                  const isEditing = editing?.id === item.id;
                  return (
                    <div key={item.id} className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                      {isEditing ? (
                        <div className="grid min-w-0 gap-2">
                          <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_96px]">
                            <select className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" value={editing.foodId} onChange={(event) => setEditing({ ...editing, foodId: event.target.value })}>
                              {selectableFoods.map((food) => <option key={food.id} value={food.id}>{favoriteFoodIds.has(food.id) ? "Favorit - " : ""}{food.name}</option>)}
                            </select>
                            <Input type="number" step="0.1" value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: Number(event.target.value) })} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button aria-label="Speichern" className="grid h-10 w-10 place-items-center rounded-lg bg-mint text-slate-950" onClick={updateItem}><Check size={18} /></button>
                            <button aria-label="Abbrechen" className="grid h-10 w-10 place-items-center rounded-lg bg-slate-200 dark:bg-slate-700" onClick={() => setEditing(null)}><X size={18} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span>{item.food.name} · {item.amount} g · {Math.round(item.food.caloriesPer100g * item.amount / 100)} kcal</span>
                          <div className="flex shrink-0 gap-2">
                            <button aria-label="Bearbeiten" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/70 dark:hover:bg-slate-700" onClick={() => setEditing({ id: item.id, foodId: item.food.id, amount: item.amount })}><Pencil size={16} /></button>
                            <button aria-label="Löschen" className="grid h-9 w-9 place-items-center rounded-lg text-coral hover:bg-white/70 dark:hover:bg-slate-700" onClick={() => deleteItem(item.id)}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!meal?.items.length && <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-800">Noch keine Einträge für diesen Tag.</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
