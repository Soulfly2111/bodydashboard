import { useState } from "react";
import { Activity, Beef, CalendarDays, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Flame, GlassWater, Scale, Wheat } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ProgressRing } from "../components/dashboard/ProgressRing";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { DayStats, Food, MacroTotals, WeekDay } from "../types/domain";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(value: string, days: number) {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function mondayOf(value: string) {
  const date = fromDateKey(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return toDateKey(date);
}

const today = toDateKey(new Date());
const dateFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

type TrackingSettings = {
  trackWeight?: boolean;
  trackWater?: boolean;
};

type WeekStats = {
  start: string;
  end: string;
  days: WeekDay[];
  averages: MacroTotals & { waterMl?: number };
};

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(today);
  const weekStart = mondayOf(selectedDate);
  const weekEnd = shiftDate(weekStart, 6);
  const selectedDateObject = fromDateKey(selectedDate);
  const selectedDateLabel = selectedDate === today ? "Heute" : dateFormatter.format(selectedDateObject);
  const { data, reload } = useApi<DayStats>(`/stats/day/${selectedDate}`, {
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    waterMl: 0,
    bmi: null,
    goal: { calories: 2200, protein: 150, carbs: 250, fat: 70, waterMl: 2500 }
  });
  const { data: week, reload: reloadWeek } = useApi<WeekStats>(`/stats/week?start=${weekStart}`, {
    start: weekStart,
    end: weekEnd,
    days: [],
    averages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 }
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
  const weekTotals = week.days.reduce(
    (totals, day) => ({
      calories: totals.calories + day.calories,
      protein: totals.protein + day.protein,
      carbs: totals.carbs + day.carbs,
      fat: totals.fat + day.fat,
      waterMl: totals.waterMl + (day.waterMl ?? 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 }
  );
  const weekGoalItems = [
    { label: "Kalorien", value: weekTotals.calories, goal: data.goal.calories * 7, unit: "kcal", color: "bg-rose-500" },
    { label: "Protein", value: weekTotals.protein, goal: data.goal.protein * 7, unit: "g", color: "bg-teal-500" },
    { label: "Kohlenhydrate", value: weekTotals.carbs, goal: data.goal.carbs * 7, unit: "g", color: "bg-amber-400" },
    { label: "Fett", value: weekTotals.fat, goal: data.goal.fat * 7, unit: "g", color: "bg-red-400" },
    ...(showWater ? [{ label: "Wasser", value: weekTotals.waterMl, goal: data.goal.waterMl * 7, unit: "ml", color: "bg-blue-500" }] : [])
  ];

  async function addWater(amountMl: number) {
    await api("/water", { method: "POST", body: JSON.stringify({ amountMl, date: selectedDate }) });
    await reload();
    await reloadWeek();
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-mint" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Ausgewählter Tag</p>
              <h2 className="text-xl font-bold">{selectedDateLabel}</h2>
              <p className="text-sm text-slate-500">{dateFormatter.format(selectedDateObject)}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:flex">
            <Button type="button" className="px-3" onClick={() => setSelectedDate((date) => shiftDate(date, -7))} aria-label="Eine Woche zurück"><ChevronsLeft size={18} /></Button>
            <Button type="button" className="px-3" onClick={() => setSelectedDate((date) => shiftDate(date, -1))} aria-label="Ein Tag zurück"><ChevronLeft size={18} /></Button>
            <Button type="button" className="px-3" onClick={() => setSelectedDate((date) => shiftDate(date, 1))} aria-label="Ein Tag vor"><ChevronRight size={18} /></Button>
            <Button type="button" className="px-3" onClick={() => setSelectedDate((date) => shiftDate(date, 7))} aria-label="Eine Woche vor"><ChevronsRight size={18} /></Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Flame} label={selectedDate === today ? "Kalorien heute" : "Kalorien"} value={Math.round(data.totals.calories)} unit="kcal" />
        <MetricCard icon={Beef} label="Protein" value={Math.round(data.totals.protein)} unit="g" />
        <MetricCard icon={Wheat} label="Ballaststoffe" value={Math.round(data.totals.fiber)} unit="g" />
        {showWeight && <MetricCard icon={Scale} label="Gewicht / BMI" value={data.weight?.weightKg ?? "-"} unit={data.bmi ? `kg · BMI ${data.bmi}` : "kg"} />}
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Woche</p>
            <h2 className="font-bold">{dateFormatter.format(fromDateKey(week.start))} - {dateFormatter.format(fromDateKey(week.end))}</h2>
          </div>
          <div className="text-sm text-slate-500">
            Ø {Math.round(week.averages.calories)} kcal · P {Math.round(week.averages.protein)} g · Wasser {Math.round(week.averages.waterMl ?? 0)} ml
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-7">
          {week.days.map((day) => {
            const isSelected = day.date === selectedDate;
            const dayObject = fromDateKey(day.date);
            return (
              <button
                type="button"
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className={`rounded-lg border p-3 text-left transition ${
                  isSelected
                    ? "border-mint bg-mint/10 text-ink dark:text-white"
                    : "border-slate-200 bg-slate-100 hover:border-mint/60 dark:border-slate-800 dark:bg-slate-800"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="font-bold">{weekdayFormatter.format(dayObject)}</span>
                  <span className="text-xs text-slate-500">{String(dayObject.getDate()).padStart(2, "0")}.</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{Math.round(day.calories)} kcal</p>
                  <p className="text-slate-500">P {Math.round(day.protein)} · C {Math.round(day.carbs)} · F {Math.round(day.fat)}</p>
                  {showWater && <p className="text-slate-500">{Math.round(day.waterMl ?? 0)} ml Wasser</p>}
                  {showWeight && <p className="text-slate-500">{day.weightKg ? `${day.weightKg} kg` : "kein Gewicht"}</p>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {weekGoalItems.map((item) => {
            const percent = item.goal > 0 ? Math.round((item.value / item.goal) * 100) : 0;
            return (
              <div key={item.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-slate-500">{percent}%</span>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
                <p className="text-sm text-slate-500">
                  {Math.round(item.value)} / {Math.round(item.goal)} {item.unit}
                </p>
                <p className="text-xs text-slate-400">
                  Ø {Math.round(item.value / 7)} {item.unit} pro Tag
                </p>
              </div>
            );
          })}
        </div>
      </Card>

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
