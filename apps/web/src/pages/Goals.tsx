import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { Goal } from "../types/domain";

type ActivityGoal = {
  trainingDaysPerWeek: number;
  trainingMinutesPerWeek: number;
  caloriesPerWeek: number;
  stepsPerDay: number;
  strengthSessionsPerWeek: number;
  cardioSessionsPerWeek: number;
};

export default function Goals() {
  const { data } = useApi<Goal>("/goals", { calories: 2200, protein: 150, carbs: 250, fat: 70, waterMl: 2500 });
  const { data: activityGoal } = useApi<ActivityGoal>("/activities/goals", { trainingDaysPerWeek: 3, trainingMinutesPerWeek: 180, caloriesPerWeek: 1500, stepsPerDay: 8000, strengthSessionsPerWeek: 2, cardioSessionsPerWeek: 2 });
  const [form, setForm] = useState<Goal | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityGoal | null>(null);
  const current = form ?? data;
  const currentActivityGoal = activityForm ?? activityGoal;

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/goals", { method: "PUT", body: JSON.stringify(current) });
    setForm(null);
    toast.success("Ziele gespeichert");
  }

  async function saveActivityGoal(event: FormEvent) {
    event.preventDefault();
    await api("/activities/goals", { method: "PUT", body: JSON.stringify(currentActivityGoal) });
    setActivityForm(null);
    toast.success("Aktivitätsziele gespeichert");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="mb-4 font-bold">Tagesziele</h2>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {(["calories", "protein", "carbs", "fat", "waterMl", "weightKg"] as const).map((key) => (
            <label key={key} className="text-sm font-medium capitalize">{key}<Input type="number" step="0.1" value={current[key] ?? ""} onChange={(e) => setForm({ ...current, [key]: Number(e.target.value) })} /></label>
          ))}
          <Button className="sm:col-span-2">Ziele speichern</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">Aktivitätsziele</h2>
        <form onSubmit={saveActivityGoal} className="grid gap-3 sm:grid-cols-2">
          {([
            "trainingDaysPerWeek",
            "trainingMinutesPerWeek",
            "caloriesPerWeek",
            "stepsPerDay",
            "strengthSessionsPerWeek",
            "cardioSessionsPerWeek"
          ] as const).map((key) => (
            <label key={key} className="text-sm font-medium">{key}<Input type="number" value={currentActivityGoal[key] ?? ""} onChange={(e) => setActivityForm({ ...currentActivityGoal, [key]: Number(e.target.value) })} /></label>
          ))}
          <Button className="sm:col-span-2">Aktivitätsziele speichern</Button>
        </form>
      </Card>
    </div>
  );
}
