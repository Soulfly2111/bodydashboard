import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { Camera, Images, LineChart as LineChartIcon, Ruler, Save, Sparkles, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import type { BodyMeasurement, BodyPhoto, BodyProgressStatistics } from "../types/domain";

const today = new Date().toISOString().slice(0, 10);
const views = [
  ["FRONT", "Vorderansicht"],
  ["BACK", "Rückansicht"],
  ["LEFT", "Links"],
  ["RIGHT", "Rechts"],
  ["CUSTOM", "Zusatzbild"]
] as const;

type MeasurementType = { slug: string; name: string; unit?: string };

export default function BodyProgress() {
  const [photo, setPhoto] = useState({ date: today, viewType: "FRONT", imageUrl: "", notes: "", trainingPhase: "", dietPhase: "", referenceObject: "" });
  const [measurement, setMeasurement] = useState({ date: today, measurementType: "Bauchumfang", value: "", notes: "" });
  const { data: photos, reload: reloadPhotos } = useApi<BodyPhoto[]>("/body-progress/photos", []);
  const { data: measurements, reload: reloadMeasurements } = useApi<BodyMeasurement[]>("/body-progress/measurements", []);
  const { data: types } = useApi<MeasurementType[]>("/body-progress/measurement-types", []);
  const { data: stats, reload: reloadStats } = useApi<BodyProgressStatistics>("/body-progress/statistics", { latestPhoto: null, latestMeasurements: {}, changes: {}, ratios: { waistToHip: null, waistToHeight: null }, series: {}, photoCount: 0 });
  const [analysisText, setAnalysisText] = useState("");

  const chartData = useMemo(() => stats.series["Bauchumfang"] ?? stats.series["Taillenumfang"] ?? [], [stats.series]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto((current) => ({ ...current, imageUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function savePhoto(event: FormEvent) {
    event.preventDefault();
    await api("/body-progress/photos", { method: "POST", body: JSON.stringify(photo) });
    setPhoto({ date: today, viewType: "FRONT", imageUrl: "", notes: "", trainingPhase: "", dietPhase: "", referenceObject: "" });
    await reloadPhotos();
    await reloadStats();
    toast.success("Fortschrittsbild gespeichert");
  }

  async function saveMeasurement(event: FormEvent) {
    event.preventDefault();
    await api("/body-progress/measurements", { method: "POST", body: JSON.stringify({ ...measurement, value: Number(measurement.value), unit: "cm" }) });
    setMeasurement({ date: today, measurementType: measurement.measurementType, value: "", notes: "" });
    await reloadMeasurements();
    await reloadStats();
    toast.success("Körpermaß gespeichert");
  }

  async function analyzePhoto(id: string) {
    const result = await api<{ analysisText: string }>(`/body-progress/photos/${id}/analyze`, { method: "POST" });
    setAnalysisText(result.analysisText);
    await reloadPhotos();
    toast.success("Analyse erstellt");
  }

  async function deletePhoto(id: string) {
    await api(`/body-progress/photos/${id}`, { method: "DELETE" });
    await reloadPhotos();
    await reloadStats();
  }

  async function deleteMeasurement(id: string) {
    await api(`/body-progress/measurements/${id}`, { method: "DELETE" });
    await reloadMeasurements();
    await reloadStats();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Fotos</p><p className="mt-2 text-3xl font-bold">{stats.photoCount}</p></Card>
        <Card><p className="text-sm text-slate-500">Bauch 30 Tage</p><p className="mt-2 text-3xl font-bold">{stats.changes.abdomen30 ?? 0} cm</p></Card>
        <Card><p className="text-sm text-slate-500">Taille 30 Tage</p><p className="mt-2 text-3xl font-bold">{stats.changes.waist30 ?? 0} cm</p></Card>
        <Card><p className="text-sm text-slate-500">Taille/Hüfte</p><p className="mt-2 text-3xl font-bold">{stats.ratios.waistToHip ?? "-"}</p></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2"><Camera className="text-mint" /><h2 className="font-bold">Foto hinzufügen</h2></div>
          <form onSubmit={savePhoto} className="grid gap-3">
            <Input type="date" value={photo.date} onChange={(event) => setPhoto({ ...photo, date: event.target.value })} />
            <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={photo.viewType} onChange={(event) => setPhoto({ ...photo, viewType: event.target.value })}>
              {views.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Input type="file" accept="image/*" capture="environment" onChange={handleFile} />
            <Input value={photo.referenceObject} onChange={(event) => setPhoto({ ...photo, referenceObject: event.target.value })} placeholder="Referenzobjekt, z. B. Maßband" />
            <Input value={photo.trainingPhase} onChange={(event) => setPhoto({ ...photo, trainingPhase: event.target.value })} placeholder="Trainingsphase" />
            <Input value={photo.dietPhase} onChange={(event) => setPhoto({ ...photo, dietPhase: event.target.value })} placeholder="Diätphase" />
            <Input value={photo.notes} onChange={(event) => setPhoto({ ...photo, notes: event.target.value })} placeholder="Notizen" />
            {photo.imageUrl && <img src={photo.imageUrl} className="max-h-64 rounded-lg object-cover" alt="Vorschau" />}
            <Button disabled={!photo.imageUrl}><Save size={18} />Foto speichern</Button>
          </form>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2"><Ruler className="text-mint" /><h2 className="font-bold">Körpermaße</h2></div>
          <form onSubmit={saveMeasurement} className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input type="date" value={measurement.date} onChange={(event) => setMeasurement({ ...measurement, date: event.target.value })} />
            <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={measurement.measurementType} onChange={(event) => setMeasurement({ ...measurement, measurementType: event.target.value })}>
              {types.map((type) => <option key={type.slug} value={type.name}>{type.name}</option>)}
            </select>
            <Input type="number" step="0.1" value={measurement.value} onChange={(event) => setMeasurement({ ...measurement, value: event.target.value })} placeholder="cm" />
            <Input className="sm:col-span-2" value={measurement.notes} onChange={(event) => setMeasurement({ ...measurement, notes: event.target.value })} placeholder="Notiz" />
            <Button><Save size={18} />Speichern</Button>
          </form>
          <div className="h-64">
            <ResponsiveContainer><LineChart data={chartData}><XAxis dataKey="date" /><YAxis /><Tooltip /><Line dataKey="value" stroke="#26A69A" strokeWidth={3} /></LineChart></ResponsiveContainer>
          </div>
        </Card>
      </div>

      {analysisText && <Card><div className="flex gap-2"><Sparkles className="text-mint" /><p>{analysisText}</p></div></Card>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2"><Images className="text-mint" /><h2 className="font-bold">Fortschrittsbilder</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <img src={item.thumbnailUrl ?? item.imageUrl} className="mb-3 aspect-[4/5] w-full rounded-lg object-cover" alt={item.viewType} />
                <p className="font-semibold">{item.viewType} · {item.date.slice(0, 10)}</p>
                <p className="text-sm text-slate-500">{item.notes}</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" className="px-3" onClick={() => analyzePhoto(item.id)}><Sparkles size={18} /></Button>
                  <Button type="button" className="bg-red-500 px-3 text-white" onClick={() => deletePhoto(item.id)}><Trash2 size={18} /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2"><LineChartIcon className="text-mint" /><h2 className="font-bold">Letzte Maße</h2></div>
          <div className="space-y-2">
            {measurements.slice(0, 12).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <div><p className="font-semibold">{item.measurementType}</p><p className="text-slate-500">{item.date.slice(0, 10)} · {item.source}</p></div>
                <div className="flex items-center gap-3"><span className="font-bold">{item.value} {item.unit}</span><button onClick={() => deleteMeasurement(item.id)}><Trash2 size={16} /></button></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
