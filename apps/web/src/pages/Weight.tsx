import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

type BodyEntry = {
  date: string;
  weightKg?: number | null;
  bodyFatPercent?: number | null;
  muscleMassKg?: number | null;
};

type TrackingSettings = {
  trackWeight?: boolean;
  trackBodyFat?: boolean;
  trackMuscleMass?: boolean;
};

export default function Weight() {
  const [days, setDays] = useState(30);
  const [form, setForm] = useState({ weightKg: "", bodyFatPercent: "", muscleMassKg: "" });
  const { data: settings } = useApi<TrackingSettings>("/auth/me", {});
  const { data, reload } = useApi<BodyEntry[]>(`/weight?days=${days}`, []);

  const showWeight = settings.trackWeight ?? true;
  const showBodyFat = settings.trackBodyFat ?? true;
  const showMuscleMass = settings.trackMuscleMass ?? true;

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/weight", {
      method: "POST",
      body: JSON.stringify({
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        bodyFatPercent: form.bodyFatPercent ? Number(form.bodyFatPercent) : undefined,
        muscleMassKg: form.muscleMassKg ? Number(form.muscleMassKg) : undefined
      })
    });
    setForm({ weightKg: "", bodyFatPercent: "", muscleMassKg: "" });
    toast.success("Körperwerte gespeichert");
    await reload();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[.6fr_1.4fr]">
      <Card>
        <h2 className="mb-4 font-bold">Körperwerte erfassen</h2>
        <form onSubmit={save} className="space-y-3">
          {showWeight && <Input type="number" step="0.1" placeholder="Gewicht in kg" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />}
          {showBodyFat && <Input type="number" step="0.1" placeholder="Körperfett in %" value={form.bodyFatPercent} onChange={(e) => setForm({ ...form, bodyFatPercent: e.target.value })} />}
          {showMuscleMass && <Input type="number" step="0.1" placeholder="Muskelmasse in kg" value={form.muscleMassKg} onChange={(e) => setForm({ ...form, muscleMassKg: e.target.value })} />}
          {!showWeight && !showBodyFat && !showMuscleMass && <p className="text-sm text-slate-500">Aktiviere Körperwert-Tracking in den Einstellungen.</p>}
          <Button disabled={!showWeight && !showBodyFat && !showMuscleMass}>Speichern</Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {[30, 90, 365].map((range) => <Button key={range} className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={() => setDays(range)}>{range === 365 ? "1 Jahr" : `${range} Tage`}</Button>)}
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              {showWeight && <Line connectNulls dataKey="weightKg" name="Gewicht kg" stroke="#9B5DE5" strokeWidth={3} />}
              {showBodyFat && <Line connectNulls dataKey="bodyFatPercent" name="Körperfett %" stroke="#FF6B6B" strokeWidth={3} />}
              {showMuscleMass && <Line connectNulls dataKey="muscleMassKg" name="Muskelmasse kg" stroke="#2AA99F" strokeWidth={3} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
