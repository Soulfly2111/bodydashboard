import { Activity, Beef, Flame, GlassWater, Scale, Wheat } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ProgressRing } from "../components/dashboard/ProgressRing";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { DayStats, Food } from "../types/domain";

const today = new Date().toISOString().slice(0, 10);

type TrackingSettings = {
  trackWeight?: boolean;
  trackWater?: boolean;
};

export default function Dashboard() {
  const { data, reload } = useApi<DayStats>(`/stats/day/${today}`, {
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    waterMl: 0,
    bmi: null,
    goal: { calories: 2200, protein: 150, carbs: 250, fat: 70, waterMl: 2500 }
  });
  const { data: settings } = useApi<TrackingSettings>("/auth/me", {});
  const { data: favoriteFoods } = useApi<Food[]>("/favorites/foods", []);
  const showWeight = settings.trackWeight ?? true;
  const showWater = settings.trackWater ?? true;

  const donut = [
    { name: "Protein", value: data.totals.protein, goal: data.goal.protein, color: "#26A69A" },
    { name: "Kohlenhydrate", value: data.totals.carbs, goal: data.goal.carbs, color: "#F4B942" },
    { name: "Fett", value: data.totals.fat, goal: data.goal.fat, color: "#FF6B5F" }
  ];
  const macroTotal = donut.reduce((sum, item) => sum + item.value, 0);

  async function addWater(amountMl: number) {
    await api("/water", { method: "POST", body: JSON.stringify({ amountMl }) });
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Flame} label="Kalorien heute" value={Math.round(data.totals.calories)} unit="kcal" />
        <MetricCard icon={Beef} label="Protein" value={Math.round(data.totals.protein)} unit="g" />
        <MetricCard icon={Wheat} label="Ballaststoffe" value={Math.round(data.totals.fiber)} unit="g" />
        {showWeight && <MetricCard icon={Scale} label="Gewicht / BMI" value={data.weight?.weightKg ?? "-"} unit={data.bmi ? `kg · BMI ${data.bmi}` : "kg"} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="grid gap-x-5 gap-y-6 sm:grid-cols-2 2xl:grid-cols-3">
          <ProgressRing label="Kalorien" value={data.totals.calories} goal={data.goal.calories} color="#FF6B5F" />
          <ProgressRing label="Protein" value={data.totals.protein} goal={data.goal.protein} color="#26A69A" />
          <ProgressRing label="Kohlenhydrate" value={data.totals.carbs} goal={data.goal.carbs} color="#F4B942" />
          <ProgressRing label="Fett" value={data.totals.fat} goal={data.goal.fat} color="#FF6B5F" />
          {showWater && <ProgressRing label="Wasser" value={data.waterMl} goal={data.goal.waterMl} color="#3B82F6" />}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Makroverteilung</h2>
            <Activity size={20} className="text-mint" />
          </div>
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} innerRadius={58} outerRadius={82} dataKey="value" paddingAngle={3}>
                  {donut.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">gesamt</p>
                <p className="text-xl font-bold">{Math.round(macroTotal)} g</p>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {donut.map((item) => {
              const percent = macroTotal ? Math.round((item.value / macroTotal) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate font-medium">{item.name}</span>
                  </div>
                  <span className="shrink-0 font-semibold">
                    {Math.round(item.value)} / {item.goal} g · {percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {showWater && (
        <Card>
          <div className="mb-4 flex items-center gap-2"><GlassWater className="text-blue-500" /><h2 className="font-bold">Wassertracker</h2></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[250, 500, 750, 1000].map((amount) => <Button key={amount} onClick={() => addWater(amount)}>+{amount} ml</Button>)}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-bold">Schnelle Favoriten</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {favoriteFoods.slice(0, 4).map((food) => (
            <div key={food.id} className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
              <p className="truncate font-semibold">{food.name}</p>
              <p className="text-sm text-slate-500">{food.caloriesPer100g} kcal · P {food.protein} C {food.carbs} F {food.fat}</p>
            </div>
          ))}
          {!favoriteFoods.length && <p className="text-sm text-slate-500">Noch keine Favoriten gespeichert.</p>}
        </div>
      </Card>
    </div>
  );
}
