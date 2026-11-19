import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Dumbbell, Settings, Info, ArrowUpRight, Pill } from "lucide-react";
import { api } from "../lib/api";
import "./overview.css";

type Supplement = { id: string; name: string; color: string };
type Nutrition = { calories: number; protein: number; fat: number; carbs: number; hasNutrition: boolean; knownNutrition: Record<string, boolean>; missingNutritionCount: number };
type Day = Nutrition & { date: string; activityCount: number; supplements: { id: string; count: number }[] };
type Week = Nutrition & { start: string; end: string; weightKg: number | null; bodyFatPercent: number | null; supplements: { id: string; days: number }[] };
type Overview = { today: string; timezone: string; days: Day[]; weeks: Week[]; supplements: Supplement[] };
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
function shortDate(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function Led({ color, active, label, dim = false }: { color: string; active: boolean; label: string; dim?: boolean }) {
  return <span role="img" aria-label={label} title={label} className={`macro-led ${active ? "lit" : ""} ${dim ? "dim" : ""}`} style={{ "--led": color } as CSSProperties} />;
}
export default function MacroOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    api<Overview>("/stats/overview").then(value => { if (active) { setData(value); setError(""); } }).catch(err => { if (active) setError(err.message); });
    const onFocus = () => setRefresh(v => v + 1);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => { active = false; window.removeEventListener("focus", onFocus); clearInterval(timer); };
  }, [refresh]);
  function cells(row: Nutrition) {
    return (["calories", "protein", "fat", "carbs"] as const).map(key => <td key={key}>{row.hasNutrition && row.knownNutrition[key] ? `${number.format(row[key])}${key === "calories" ? "" : " g"}` : "–"}</td>);
  }
  return <div className="macro-overview">
    <header className="macro-brand"><div><Dumbbell aria-hidden="true" /><h1>Body<span>Dashboard</span></h1></div><Link to="/settings" aria-label="Einstellungen"><Settings /></Link><p>Makro-Übersicht</p></header>
    <nav className="macro-actions" aria-label="Dashboardansicht"><span className="macro-active">Übersicht</span><Link to="/dashboard-details">Detailansicht <ArrowUpRight size={14} /></Link><Link to="/supplements"><Pill size={15} /> Supplements</Link></nav>
    {error && <div role="alert" className="macro-note">{error} <button onClick={() => setRefresh(v => v + 1)}>Erneut laden</button></div>}
    {!data && !error && <p role="status">Übersicht wird geladen …</p>}
    {data && <>
      <section className="macro-panel"><h2><CalendarDays /> Letzte 7 Tage</h2><div className="macro-table-scroll"><table className="macro-table"><thead><tr><th>Tag</th><th><span className="sr-only">Supplements</span></th><th>Kcal</th><th>P <small>(Protein)</small></th><th>F <small>(Fett)</small></th><th>KH <small>(Kohlenhydrate)</small></th></tr></thead><tbody>
        {data.days.map(day => <tr key={day.date} className={day.date === data.today ? "selected" : ""}>
          <td><div className="macro-day"><Led color="#00e8d1" active={day.activityCount > 0} label={day.activityCount ? `${day.activityCount} Aktivitäten erfasst` : "Keine Aktivität erfasst"} /><Link to={`/dashboard-details?date=${day.date}`}>{new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))} {shortDate(day.date)}</Link></div></td>
          <td><div className="macro-leds">{data.supplements.map(s => <Led key={s.id} color={s.color} active={day.supplements.some(v => v.id === s.id && v.count > 0)} label={`${s.name}: ${day.supplements.some(v => v.id === s.id && v.count > 0) ? "eingenommen" : "nicht erfasst"}`} />)}</div></td>{cells(day)}
        </tr>)}
      </tbody></table></div>
      <p className="macro-note"><Info size={17} /> Heute noch unvollständig · Leere Werte: keine Erfassung</p>
      {data.days.some(d => d.missingNutritionCount > 0) && <p className="macro-note">Nährwerte für {data.days.reduce((sum, d) => sum + d.missingNutritionCount, 0)} Einnahmen fehlen ganz oder teilweise. Summen enthalten nur bekannte Werte.</p>}
      <div className="macro-legend"><span>Supplement-LEDs:</span>{data.supplements.map(s => <Link key={s.id} to={`/supplements?id=${s.id}`}><Led color={s.color} active label={s.name} />{s.name}</Link>)}</div>
      <p className="macro-caption">Punkt neben dem Datum: Sport / Aktivität erfasst</p>
      </section>
      <section className="macro-panel"><h2><CalendarDays /> Letzte 4 Wochen</h2><p className="macro-subtitle">Tagesdurchschnitt je 7-Tage-Zeitraum</p><div className="macro-table-scroll"><table className="macro-table weeks"><thead><tr><th>Zeitraum</th><th>Supplements</th><th>Kcal</th><th>P <small>(Protein)</small></th><th>F <small>(Fett)</small></th><th>KH</th><th>Ø Gewicht</th><th>Ø KFA</th></tr></thead><tbody>
      {data.weeks.map((week, index) => <tr key={week.start} className={index === 0 ? "selected" : ""}><td>{shortDate(week.start)}–{shortDate(week.end)}</td><td><div className="macro-week-leds">{data.supplements.map(s => { const days = week.supplements.find(v => v.id === s.id)?.days ?? 0; return <span key={s.id} title={`${s.name}: ${days} von 7 Tagen`}><Led color={s.color} active={days > 0} dim={days < 7} label={`${s.name}: ${days}/7 Tage`} /><small>{days}/7</small></span>; })}</div></td>{cells(week)}<td>{week.weightKg === null ? "–" : `${number.format(week.weightKg)} kg`}</td><td>{week.bodyFatPercent === null ? "–" : `${number.format(week.bodyFatPercent)} %`}</td></tr>)}
      </tbody></table></div><p className="macro-note"><Info size={17} /> Makro-Ø inkl. Tage ohne Erfassung · Gewicht/KFA nur aus Messtagen</p>
      {data.weeks.some(w => w.missingNutritionCount > 0) && <p className="macro-note">Unvollständige Supplement-Nährwerte in den Zeiträumen – bekannte Beiträge sind eingerechnet.</p>}
      </section>
      <footer className="macro-footer"><Link to="/supplements">Einnahmen bearbeiten <ArrowUpRight size={16} /></Link><span>{data.timezone}</span></footer>
    </>}
  </div>;
}
