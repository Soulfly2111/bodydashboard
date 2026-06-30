import { Plus } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import type { Food } from "../types/domain";

const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
const labels = { BREAKFAST: "Frühstück", LUNCH: "Mittagessen", DINNER: "Abendessen", SNACK: "Snacks" };
const today = new Date().toISOString().slice(0, 10);

export default function Meals() {
  const [foodId, setFoodId] = useState("");
  const [amount, setAmount] = useState(100);
  const { data: foods } = useApi<Food[]>("/foods", []);
  const { data: meals, reload } = useApi<Array<{ id: string; type: keyof typeof labels; items: Array<{ id: string; amount: number; food: Food }> }>>(`/meals/day/${today}`, []);

  async function add(type: keyof typeof labels) {
    if (!foodId) return;
    await api("/meals/items", { method: "POST", body: JSON.stringify({ date: today, type, foodId, amount, unit: "g" }) });
    toast.success("Mahlzeit aktualisiert");
    await reload();
  }

  return (
    <div className="space-y-4">
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
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{labels[type]}</h2><Button onClick={() => add(type)}><Plus size={18} />Hinzufügen</Button></div>
              <div className="space-y-2">
                {meal?.items.map((item) => <div key={item.id} className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{item.food.name} · {item.amount} g · {Math.round(item.food.caloriesPer100g * item.amount / 100)} kcal</div>)}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
