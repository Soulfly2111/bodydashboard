import { CalendarDays, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react";
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

export default function Meals() {
  const [selectedDate, setSelectedDate] = useState(today);
  const [foodId, setFoodId] = useState("");
  const [amount, setAmount] = useState(100);
  const { data: foods } = useApi<Food[]>("/foods", []);
  const { data: meals, reload } = useApi<DayMeal[]>(`/meals/day/${selectedDate}`, []);

  async function add(type: MealType) {
    if (!foodId) return;
    await api("/meals/items", { method: "POST", body: JSON.stringify({ date: selectedDate, type, foodId, amount, unit: "g" }) });
    toast.success("Mahlzeit aktualisiert");
    await reload();
  }

  function shiftDay(days: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  }

  const isToday = selectedDate === today;
  const selectedDateLabel = isToday ? "Heute" : dateFormatter.format(new Date(`${selectedDate}T12:00:00`));
  const dayTotals = meals.reduce(
    (totals, meal) => {
      meal.items.forEach((item) => {
        const factor = item.amount / 100;
        totals.calories += item.food.caloriesPer100g * factor;
        totals.protein += item.food.protein * factor;
        totals.carbs += item.food.carbs * factor;
        totals.fat += item.food.fat * factor;
      });
      return totals;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

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
            {foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
          </select>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {mealTypes.map((type) => {
          const meal = meals.find((item) => item.type === type);
          return (
            <Card key={type}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-bold">{labels[type]}</h2>
                <Button onClick={() => add(type)}><Plus size={18} />Hinzufügen</Button>
              </div>
              <div className="space-y-2">
                {meal?.items.map((item) => (
                  <div key={item.id} className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                    {item.food.name} · {item.amount} g · {Math.round(item.food.caloriesPer100g * item.amount / 100)} kcal
                  </div>
                ))}
                {!meal?.items.length && <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-800">Noch keine Einträge für diesen Tag.</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
