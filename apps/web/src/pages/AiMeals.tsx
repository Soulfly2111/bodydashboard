import { Camera, Clipboard, ImagePlus, Plus, Save, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { AiMealAnalysis, AiRecognitionSettings, AiRecognizedMealItem, MacroTotals } from "../types/domain";

type ImageDraft = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

const today = new Date().toISOString().slice(0, 10);
const defaultSettings: AiRecognitionSettings = {
  mode: "REVIEW_REQUIRED",
  minConfidence: 90,
  storeImages: false,
  deleteAfterAnalysis: true,
  linkImageToMeal: false,
  provider: "local"
};

const emptyItem: AiRecognizedMealItem = {
  name: "",
  category: "",
  amount: 1,
  weightGrams: 100,
  servingName: "Portion",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  salt: 0,
  confidence: 50,
  source: "manual"
};

export default function AiMeals() {
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [mealType, setMealType] = useState("SNACK");
  const [customMealTag, setCustomMealTag] = useState("");
  const [date, setDate] = useState(today);
  const [settings, setSettings] = useState(defaultSettings);
  const [analysis, setAnalysis] = useState<AiMealAnalysis | null>(null);
  const [items, setItems] = useState<AiRecognizedMealItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const { data: loadedSettings, reload: reloadSettings } = useApi<AiRecognitionSettings>("/ai-meals/settings", defaultSettings);
  const { data: history, reload: reloadHistory } = useApi<AiMealAnalysis[]>("/ai-meals/history", []);

  useEffect(() => setSettings(loadedSettings), [loadedSettings]);
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const totals = useMemo(() => calculateTotals(items), [items]);

  async function addFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/")).slice(0, 5 - images.length);
    const drafts = await Promise.all(imageFiles.map(fileToDraft));
    setImages((current) => [...current, ...drafts].slice(0, 5));
  }

  async function analyze() {
    if (!images.length) {
      toast.error("Bitte zuerst ein Bild hinzufügen");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await api<{ analysis: AiMealAnalysis; totals: MacroTotals; autoSaved: boolean; mealId?: string }>("/ai-meals/analyze", {
        method: "POST",
        body: JSON.stringify({ images, date, mealType, customMealTag: customMealTag || undefined, mode: settings.mode, provider: settings.provider })
      });
      setAnalysis(result.analysis);
      setItems(result.analysis.items);
      await reloadHistory();
      toast.success(result.autoSaved ? "Mahlzeit automatisch gespeichert" : "Analyse erstellt");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveSettings() {
    await api("/ai-meals/settings", { method: "PUT", body: JSON.stringify(settings) });
    await reloadSettings();
    toast.success("KI-Einstellungen gespeichert");
  }

  async function confirmMeal() {
    if (!analysis) return;
    await api(`/ai-meals/analyses/${analysis.id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ date, mealType, customMealTag: customMealTag || undefined, saveUnknownFoods: true, items })
    });
    toast.success("Mahlzeit gespeichert");
    setAnalysis(null);
    setItems([]);
    setImages([]);
    await reloadHistory();
  }

  function updateItem(index: number, patch: Partial<AiRecognizedMealItem>) {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (patch.weightGrams && patch.weightGrams !== item.weightGrams) {
        const factor = patch.weightGrams / Math.max(item.weightGrams, 1);
        return {
          ...item,
          ...patch,
          calories: round(item.calories * factor),
          protein: round(item.protein * factor),
          carbs: round(item.carbs * factor),
          fat: round(item.fat * factor),
          fiber: round(item.fiber * factor),
          sugar: round(item.sugar * factor),
          salt: round(item.salt * factor)
        };
      }
      return { ...item, ...patch };
    }));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">KI-Mahlzeitenerkennung</h2>
            <p className="text-sm text-slate-500">Foto aufnehmen, prüfen, Nährwerte anpassen und als Mahlzeit speichern.</p>
          </div>
          <Button type="button" onClick={analyze} disabled={analyzing}><Sparkles size={18} />{analyzing ? "Analysiere..." : "Analysieren"}</Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_.9fr]">
          <div
            className="grid min-h-56 place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-100/60 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <div className="space-y-3">
              <UploadCloud className="mx-auto text-mint" size={36} />
              <p className="font-semibold">Bilder ablegen, einfügen oder auswählen</p>
              <p className="text-sm text-slate-500">Mehrere Bilder, Kameraaufnahme am Smartphone und Zwischenablage werden unterstützt.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white dark:bg-mint dark:text-slate-950">
                  <ImagePlus size={18} />Hochladen
                  <input className="hidden" type="file" accept="image/*" multiple onChange={(event) => void handleFileInput(event, addFiles)} />
                </label>
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-ink dark:bg-slate-800 dark:text-white">
                  <Camera size={18} />Kamera
                  <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void handleFileInput(event, addFiles)} />
                </label>
                <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 dark:border-slate-800">
                  <Clipboard size={18} />Strg+V
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={mealType} onChange={(event) => setMealType(event.target.value)}>
                <option value="BREAKFAST">Frühstück</option>
                <option value="LUNCH">Mittagessen</option>
                <option value="DINNER">Abendessen</option>
                <option value="SNACK">Snack</option>
                <option value="CUSTOM">Eigenes Tag</option>
              </select>
              {mealType === "CUSTOM" && <Input placeholder="Eigenes Mahlzeiten-Tag" value={customMealTag} onChange={(event) => setCustomMealTag(event.target.value)} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {images.map((image, index) => (
                <div key={`${image.fileName}-${index}`} className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  <img src={image.dataUrl} alt="" className="h-32 w-full object-cover" />
                  <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-white/90 dark:bg-slate-950/90" onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))} aria-label="Bild entfernen"><X size={16} /></button>
                  <p className="truncate px-2 py-1 text-xs text-slate-500">{image.fileName}</p>
                </div>
              ))}
              {!images.length && <p className="text-sm text-slate-500">Noch keine Bilder ausgewählt.</p>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Analyse-Vorschau</h2>
            <div className="flex gap-2">
              <Button type="button" className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={() => setItems((current) => [...current, emptyItem])}><Plus size={18} />Hinzufügen</Button>
              <Button type="button" onClick={confirmMeal} disabled={!analysis || !items.length}><Save size={18} />Speichern</Button>
            </div>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_.7fr_.7fr_.7fr_auto]">
                  <Input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="Lebensmittel" />
                  <Input type="number" value={item.weightGrams} onChange={(event) => updateItem(index, { weightGrams: Number(event.target.value) })} placeholder="Gramm" />
                  <Input value={item.category ?? ""} onChange={(event) => updateItem(index, { category: event.target.value })} placeholder="Kategorie" />
                  <Input type="number" value={item.confidence} onChange={(event) => updateItem(index, { confidence: Number(event.target.value) })} placeholder="Konfidenz" />
                  <button className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 dark:border-slate-800" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Lebensmittel löschen"><Trash2 size={18} /></button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  {(["calories", "protein", "carbs", "fat", "fiber", "sugar", "salt"] as const).map((key) => (
                    <Input key={key} type="number" step="0.1" value={item[key]} onChange={(event) => updateItem(index, { [key]: Number(event.target.value) })} placeholder={key} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Quelle: {item.source ?? "ai_estimate"} · {item.servingName ?? "Portion"}</p>
              </div>
            ))}
            {!items.length && <p className="text-sm text-slate-500">Nach der Analyse erscheinen hier die erkannten Lebensmittel.</p>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 font-bold">Finale Nährwerte</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Kalorien" value={`${totals.calories} kcal`} />
              <Metric label="Protein" value={`${totals.protein} g`} />
              <Metric label="Kohlenhydrate" value={`${totals.carbs} g`} />
              <Metric label="Fett" value={`${totals.fat} g`} />
              <Metric label="Ballaststoffe" value={`${totals.fiber} g`} />
              <Metric label="Salz" value={`${totals.salt ?? 0} g`} />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-bold">KI-Einstellungen</h2>
            <div className="grid gap-3">
              <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={settings.mode} onChange={(event) => setSettings({ ...settings, mode: event.target.value as AiRecognitionSettings["mode"] })}>
                <option value="AUTO">Automatisch speichern</option>
                <option value="REVIEW_REQUIRED">Vor dem Speichern bestätigen</option>
                <option value="ALWAYS_EDIT">Immer bearbeiten</option>
              </select>
              <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={settings.provider} onChange={(event) => setSettings({ ...settings, provider: event.target.value as AiRecognitionSettings["provider"] })}>
                <option value="local">Lokaler Draft</option>
                <option value="openai">OpenAI Vision</option>
                <option value="gemini">Google Gemini Vision</option>
                <option value="anthropic">Anthropic Claude Vision</option>
                <option value="azure_openai">Azure OpenAI</option>
                <option value="ollama">Ollama / LLaVA</option>
              </select>
              <Input type="number" value={settings.minConfidence} onChange={(event) => setSettings({ ...settings, minConfidence: Number(event.target.value) })} placeholder="Mindest-Konfidenz" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.storeImages} onChange={(event) => setSettings({ ...settings, storeImages: event.target.checked })} />Bilder lokal speichern</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.deleteAfterAnalysis} onChange={(event) => setSettings({ ...settings, deleteAfterAnalysis: event.target.checked })} />Bilder nach Analyse löschen</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.linkImageToMeal} onChange={(event) => setSettings({ ...settings, linkImageToMeal: event.target.checked })} />Originalbild mit Mahlzeit verknüpfen</label>
              <Button type="button" onClick={saveSettings}>Einstellungen speichern</Button>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="mb-4 font-bold">Analyse-Historie</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-semibold">{new Date(entry.analyzedAt).toLocaleString("de-DE")} · {entry.mealType}</p>
              <p className="text-slate-500">{entry.provider} · {entry.status} · {entry.confidence}%</p>
              <p className="mt-1 truncate text-slate-500">{entry.items.map((item) => item.name).join(", ")}</p>
            </div>
          ))}
          {!history.length && <p className="text-sm text-slate-500">Noch keine KI-Analysen vorhanden.</p>}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800"><p className="text-slate-500">{label}</p><p className="font-bold">{value}</p></div>;
}

async function handleFileInput(event: ChangeEvent<HTMLInputElement>, addFiles: (files: File[]) => Promise<void>) {
  await addFiles(Array.from(event.target.files ?? []));
  event.target.value = "";
}

function fileToDraft(file: File): Promise<ImageDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, mimeType: file.type, dataUrl: String(reader.result) });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function calculateTotals(items: AiRecognizedMealItem[]): MacroTotals {
  return items.reduce((totals, item) => ({
    calories: round(totals.calories + item.calories),
    protein: round(totals.protein + item.protein),
    carbs: round(totals.carbs + item.carbs),
    fat: round(totals.fat + item.fat),
    fiber: round(totals.fiber + item.fiber),
    sugar: round((totals.sugar ?? 0) + item.sugar),
    salt: round((totals.salt ?? 0) + item.salt)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 });
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
