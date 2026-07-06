import { type FormEvent, useMemo, useState } from "react";
import { Activity, Flame, Pencil, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import type { ActivityEntry, ActivityTypeOption } from "../types/domain";

const today = new Date().toISOString().slice(0, 10);
const intensities = [
  ["VERY_LIGHT", "Sehr leicht"],
  ["LIGHT", "Leicht"],
  ["MEDIUM", "Mittel"],
  ["HIGH", "Hoch"],
  ["VERY_HIGH", "Sehr hoch"]
] as const;

type ActivityForm = {
  id?: string;
  typeName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  intensity: ActivityEntry["intensity"];
  distanceKm: string;
  averageHeartRate: string;
  maxHeartRate: string;
  calories: string;
  steps: string;
  notes: string;
  muscleGroups: string;
  exercisesCount: string;
  setsCount: string;
  repsCount: string;
  trainingVolume: string;
};

function emptyForm(): ActivityForm {
  return {
    typeName: "Krafttraining",
    date: today,
    startTime: "",
    endTime: "",
    durationMinutes: "60",
    intensity: "MEDIUM",
    distanceKm: "",
    averageHeartRate: "",
    maxHeartRate: "",
    calories: "",
    steps: "",
    notes: "",
    muscleGroups: "",
    exercisesCount: "",
    setsCount: "",
    repsCount: "",
    trainingVolume: ""
  };
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

export default function Activities() {
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const { data: types } = useApi<ActivityTypeOption[]>("/activities/types", []);
  const { data: activities, reload } = useApi<ActivityEntry[]>("/activities?limit=120", []);
  const { data: stats, reload: reloadStats } = useApi<{ totals: { count: number; calories: number; durationMinutes: number; activeDays: number }; averages: { calories: number; durationMinutes: number }; favoriteActivity?: string | null }>("/activities/statistics", { totals: { count: 0, calories: 0, durationMinutes: 0, activeDays: 0 }, averages: { calories: 0, durationMinutes: 0 } });

  const chartData = useMemo(() => {
    const byDate = activities.reduce<Record<string, { date: string; calories: number; durationMinutes: number }>>((acc, activity) => {
      const key = dateKey(activity.date);
      acc[key] ??= { date: key, calories: 0, durationMinutes: 0 };
      acc[key].calories += activity.calories;
      acc[key].durationMinutes += activity.durationMinutes;
      return acc;
    }, {});
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [activities]);

  async function saveActivity(event: FormEvent) {
    event.preventDefault();
    const payload = {
      typeName: form.typeName,
      date: form.date,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      durationMinutes: Number(form.durationMinutes),
      intensity: form.intensity,
      distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
      averageHeartRate: form.averageHeartRate ? Number(form.averageHeartRate) : null,
      maxHeartRate: form.maxHeartRate ? Number(form.maxHeartRate) : null,
      calories: form.calories ? Number(form.calories) : null,
      steps: form.steps ? Number(form.steps) : null,
      notes: form.notes || null,
      muscleGroups: form.muscleGroups ? form.muscleGroups.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      exercisesCount: form.exercisesCount ? Number(form.exercisesCount) : null,
      setsCount: form.setsCount ? Number(form.setsCount) : null,
      repsCount: form.repsCount ? Number(form.repsCount) : null,
      trainingVolume: form.trainingVolume ? Number(form.trainingVolume) : null
    };
    if (form.id) await api(`/activities/${form.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/activities", { method: "POST", body: JSON.stringify(payload) });
    setForm(emptyForm());
    await reload();
    await reloadStats();
    toast.success("Aktivität gespeichert");
  }

  async function deleteActivity(id: string) {
    await api(`/activities/${id}`, { method: "DELETE" });
    await reload();
    await reloadStats();
    toast.success("Aktivität gelöscht");
  }

  function editActivity(activity: ActivityEntry) {
    setForm({
      id: activity.id,
      typeName: activity.typeName,
      date: dateKey(activity.date),
      startTime: activity.startTime ?? "",
      endTime: activity.endTime ?? "",
      durationMinutes: String(activity.durationMinutes),
      intensity: activity.intensity,
      distanceKm: activity.distanceKm ? String(activity.distanceKm) : "",
      averageHeartRate: activity.averageHeartRate ? String(activity.averageHeartRate) : "",
      maxHeartRate: activity.maxHeartRate ? String(activity.maxHeartRate) : "",
      calories: activity.caloriesOverride ? String(Math.round(activity.calories)) : "",
      steps: activity.steps ? String(activity.steps) : "",
      notes: activity.notes ?? "",
      muscleGroups: activity.muscleGroupsJson ? JSON.parse(activity.muscleGroupsJson).join(", ") : "",
      exercisesCount: activity.exercisesCount ? String(activity.exercisesCount) : "",
      setsCount: activity.setsCount ? String(activity.setsCount) : "",
      repsCount: activity.repsCount ? String(activity.repsCount) : "",
      trainingVolume: activity.trainingVolume ? String(activity.trainingVolume) : ""
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Aktivitäten</p><p className="mt-2 text-3xl font-bold">{stats.totals.count}</p></Card>
        <Card><p className="text-sm text-slate-500">Trainingszeit</p><p className="mt-2 text-3xl font-bold">{stats.totals.durationMinutes} min</p></Card>
        <Card><p className="text-sm text-slate-500">Kalorienverbrauch</p><p className="mt-2 text-3xl font-bold">{stats.totals.calories} kcal</p></Card>
        <Card><p className="text-sm text-slate-500">Aktive Tage</p><p className="mt-2 text-3xl font-bold">{stats.totals.activeDays}</p></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2"><Plus className="text-mint" /><h2 className="font-bold">{form.id ? "Aktivität bearbeiten" : "Aktivität hinzufügen"}</h2></div>
          <form onSubmit={saveActivity} className="grid gap-3">
            <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={form.typeName} onChange={(event) => setForm({ ...form, typeName: event.target.value })}>
              {types.map((type) => <option key={type.slug} value={type.name}>{type.name}</option>)}
              {!types.length && <option>Krafttraining</option>}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={form.intensity} onChange={(event) => setForm({ ...form, intensity: event.target.value as ActivityEntry["intensity"] })}>
                {intensities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} placeholder="Start" />
              <Input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} placeholder="Ende" />
              <Input type="number" min="1" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} placeholder="Dauer Minuten" />
              <Input type="number" min="0" step="0.1" value={form.distanceKm} onChange={(event) => setForm({ ...form, distanceKm: event.target.value })} placeholder="Distanz km" />
              <Input type="number" min="0" value={form.calories} onChange={(event) => setForm({ ...form, calories: event.target.value })} placeholder="Kalorien überschreiben" />
              <Input type="number" min="0" value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} placeholder="Schritte" />
              <Input type="number" min="0" value={form.averageHeartRate} onChange={(event) => setForm({ ...form, averageHeartRate: event.target.value })} placeholder="Ø Puls" />
              <Input type="number" min="0" value={form.maxHeartRate} onChange={(event) => setForm({ ...form, maxHeartRate: event.target.value })} placeholder="Max Puls" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={form.muscleGroups} onChange={(event) => setForm({ ...form, muscleGroups: event.target.value })} placeholder="Muskelgruppen" />
              <Input type="number" value={form.exercisesCount} onChange={(event) => setForm({ ...form, exercisesCount: event.target.value })} placeholder="Übungen" />
              <Input type="number" value={form.setsCount} onChange={(event) => setForm({ ...form, setsCount: event.target.value })} placeholder="Sätze" />
              <Input type="number" value={form.repsCount} onChange={(event) => setForm({ ...form, repsCount: event.target.value })} placeholder="Wiederholungen" />
            </div>
            <Input value={form.trainingVolume} onChange={(event) => setForm({ ...form, trainingVolume: event.target.value })} placeholder="Trainingsvolumen" />
            <Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notizen" />
            <div className="flex flex-wrap gap-2">
              <Button><Save size={18} />Speichern</Button>
              {form.id && <Button type="button" className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={() => setForm(emptyForm())}>Abbrechen</Button>}
            </div>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2"><Activity className="text-mint" /><h2 className="font-bold">Aktivitätsverlauf</h2></div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area dataKey="calories" stroke="#7C3AED" fill="#7C3AED33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold">Letzte Aktivitäten</h2>
          <div className="text-sm text-slate-500">Lieblingssport: {stats.favoriteActivity ?? "-"}</div>
        </div>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="grid gap-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold">{activity.typeName}</p>
                <p className="text-sm text-slate-500">{dateKey(activity.date)} · {activity.durationMinutes} min · {Math.round(activity.calories)} kcal · {activity.intensity}</p>
                {activity.notes && <p className="mt-1 text-sm text-slate-500">{activity.notes}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="button" className="px-3" onClick={() => editActivity(activity)}><Pencil size={18} /></Button>
                <Button type="button" className="bg-red-500 px-3 text-white" onClick={() => deleteActivity(activity.id)}><Trash2 size={18} /></Button>
              </div>
            </div>
          ))}
          {!activities.length && <p className="text-sm text-slate-500">Noch keine Aktivitäten gespeichert.</p>}
        </div>
      </Card>
    </div>
  );
}
