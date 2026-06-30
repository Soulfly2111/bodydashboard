import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";

export default function Weight() {
  const [days, setDays] = useState(30);
  const [weightKg, setWeightKg] = useState("");
  const { data, reload } = useApi<Array<{ date: string; weightKg: number }>>(`/weight?days=${days}`, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/weight", { method: "POST", body: JSON.stringify({ weightKg: Number(weightKg) }) });
    setWeightKg("");
    toast.success("Gewicht gespeichert");
    await reload();
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[.6fr_1.4fr]">
      <Card><h2 className="mb-4 font-bold">Gewicht erfassen</h2><form onSubmit={save} className="space-y-3"><Input type="number" step="0.1" placeholder="kg" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /><Button>Speichern</Button></form></Card>
      <Card><div className="mb-4 flex gap-2">{[30, 90, 365].map((range) => <Button key={range} className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={() => setDays(range)}>{range === 365 ? "1 Jahr" : `${range} Tage`}</Button>)}</div><div className="h-80"><ResponsiveContainer><LineChart data={data}><XAxis dataKey="date" /><YAxis domain={["dataMin - 2", "dataMax + 2"]} /><Tooltip /><Line dataKey="weightKg" stroke="#9B5DE5" strokeWidth={3} /></LineChart></ResponsiveContainer></div></Card>
    </div>
  );
}
