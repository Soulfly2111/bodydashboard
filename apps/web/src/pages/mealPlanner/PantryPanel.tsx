import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useApi } from "../../hooks/useApi";
import { displayDate, ErrorMessage, planner, todayKey, update, useAction, type Dish, type PantryItem } from "./shared";

const blank = { name: "", amount: 0, unit: "g", expiresOn: "" };

export default function PantryPanel({ items, reload }: { items: PantryItem[]; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState<typeof blank & { id?: string }>(blank);
  const { busy, error, run } = useAction();
  return <Card><details>
    <summary className="cursor-pointer text-lg font-bold">Vorratsschrank</summary>
    <div className="mt-3 space-y-3">
      <ErrorMessage>{error}</ErrorMessage>
      {items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2">
        <span className="grow">{item.name} · {item.amount} {item.unit}{item.expiresOn ? " · bis " + displayDate(item.expiresOn) : ""}</span>
        <Button variant="secondary" onClick={() => setEdit({ ...item, expiresOn: item.expiresOn ?? "" })}>Bearbeiten</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { await update(planner + "/pantry/" + item.id, "DELETE"); await reload(); })}>Entfernen</Button>
      </li>)}</ul> : <p className="text-sm text-slate-500">Keine Vorräte erfasst.</p>}
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        const { id, expiresOn, ...data } = edit;
        void run(async () => {
          await update(planner + "/pantry" + (id ? "/" + id : ""), id ? "PUT" : "POST", { ...data, expiresOn: expiresOn || null });
          setEdit(blank);
          await reload();
        }, "Vorrat gespeichert");
      }}>
        <div className="grid gap-2 sm:grid-cols-4">
          <label>Bezeichnung<Input required maxLength={160} value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></label>
          <label>Menge<Input required type="number" min={0.001} max={100000} step="any" value={edit.amount || ""} onChange={(event) => setEdit({ ...edit, amount: Number(event.target.value) })} /></label>
          <label>Einheit<Input required maxLength={24} value={edit.unit} onChange={(event) => setEdit({ ...edit, unit: event.target.value })} /></label>
          <label>Verbrauchen bis<Input type="date" value={edit.expiresOn} onChange={(event) => setEdit({ ...edit, expiresOn: event.target.value })} /></label>
        </div>
        <Button disabled={busy}>{edit.id ? "Änderung speichern" : "Vorrat hinzufügen"}</Button>
        {edit.id && <Button type="button" variant="secondary" className="ml-2" onClick={() => setEdit(blank)}>Abbrechen</Button>}
      </form>
    </div>
  </details></Card>;
}

export function CookForm({ dish, items, onSuccess }: { dish: Dish; items: PantryItem[]; onSuccess: () => Promise<void> }) {
  const [used, setUsed] = useState<Record<string, number>>({});
  const [leftoverPortions, setLeftovers] = useState(0);
  const [leftoverUntil, setUntil] = useState("");
  const { busy, error, run } = useAction();
  const available = items.filter(({ expiresOn }) => !expiresOn || expiresOn >= todayKey());
  return <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
    <summary className="cursor-pointer font-semibold">Kochen und Reste bestätigen</summary>
    <form className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault();
      void run(async () => {
        await update(planner + "/dishes/" + dish.id + "/cooked", "POST", {
          used: available.flatMap(({ id }) => used[id] > 0 ? [{ id, amount: used[id] }] : []), leftoverPortions, leftoverUntil: leftoverUntil || null
        });
        await onSuccess();
      }, "Kochen erfasst");
    }}>
      {available.length > 0 && <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="text-sm">Verwendete Vorräte</legend>
        {available.map((item) => <label key={item.id}>{item.name} · {item.unit}<Input type="number" min={0} max={item.amount} step="any" value={used[item.id] ?? ""} onChange={(event) => setUsed({ ...used, [item.id]: Number(event.target.value) })} /></label>)}
      </fieldset>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Übrige Portionen<Input type="number" min={0} max={dish.servings} step="any" value={leftoverPortions} onChange={(event) => setLeftovers(Number(event.target.value))} /></label>
        <label>Reste verbrauchen bis<Input type="date" min={todayKey()} value={leftoverUntil} onChange={(event) => setUntil(event.target.value)} /></label>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <Button disabled={busy}>Kochen bestätigen</Button>
    </form>
  </details>;
}

export function usePantry() {
  return useApi<PantryItem[]>(planner + "/pantry", []);
}
