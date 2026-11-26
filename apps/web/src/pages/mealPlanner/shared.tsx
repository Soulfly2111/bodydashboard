import { useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import type { Food } from "../../types/domain";

export const planner = "/meal-planner";
export const update = <T,>(url: string, method: string, body?: unknown) => api<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
export const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";
export const todayKey = () => berlinKey(new Date());

function berlinKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function mondayOf(date: string) {
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function shiftWeek(date: string, amount: number) {
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + amount * 7);
  return day.toISOString().slice(0, 10);
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(date));
}

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>, success?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (success) toast.success(success);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Die Aktion ist fehlgeschlagen.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return { run, busy, error };
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return children ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{children}</p> : null;
}

export type Macros = { calories: number; protein: number; carbs: number; fat: number };
export type Ingredient = { name: string; amount: number; unit: string; foodId?: string; hasNutrition?: boolean };
export type RecipeDraft = {
  name: string; servings: number; instructions?: string; category?: string;
  activeMinutes?: number | null; ingredients: Ingredient[];
};
export type RecipeSnapshot = RecipeDraft & { perPortion: Macros | null; leftoverDishId?: string; draft?: RecipeDraft };
export type Recipe = RecipeSnapshot & { id: string; owned: boolean; shared: boolean; favorite: boolean; rating: number | null };
export type Dish = { id: string; position: number; servings: number; recipeId: string | null; recipe: RecipeSnapshot; images: Record<string, string> | null; cookedAt: string | null; leftoverPortions: number };
export type Plan = { id: string; weekStart: string; status: "draft" | "approved"; version: number; dishes: Dish[] };
export type Household = {
  id: string; name: string; role: "owner" | "member"; servings: number; dishCount: number; preferences: string;
  budgetCents: number | null; autoPlan: boolean; members: { userId: string; role: string; user: { name: string } }[];
  invitations: { id: string; expiresAt: string }[];
};
export type PantryItem = { id: string; name: string; amount: number; unit: string; expiresOn: string | null };

export const blankRecipe: RecipeDraft = { name: "", servings: 4, instructions: "", category: "", activeMinutes: null, ingredients: [] };
export const steps = (recipe: RecipeDraft) => recipe.instructions?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? [];

const amount = (value: number) => Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

export function MacroLine({ totals }: { totals: Macros | null }) {
  if (!totals) return <p className="text-sm text-amber-700 dark:text-amber-300">Nährwerte unvollständig</p>;
  return <p className="text-sm text-slate-600 dark:text-slate-300">{amount(totals.calories)} kcal · {amount(totals.protein)} g Protein · {amount(totals.carbs)} g Kohlenhydrate · {amount(totals.fat)} g Fett</p>;
}

export function Ingredients({ recipe, servings }: { recipe: RecipeSnapshot; servings: number }) {
  if (!recipe.ingredients.length) return <p className="text-sm text-slate-500">Keine Zutaten hinterlegt.</p>;
  return <ul className="list-disc space-y-1 pl-5 text-sm">
    {recipe.ingredients.map((item, index) => <li key={index}>{amount(item.amount * servings / recipe.servings)} {item.unit} {item.name}{item.hasNutrition === false && <span className="text-amber-700 dark:text-amber-300"> · ohne Nährwerte</span>}</li>)}
  </ul>;
}

export function RecipeEditor({ value, onChange }: { value: RecipeDraft; onChange: (recipe: RecipeDraft) => void }) {
  const [query, setQuery] = useState("");
  const [foodQuery, setFoodQuery] = useState("");
  const { data: foods, error } = useApi<Food[]>("/foods?take=35&q=" + encodeURIComponent(foodQuery), []);
  function changeItem(index: number, change: Partial<Ingredient>) {
    onChange({ ...value, ingredients: value.ingredients.map((item, position) => position === index ? { ...item, ...change } : item) });
  }
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Name<Input required maxLength={160} value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></label>
      <label>Basisportionen<Input required type="number" min={1} max={100} value={value.servings || ""} onChange={(event) => onChange({ ...value, servings: Number(event.target.value) })} /></label>
      <label>Kategorie<Input maxLength={80} value={value.category ?? ""} onChange={(event) => onChange({ ...value, category: event.target.value })} /></label>
      <label>Zubereitungszeit (Minuten)<Input type="number" min={1} max={720} value={value.activeMinutes ?? ""} onChange={(event) => onChange({ ...value, activeMinutes: event.target.value ? Number(event.target.value) : null })} /></label>
    </div>
    <label className="block">Kochschritte (ein Schritt pro Zeile)<textarea className={field} rows={5} maxLength={12000} value={value.instructions ?? ""} onChange={(event) => onChange({ ...value, instructions: event.target.value })} /></label>
    <div className="space-y-2">
      <h3 className="font-semibold">Zutaten</h3>
      {value.ingredients.length > 0 && <div className="flex items-end gap-2">
        <label className="flex-1">Lebensmittel für Zuordnung suchen<Input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <Button type="button" onClick={() => setFoodQuery(query)}>Suchen</Button>
      </div>}
      <ErrorMessage>{error}</ErrorMessage>
      {value.ingredients.map((item, index) => <fieldset key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
        <legend className="text-sm">Zutat {index + 1}</legend>
        <label>Name<Input required maxLength={160} value={item.name} onChange={(event) => changeItem(index, { name: event.target.value })} /></label>
        <label>Menge<Input required type="number" step="any" min={0.001} max={100000} value={item.amount || ""} onChange={(event) => changeItem(index, { amount: Number(event.target.value) })} /></label>
        <label>Einheit<Input required maxLength={24} value={item.unit} onChange={(event) => changeItem(index, { unit: event.target.value, foodId: ["g", "ml"].includes(event.target.value) ? item.foodId : undefined })} /></label>
        <label>Nährwertquelle (g oder ml)<select className={field} disabled={!["g", "ml"].includes(item.unit)} value={item.foodId ?? ""} onChange={(event) => {
          const food = foods.find(({ id }) => id === event.target.value);
          changeItem(index, { foodId: event.target.value || undefined, name: item.name || food?.name || "" });
        }}>
          <option value="">Keine Zuordnung</option>
          {item.foodId && !foods.some(({ id }) => id === item.foodId) && <option value={item.foodId}>{item.name} (bereits zugeordnet)</option>}
          {foods.map((food) => <option key={food.id} value={food.id}>{food.name}{food.brand ? " · " + food.brand : ""}</option>)}
        </select></label>
        <Button type="button" variant="secondary" onClick={() => onChange({ ...value, ingredients: value.ingredients.filter((_, position) => position !== index) })}>Zutat entfernen</Button>
      </fieldset>)}
      <Button type="button" variant="secondary" disabled={value.ingredients.length >= 60} onClick={() => onChange({ ...value, ingredients: [...value.ingredients, { name: "", amount: 100, unit: "g" }] })}>Zutat hinzufügen</Button>
    </div>
  </div>;
}
