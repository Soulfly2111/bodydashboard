import { type FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { Goal } from "../types/domain";

export default function Goals() {
  const { data } = useApi<Goal>("/goals", { calories: 2200, protein: 150, carbs: 250, fat: 70, waterMl: 2500 });
  const [form, setForm] = useState<Goal | null>(null);
  const current = form ?? data;

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/goals", { method: "PUT", body: JSON.stringify(current) });
    setForm(null);
    toast.success("Ziele gespeichert");
  }

  return (
    <Card className="max-w-3xl">
      <h2 className="mb-4 font-bold">Tagesziele</h2>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        {(["calories", "protein", "carbs", "fat", "waterMl", "weightKg"] as const).map((key) => (
          <label key={key} className="text-sm font-medium capitalize">{key}<Input type="number" step="0.1" value={current[key] ?? ""} onChange={(e) => setForm({ ...current, [key]: Number(e.target.value) })} /></label>
        ))}
        <Button className="sm:col-span-2">Ziele speichern</Button>
      </form>
    </Card>
  );
}
