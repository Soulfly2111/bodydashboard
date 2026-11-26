import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import { apiBlob } from "../lib/api";
import HouseholdPanel from "./mealPlanner/HouseholdPanel";
import PantryPanel, { CookForm, usePantry } from "./mealPlanner/PantryPanel";
import PortionForm from "./mealPlanner/PortionForm";
import ShoppingPanel from "./mealPlanner/ShoppingPanel";
import { blankRecipe, displayDate, ErrorMessage, field, Ingredients, MacroLine, mondayOf, planner, RecipeEditor, shiftWeek, steps, todayKey, update, useAction, type Dish, type Household, type Plan, type RecipeDraft } from "./mealPlanner/shared";

type Ideas = {
  recipes: { id: string; name: string; reason: string }[];
  leftovers: { id: string; name: string; portions: number; expiresOn: string | null }[];
};
type Job = { id: string; kind: "weekly" | "notify" | "image" | "cart"; jobKey: string; state: string; ready: boolean; error: string | null };

export default function MealPlanner() {
  const { data: household, setData, loading, error, reload } = useApi<Household | null>(planner + "/household", null);
  const [params, setParams] = useSearchParams();
  const current = mondayOf(todayKey());
  const rawWeek = params.get("week") ?? current;
  const requested = new Date(rawWeek + "T00:00:00Z");
  const week = /^\d{4}-\d{2}-\d{2}$/.test(rawWeek) && Number.isFinite(requested.getTime()) && requested.toISOString().slice(0, 10) === rawWeek ? mondayOf(rawWeek) : current;
  return <div className="mx-auto max-w-5xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Essensplanung</h1>
      <Link className="text-sm font-semibold underline" to="/recipes">Zum Rezeptbuch</Link>
    </header>
    <ErrorMessage>{error}</ErrorMessage>
    {loading && !household ? <p role="status">Haushalt wird geladen …</p> :
      <HouseholdPanel key={household?.id ?? "new"} household={household} onChange={(value) => { setData(value); void reload(); }} />}
    {household && <>
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Woche ab {displayDate(week)}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setParams({ week: shiftWeek(week, -1) })}>Vorherige Woche</Button>
          <label>Woche auswählen<Input type="date" value={week} onChange={(event) => { const value = event.target.value; if (value) setParams({ week: mondayOf(value) }); }} /></label>
          <Button type="button" variant="secondary" onClick={() => setParams({ week: shiftWeek(week, 1) })}>Nächste Woche</Button>
        </div>
      </Card>
      <WeekPlan key={household.id + ":" + week} household={household} week={week} />
      {household.role === "owner" && <Jobs setWeek={(value) => setParams({ week: value })} />}
    </>}
    <ConsumptionHistory />
  </div>;
}

function WeekPlan({ household, week }: { household: Household; week: string }) {
  const path = planner + "/plans/" + week;
  const { data: plan, setData, reload, error, loading } = useApi<Plan | null>(path, null);
  const pantry = usePantry();
  const manages = household.role === "owner";
  const action = useAction();
  const [selection, setSelection] = useState<number>();
  const [ideas, setIdeas] = useState<Ideas>({ recipes: [], leftovers: [] });
  const nextPosition = Array.from({ length: 14 }, (_, index) => index).find((position) => !plan?.dishes.some((dish) => dish.position === position));

  function generate(mode: "manual" | "ai") {
    void action.run(async () => setData(await update<Plan>(path, "POST", { mode })));
  }
  function choose(position: number) {
    setSelection(position);
    void action.run(async () => setIdeas(await update<Ideas>(planner + "/recommendations?week=" + week, "GET")));
  }

  return <>
    <ErrorMessage>{error || action.error}</ErrorMessage>
    {error || action.error ? <Button type="button" variant="secondary" onClick={() => void reload()}>Plan erneut laden</Button> : null}
    {!plan && loading && <p role="status">Wochenplan wird geladen …</p>}
    {!plan && !loading && <Card className="space-y-3">
      <p>{manages ? "Für diese Woche gibt es noch keinen Entwurf." : "Für diese Woche gibt es noch keinen freigegebenen Plan."}</p>
      {manages && <div className="flex flex-wrap gap-2">
        <Button disabled={action.busy} onClick={() => generate("ai")}>Mit Open WebUI planen</Button>
        <Button disabled={action.busy} variant="secondary" onClick={() => generate("manual")}>Manuell planen</Button>
      </div>}
    </Card>}
    {plan && <>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">{plan.status === "approved" ? "Wochenplan freigegeben" : "Wochenplan im Entwurf"}</h2>
          <p className="text-sm text-slate-500">{plan.dishes.length} {plan.dishes.length === 1 ? "Gericht" : "Gerichte"} · {plan.dishes.reduce((sum, dish) => sum + dish.servings, 0)} Portionen</p>
        </div>
        {manages && plan.status === "draft" && <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={nextPosition === undefined || action.busy} onClick={() => { if (nextPosition !== undefined) choose(nextPosition); }}>Gericht hinzufügen</Button>
          <Button type="button" disabled={!plan.dishes.length || action.busy || selection !== undefined} onClick={() => void action.run(async () => setData(await update(path + "/approve", "POST", { version: plan.version })), "Wochenplan freigegeben")}>Wochenplan freigeben</Button>
        </div>}
      </Card>
      {plan.dishes.map((dish) => <Card key={dish.id} className="space-y-3">
        {dish.images?.["0"] && <DishImage id={dish.id} index={0} alt={dish.recipe.name} />}
        <div>
          <h3 className="text-xl font-bold">{dish.recipe.name}</h3>
          <p className="text-sm text-slate-500">{dish.servings} Portionen{dish.recipe.activeMinutes ? " · " + dish.recipe.activeMinutes + " Min." : ""}{dish.recipe.leftoverDishId ? " · aus Resten" : ""}</p>
          <MacroLine totals={dish.recipe.perPortion} />
          {plan.status === "approved" && dish.recipeId && <Link to={"/recipes?recipe=" + dish.recipeId} className="text-sm underline">Im Rezeptbuch öffnen</Link>}
        </div>
        <details>
          <summary className="cursor-pointer font-semibold">Rezept und Kochschritte</summary>
          <div className="mt-2 space-y-3">
            <Ingredients recipe={dish.recipe} servings={dish.servings} />
            <ol className="list-decimal space-y-2 pl-5">{steps(dish.recipe).map((step, index) => <li key={index}>{step}
              {dish.images?.[String(index + 1)] && <DishImage id={dish.id} index={index + 1} alt={"Kochschritt " + (index + 1)} />}
            </li>)}</ol>
          </div>
        </details>
        {plan.status === "draft" && manages && <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={action.busy} onClick={() => choose(dish.position)}>Gericht ändern</Button>
          <Button type="button" variant="secondary" disabled={action.busy} onClick={() => void action.run(async () => {
            setData(await update(path + "/dish", "PUT", { version: plan.version, position: dish.position, mode: "ai" }));
            setSelection(undefined);
          })}>KI-Alternative anfordern</Button>
          <Button type="button" variant="secondary" disabled={action.busy} onClick={() => void action.run(async () => {
            setData(await update(path + "/dish", "PUT", { version: plan.version, position: dish.position, dish: null }));
            setSelection(undefined);
          })}>Gericht entfernen</Button>
        </div>}
        {plan.status === "approved" && <>
          {dish.cookedAt ? <p className="text-sm">Gekocht{dish.leftoverPortions > 0 ? " · " + dish.leftoverPortions + " Portionen übrig" : ""}</p> :
            <CookForm dish={dish} items={pantry.data} onSuccess={async () => { await reload(); await pantry.reload(); }} />}
          <PortionForm dishId={dish.id} />
        </>}
      </Card>)}
      {selection !== undefined && plan.status === "draft" && <DishEditor key={selection} manages={manages} defaultServings={household.servings} dish={plan.dishes.find(({ position }) => position === selection)}
        ideas={ideas} busy={action.busy} onCancel={() => setSelection(undefined)} onSave={(dish) => void action.run(async () => {
          setData(await update(path + "/dish", "PUT", { version: plan.version, position: selection, dish }));
          setSelection(undefined);
        })} />}
      {plan.status === "approved" && <ShoppingPanel planPath={path} manages={manages} />}
    </>}
    <ErrorMessage>{pantry.error}</ErrorMessage>
    <PantryPanel items={pantry.data} reload={pantry.reload} />
  </>;
}

type DishSelection = { servings: number; recipeId: string } | { servings: number; leftoverDishId: string } | { servings: number; recipe: RecipeDraft };
function DishEditor({ dish, ideas, defaultServings, manages, busy, onCancel, onSave }: {
  dish?: Dish; ideas: Ideas; defaultServings: number; manages: boolean; busy: boolean;
  onCancel: () => void; onSave: (dish: DishSelection) => void;
}) {
  const [source, setSource] = useState(dish?.recipeId ? "recipe" : dish?.recipe.leftoverDishId ? "leftover" : dish?.recipe.draft ? "new" : "recipe");
  const [ref, setRef] = useState(dish?.recipeId ?? dish?.recipe.leftoverDishId ?? "");
  const [servings, setServings] = useState(dish?.servings ?? defaultServings);
  const [draft, setDraft] = useState<RecipeDraft>(dish?.recipe.draft ?? { ...blankRecipe, servings: defaultServings });
  if (!manages) return null;
  return <Card>
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (source === "new") onSave({ servings, recipe: draft });
      if (source === "recipe" && ref) onSave({ servings, recipeId: ref });
      if (source === "leftover" && ref) onSave({ servings, leftoverDishId: ref });
    }}>
      <h3 className="font-bold">{dish ? "Gericht ändern" : "Gericht hinzufügen"}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Gericht auswählen<select className={field} value={source} onChange={(event) => { setSource(event.target.value); setRef(""); }}>
          <option value="recipe">Aus dem Rezeptbuch</option><option value="leftover">Aus vorhandenen Resten</option><option value="new">Neuer Rezeptentwurf</option>
        </select></label>
        <label>Geplante Portionen<Input required type="number" min={1} max={100} value={servings || ""} onChange={(event) => setServings(Number(event.target.value))} /></label>
      </div>
      {source === "recipe" && <label className="block">Freigegebenes Haushaltsrezept<select className={field} required value={ref} onChange={(event) => setRef(event.target.value)}>
        <option value="">Bitte auswählen</option>
        {ideas.recipes.map(({ id, name, reason }) => <option key={id} value={id}>{name} · {reason}</option>)}
      </select></label>}
      {source === "recipe" && !ideas.recipes.length && <p className="text-sm">Gib zuerst ein Rezept <Link className="underline" to="/recipes">im Rezeptbuch</Link> für den Haushalt frei.</p>}
      {source === "leftover" && <label className="block">Verfügbare Reste<select className={field} required value={ref} onChange={(event) => {
        setRef(event.target.value);
        const item = ideas.leftovers.find(({ id }) => id === event.target.value);
        if (item) setServings(Math.floor(item.portions));
      }}>
        <option value="">Bitte auswählen</option>
        {ideas.leftovers.map(({ id, name, portions, expiresOn }) => <option key={id} value={id}>{name} · {portions} Portionen{expiresOn ? " bis " + displayDate(expiresOn) : ""}</option>)}
      </select></label>}
      {source === "new" && <RecipeEditor value={draft} onChange={setDraft} />}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Gericht speichern</Button><Button type="button" variant="secondary" onClick={onCancel}>Abbrechen</Button></div>
    </form>
  </Card>;
}

function DishImage({ id, index, alt }: { id: string; index: number; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    void apiBlob(planner + "/dishes/" + id + "/images/" + index).then((blob) => {
      if (active) { url = URL.createObjectURL(blob); setSrc(url); }
    }).catch(() => undefined);
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id, index]);
  return src ? <img className="my-2 max-h-64 rounded-lg object-cover" src={src} alt={alt} loading="lazy" /> : null;
}

function Jobs({ setWeek }: { setWeek: (week: string) => void }) {
  const { data, reload, error } = useApi<Job[]>(planner + "/jobs", []);
  const action = useAction();
  const running = data.some((job) => job.state === "queued" || job.state === "running");
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), running ? 5000 : 30000);
    return () => clearInterval(timer);
  }, [running, reload]);
  const ready = data.some((job) => job.ready);
  const labels = { weekly: "Wochenplanung", notify: "Benachrichtigung", image: "Rezeptbild", cart: "Picnic-Warenkorb" };
  const statuses: Record<string, string> = { queued: "Wartet", running: "Läuft", done: "Abgeschlossen", failed: "Fehlgeschlagen" };
  return <Card><details>
    <summary className="cursor-pointer text-lg font-bold">Automatisierung{ready ? " · Wochenentwurf bereit" : ""}</summary>
    <div className="mt-3 space-y-2">
      <ErrorMessage>{error || action.error}</ErrorMessage>
      {!data.length && <p className="text-sm">Keine Aufträge vorhanden.</p>}
      {data.map((job) => <div key={job.id} className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-sm dark:border-slate-700">
        <span className="grow">{labels[job.kind]} · {statuses[job.state] ?? job.state}{job.error ? " · " + job.error : ""}</span>
        {job.ready && <Button type="button" variant="secondary" onClick={() => setWeek(job.jobKey)}>Woche öffnen</Button>}
        {job.state === "failed" && job.kind !== "cart" && <Button type="button" variant="secondary" disabled={action.busy} onClick={() => void action.run(async () => {
          await update(planner + "/jobs/" + job.id + "/retry", "POST");
          await reload();
        })}>Erneut starten</Button>}
      </div>)}
    </div>
  </details></Card>;
}

function ConsumptionHistory() {
  const path = planner + "/consumptions";
  const { data, error, reload } = useApi<{ id: string; date: string; name: string; portions: number; mealItemId: string | null }[]>(path, []);
  return <Card><details onToggle={(event) => { if (event.currentTarget.open) void reload(); }}>
    <summary className="cursor-pointer text-lg font-bold">Meine Verzehrhistorie</summary>
    <div className="mt-3 space-y-2">
      <ErrorMessage>{error}</ErrorMessage>
      {!data.length && <p className="text-sm">Noch keine Rezepte im Tagebuch erfasst.</p>}
      <ul className="space-y-1">{data.map(({ id, date, name, portions, mealItemId }) => <li key={id}>
        {mealItemId ? <Link className="underline" to={"/meals?date=" + date}>{displayDate(date)}</Link> : displayDate(date)}
        {" · " + name + " · " + portions + " Portion(en)"}{!mealItemId && " · aus Tagebuch entfernt"}
      </li>)}</ul>
    </div>
  </details></Card>;
}
