import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorMessage, MacroLine, field, planner, todayKey, update, useAction, type Macros } from "./shared";

type Preview = { name: string; totals: Macros | null; goal: { calories: number; protein: number } | null };
const mealTypes = { BREAKFAST: "Frühstück", LUNCH: "Mittagessen", DINNER: "Abendessen", SNACK: "Snack" };

export default function PortionForm({ recipeId, dishId }: { recipeId?: string; dishId?: string }) {
  const [date, setDate] = useState(todayKey);
  const [type, setType] = useState<keyof typeof mealTypes>("DINNER");
  const [portion, setPortion] = useState("1");
  const [preview, setPreview] = useState<{ key: string; result: Preview }>();
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState("");
  const attempt = useRef<{ signature: string; requestKey: string }>();
  const { busy, error, run } = useAction();
  const portions = Number(portion);
  const key = JSON.stringify({ recipeId, dishId, portions });
  const valid = portions > 0 && portions <= 100;
  useEffect(() => {
    let active = true;
    setProblem("");
    if (!valid) return;
    const timer = window.setTimeout(() => {
      void update<Preview>(planner + "/preview", "POST", { recipeId, dishId, portions }).then((result) => {
        if (active) setPreview({ key, result });
      }).catch((failure: Error) => { if (active) setProblem(failure.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [recipeId, dishId, portions, key, valid]);

  const result = preview?.key === key ? preview.result : null;
  const signature = JSON.stringify({ key, date, type });
  return <form className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700" onSubmit={(event) => {
    event.preventDefault();
    if (saved || !result?.totals) return;
    void run(async () => {
      if (attempt.current?.signature !== signature) attempt.current = { signature, requestKey: crypto.randomUUID() };
      await update(planner + "/consumptions", "POST", { recipeId, dishId, portions, date, type, requestKey: attempt.current.requestKey });
      setSaved(date);
      attempt.current = undefined;
    }, "Portion im Tagebuch erfasst");
  }}>
    <h3 className="font-semibold">Gegessene Portion erfassen</h3>
    <div className="grid gap-2 sm:grid-cols-3">
      <label>Portionen<Input required type="number" step="any" min={0.01} max={100} value={portion} onChange={(event) => setPortion(event.target.value)} /></label>
      <label>Datum<Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>Mahlzeit<select className={field} value={type} onChange={(event) => setType(event.target.value as keyof typeof mealTypes)}>
        {Object.entries(mealTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {result && <MacroLine totals={result.totals} />}
    {result?.goal && <p className="text-sm text-slate-500">Dein Tagesziel · {result.goal.calories} kcal und {result.goal.protein} g Protein</p>}
    <ErrorMessage>{problem || error}</ErrorMessage>
    {saved ? <Button type="button" variant="secondary" onClick={() => setSaved("")}>Weitere Portion erfassen</Button> :
      <Button type="submit" disabled={busy || !valid || !result?.totals}>Ins Ernährungstagebuch übernehmen</Button>}
    {saved && <Link className="ml-3 text-sm underline" to={"/meals?date=" + saved}>Tagebuch öffnen</Link>}
  </form>;
}
