import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useApi } from "../hooks/useApi";
import PortionForm from "./mealPlanner/PortionForm";
import { blankRecipe, ErrorMessage, Ingredients, MacroLine, RecipeEditor, field, planner, steps, update, useAction, type Household, type Recipe, type RecipeDraft } from "./mealPlanner/shared";

export default function Recipes() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [params, setParams] = useSearchParams();
  const selected = params.get("recipe");
  const setSelected = (id: string) => setParams({ recipe: id });
  const [editing, setEditing] = useState<{ id?: string; recipe: RecipeDraft; shared: boolean } | null>(null);
  const { data: household } = useApi<Household | null>(planner + "/household", null);
  const { data: recipes, loading, error, reload } = useApi<Recipe[]>("/recipes?q=" + encodeURIComponent(query) + "&favorites=" + favorites, []);
  const action = useAction();
  const recipe = recipes.find(({ id }) => id === selected);
  function feedback(value: { favorite?: boolean; rating?: number | null }) {
    if (recipe) void action.run(async () => { await update("/recipes/" + recipe.id + "/feedback", "PUT", value); await reload(); });
  }

  return <div className="mx-auto max-w-5xl space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Rezepte</h1>
      <Button type="button" onClick={() => setEditing({ recipe: { ...blankRecipe, servings: household?.servings ?? 4 }, shared: false })}>Rezept anlegen</Button>
    </header>
    <ErrorMessage>{error || action.error}</ErrorMessage>
    {editing && <Card><form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      void action.run(async () => {
        const saved = await update<{ id: string }>("/recipes" + (editing.id ? "/" + editing.id : ""), editing.id ? "PUT" : "POST", { ...editing.recipe, shared: editing.shared });
        setEditing(null);
        setSelected(saved.id);
        setFavorites(false);
        setQuery("");
        setSearch("");
        if (!query && !favorites) await reload();
      }, "Rezept gespeichert");
    }}>
      <h2 className="font-bold">{editing.id ? "Rezept bearbeiten" : "Rezept anlegen"}</h2>
      <RecipeEditor value={editing.recipe} onChange={(value) => setEditing({ ...editing, recipe: value })} />
      {household && <label className="flex gap-2"><input type="checkbox" checked={editing.shared} onChange={(event) => setEditing({ ...editing, shared: event.target.checked })} /> Für den Haushalt freigeben</label>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={action.busy}>Speichern</Button><Button variant="secondary" type="button" onClick={() => setEditing(null)}>Abbrechen</Button></div>
    </form></Card>}
    <div className="grid gap-4 md:grid-cols-[1fr_1.7fr]">
      <Card className="space-y-3">
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search); }}>
          <label className="min-w-0 flex-1">Rezeptname<Input value={search} onChange={(event) => setSearch(event.target.value)} /></label><Button type="submit">Suchen</Button>
        </form>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={favorites} onChange={(event) => setFavorites(event.target.checked)} /> Nur Favoriten</label>
        {!loading && !recipes.length && <p>Keine Rezepte gefunden.</p>}
        <ul className="space-y-2">{recipes.map((row) => <li key={row.id}>
          <button type="button" aria-pressed={selected === row.id} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-mint aria-pressed:border-mint dark:border-slate-700" onClick={() => { setSelected(row.id); setEditing(null); }}>
            <span className="block font-semibold">{row.name}{row.favorite ? " ★" : ""}</span>
            <span className="text-sm text-slate-500">{row.servings} Portionen{row.shared ? " · Haushalt" : ""}</span>
          </button>
        </li>)}</ul>
      </Card>
      {recipe && <Card className="space-y-4">
        <header><h2 className="text-xl font-bold">{recipe.name}</h2><p className="text-sm text-slate-500">{recipe.category}{recipe.activeMinutes ? " · " + recipe.activeMinutes + " Min." : ""}</p></header>
        <div><h3 className="font-semibold">Nährwerte pro Portion</h3><MacroLine totals={recipe.perPortion} /></div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="secondary" disabled={action.busy} aria-pressed={recipe.favorite} onClick={() => feedback({ favorite: !recipe.favorite })}>{recipe.favorite ? "Favorit entfernen" : "Als Favorit speichern"}</Button>
          <label>Meine Bewertung<select className={field} disabled={action.busy} value={recipe.rating ?? ""} onChange={(event) => feedback({ rating: event.target.value ? Number(event.target.value) : null })}>
            <option value="">Keine Bewertung</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} von 5</option>)}
          </select></label>
          {recipe.owned && <Button type="button" variant="secondary" onClick={() => setEditing({ id: recipe.id, recipe, shared: recipe.shared })}>Bearbeiten</Button>}
        </div>
        <div><h3 className="font-semibold">Zutaten für {recipe.servings} Portionen</h3><Ingredients recipe={recipe} servings={recipe.servings} /></div>
        {steps(recipe).length > 0 && <div><h3 className="font-semibold">Kochschritte</h3><ol className="list-decimal space-y-1 pl-5">{steps(recipe).map((step, index) => <li key={index}>{step}</li>)}</ol></div>}
        <PortionForm key={recipe.id} recipeId={recipe.id} />
      </Card>}
    </div>
  </div>;
}
