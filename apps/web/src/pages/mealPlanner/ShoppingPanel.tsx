import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useApi } from "../../hooks/useApi";
import { ErrorMessage, field, update, useAction } from "./shared";

type Product = { id: string; name: string; packageInfo: string; priceCents: number | null };
type Line = { key: string; name: string; amount: number; unit: string; checked: boolean; product: Product | null; packs: number };
type Shopping = { items: Line[]; version: number; state: "preview" | "transferring" | "transferred" | "review"; budgetCents: number | null; picnicAvailable: boolean; estimateCents: number; hasUnpricedItems: boolean };
const euro = (cents: number) => Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function ShoppingPanel({ planPath, manages }: { planPath: string; manages: boolean }) {
  const path = planPath + "/shopping";
  const { data, setData, error, loading, reload } = useApi<Shopping | null>(path, null);
  useEffect(() => {
    if (data?.state !== "transferring") return;
    const timer = window.setInterval(() => { void reload(); }, 5000);
    return () => clearInterval(timer);
  }, [data?.state, reload]);
  const action = useAction();
  return <Card><details>
    <summary className="cursor-pointer text-lg font-bold">Einkaufsliste</summary>
    <div className="mt-3 space-y-3">
      <ErrorMessage>{error || action.error}</ErrorMessage>
      {!data && !loading && manages && <Button disabled={action.busy} onClick={() => void action.run(async () => setData(await update(path, "POST")))}>Einkauf vorbereiten</Button>}
      {!data && !manages && !loading && <p>Es wurde noch keine Einkaufsliste vorbereitet.</p>}
      {data && <ShoppingForm key={data.version + ":" + data.state} data={data} path={path} manages={manages} onChange={setData} />}
    </div>
  </details></Card>;
}

function ShoppingForm({ data, manages, path, onChange }: { data: Shopping; manages: boolean; path: string; onChange: (data: Shopping) => void }) {
  const [items, setItems] = useState(data.items);
  const [products, setProducts] = useState<{ key: string; options: Product[] }>();
  const [confirm, setConfirm] = useState(false);
  const { run, busy, error } = useAction();
  const editable = manages && data.state === "preview";
  const changed = JSON.stringify(items) !== JSON.stringify(data.items);
  const selected = items.filter(({ checked }) => checked);
  const hasUnpricedItems = selected.some(({ product }) => product?.priceCents == null);
  const estimateCents = selected.reduce((sum, { product, packs }) => sum + (product?.priceCents ?? 0) * packs, 0);
  function edit(key: string, changes: Partial<Line>) {
    setItems((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
    setConfirm(false);
  }
  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    void run(async () => onChange(await update(path, "PUT", { version: data.version, items })), "Einkaufsliste gespeichert");
  }}>
    <p className="text-sm">Geschätzte Kosten · {euro(estimateCents)}{hasUnpricedItems ? " für Positionen mit Preis" : ""}{data.budgetCents == null ? "" : " · Budget " + euro(data.budgetCents)}</p>
    {data.state === "transferring" && <p role="status">Artikel werden zu Picnic übertragen.</p>}
    {data.state === "transferred" && <p role="status">Ausgewählte Artikel wurden zum Picnic-Warenkorb hinzugefügt.</p>}
    {data.state === "review" && <p role="status">Die Übertragung konnte nicht vollständig bestätigt werden. Prüfe deinen Picnic-Warenkorb. Beim erneuten Abgleich werden die bereits erfassten Mengen berücksichtigt.</p>}
    {!items.length && <p>Für diesen Plan stehen keine Zutaten auf der Einkaufsliste.</p>}
    {items.map((item) => <fieldset key={item.key} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" disabled={!editable} checked={item.checked} onChange={(event) => edit(item.key, { checked: event.target.checked })} /> {item.name}</label>
      {editable ? <div className="grid gap-2 sm:grid-cols-3">
        <label>Bezeichnung<Input required maxLength={160} value={item.name} onChange={(event) => edit(item.key, { name: event.target.value })} /></label>
        <label>Menge<Input required type="number" step="any" min={0.001} value={item.amount || ""} onChange={(event) => edit(item.key, { amount: Number(event.target.value) })} /></label>
        <label>Einheit<Input required maxLength={24} value={item.unit} onChange={(event) => edit(item.key, { unit: event.target.value })} /></label>
      </div> : <p className="text-sm">{item.amount} {item.unit}</p>}
      {item.product && <p className="text-sm">{item.product.name} · {item.product.packageInfo || "Packung"} · {item.product.priceCents === null ? "Preis offen" : euro(item.product.priceCents)} · {item.packs} Packung(en)</p>}
      {editable && data.picnicAvailable && <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="secondary" disabled={busy || !item.name.trim()} onClick={() => void run(async () => {
          setProducts({ key: item.key, options: await update<Product[]>(path + "/products?q=" + encodeURIComponent(item.name), "GET") });
        })}>Picnic-Produkte suchen</Button>
        {item.product && <label>Packungen<Input type="number" min={1} max={100} required value={item.packs || ""} onChange={(event) => edit(item.key, { packs: Number(event.target.value) })} /></label>}
      </div>}
      {products?.key === item.key && (products.options.length ? <label className="block">Produkt auswählen<select className={field} value={item.product?.id ?? ""} onChange={(event) => edit(item.key, { product: products.options.find(({ id }) => id === event.target.value) ?? null })}>
        <option value="">Kein Produkt auswählen</option>{products.options.map((product) => <option key={product.id} value={product.id}>{product.name} {product.packageInfo} {product.priceCents === null ? "" : euro(product.priceCents)}</option>)}
      </select></label> : <p className="text-sm">Keine passenden Produkte gefunden.</p>)}
    </fieldset>)}
    <ErrorMessage>{error}</ErrorMessage>
    {editable && <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={!changed || busy}>Änderungen speichern</Button>
      <Button type="button" variant="secondary" disabled={changed || busy} onClick={() => void run(async () => onChange(await update(path + "/refresh", "POST", { version: data.version })))}>Aus Plan und Vorräten neu berechnen</Button>
    </div>}
    {manages && data.picnicAvailable && !changed && selected.some(({ product }) => product) && ["preview", "review"].includes(data.state) &&
      (confirm ? <div className="flex flex-wrap items-center gap-2">
        <span>Ausgewählte Artikel zum Picnic-Warenkorb hinzufügen?</span>
        <Button type="button" disabled={busy} onClick={() => void run(async () => onChange(await update(path + "/confirm", "POST", { version: data.version })))}>Übertragung bestätigen</Button>
        <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>Abbrechen</Button>
      </div> : <Button type="button" variant="secondary" onClick={() => setConfirm(true)}>{data.state === "review" ? "Warenkorb erneut abgleichen" : "Warenkorbübertragung prüfen"}</Button>)}
  </form>;
}
