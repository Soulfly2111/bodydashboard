import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/ui/Card";
import { useApi } from "../hooks/useApi";
import type { MacroTotals, WeekDay } from "../types/domain";

export default function Week() {
  const { data } = useApi<{ days: WeekDay[]; averages: MacroTotals }>("/stats/week", { days: [], averages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } });
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="mb-4 font-bold">Kalorienverlauf</h2>
        <div className="h-72"><ResponsiveContainer><AreaChart data={data.days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Area dataKey="calories" stroke="#FF6B5F" fill="#FF6B5F33" /></AreaChart></ResponsiveContainer></div>
      </Card>
      <Card>
        <h2 className="mb-4 font-bold">Proteinverlauf</h2>
        <div className="h-72"><ResponsiveContainer><LineChart data={data.days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line dataKey="protein" stroke="#26A69A" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
      </Card>
      <Card className="xl:col-span-2">
        <h2 className="mb-3 font-bold">Durchschnitt letzte 7 Tage</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(data.averages).slice(0, 4).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800"><p className="text-sm capitalize text-slate-500">{key}</p><p className="text-2xl font-bold">{Math.round(value)}</p></div>)}
        </div>
      </Card>
    </div>
  );
}
