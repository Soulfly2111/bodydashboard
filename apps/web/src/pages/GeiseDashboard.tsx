import { useEffect, useState } from "react";
import { LogOut, Dumbbell, Scale, Pill, Flame } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import "./geise.css";

const metrics = [{key:"calories",label:"Kcal",unit:"",color:"#00e7e7"},{key:"protein",label:"Protein",unit:"g",color:"#ff83ad"},{key:"fat",label:"Fett",unit:"g",color:"#ffd54a"},{key:"carbs",label:"KH",unit:"g",color:"#bd85ff"}] as const;
type Values = Record<typeof metrics[number]["key"],number>;
type Day = Values & { date:string; hasNutrition:boolean; activityCount:number; supplements:{id:string;count:number}[] };
type Overview = {today:string;days:Day[];supplements:{id:string;name:string;color:string}[]};
type Measure = {date:string;weightKg:number|null;bodyFatPercent:number|null};
type Detail = {goal:Values; totals:Values; missingNutritionCount:number; latestMeasurements:{weight:Measure|null;bodyFat:Measure|null}; meals:{type:string;items:{id:string;name:string;amount:number;unit:string}[]}[]};
const n = (v:number) => new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(v);
const date = (v:string,weekday=false) => new Intl.DateTimeFormat("de-DE",{timeZone:"UTC",...(weekday?{weekday:"short" as const}:{day:"2-digit" as const,month:"2-digit" as const})}).format(new Date(v.slice(0,10)+"T12:00:00Z"));
function Rings({values,goal,small=false}:{values:Values;goal:Values;small?:boolean}) {
 return <svg viewBox="0 0 220 220" className={small?"g-rings small":"g-rings"} aria-hidden="true">{metrics.map((m,i)=>{const r=96-i*18,c=2*Math.PI*r,p=goal[m.key]>0?Math.min(1,Math.max(0,values[m.key]/goal[m.key])):0;return <g key={m.key}><circle cx="110" cy="110" r={r} fill="none" stroke="#253540" strokeWidth="12"/><circle cx="110" cy="110" r={r} fill="none" stroke={m.color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-p)} transform="rotate(-90 110 110)"/></g>})}</svg>;
}
export default function GeiseDashboard(){
 const {logout,user}=useAuth();
 const [overview,setOverview]=useState<Overview|null>(null),[selected,setSelected]=useState(""),[detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;api<Overview>("/stats/overview").then(v=>{if(active){setOverview(v);setSelected(d=>d||v.today);setError("")}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[refresh]);
 useEffect(()=>{if(!selected)return;let active=true;setDetail(null);api<Detail>("/stats/day/"+selected).then(v=>{if(active){setDetail(v);setError("")}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[selected,refresh]);
 useEffect(()=>{const update=()=>setRefresh(x=>x+1);window.addEventListener("focus",update);const timer=setInterval(update,60000);return()=>{window.removeEventListener("focus",update);clearInterval(timer)}},[]);
 const day=overview?.days.find(d=>d.date===selected);
 const choose=(d:string,scroll=false)=>{setSelected(d);if(scroll)window.scrollTo({top:0,behavior:"smooth"})};
 const labels:Record<string,string>={BREAKFAST:"Frühstück",LUNCH:"Mittagessen",DINNER:"Abendessen",SNACK:"Snacks"};
 return <main className="geise"><div className="g-wrap">
 <header className="g-header"><div><h1><Dumbbell/> BodyDashboard</h1><p>Hallo {user?.name} · Dein Überblick</p></div><button aria-label="Abmelden" onClick={()=>void logout()}><LogOut size={19}/></button></header>
 {error&&<p role="alert">{error} <button onClick={()=>setRefresh(x=>x+1)}>Erneut laden</button></p>}
 {!overview&&<p role="status">Dashboard wird geladen …</p>}
 {overview&&<><nav className="g-days" aria-label="Tag auswählen">{[...overview.days].reverse().map(d=><button key={d.date} aria-pressed={selected===d.date} aria-label={date(d.date)+" auswählen"} onClick={()=>choose(d.date)}><span>{date(d.date,true)}</span>{detail?<Rings small values={d} goal={detail.goal}/>:<span>{date(d.date)}</span>}</button>)}</nav>
 {!detail&&<p role="status">Tagesdaten werden geladen …</p>}
 {detail&&day&&<>
 <section className="g-card g-summary"><div className="g-ringbox"><Rings values={day} goal={detail.goal}/><div><Flame size={21}/><b>{date(selected,true)}</b><small>{date(selected)}</small></div></div><div className="g-macros"><h2>Tagesziel</h2>{metrics.map(m=><div key={m.key}><span style={{color:m.color}}>●</span><span>{m.label}</span><strong>{n(day[m.key])} {m.unit}<small>/ {n(detail.goal[m.key])} {m.unit}</small></strong></div>)}</div></section>
 {detail.missingNutritionCount>0&&<p className="g-note">Supplement-Nährwerte teilweise unbekannt. Summen enthalten bekannte Werte.</p>}
 <section className="g-card g-supplements"><h2><Pill size={19}/> Supplements {selected===overview.today?"heute":"· "+date(selected)}</h2><div>{overview.supplements.map(s=><span key={s.id}><i className={day.supplements.some(e=>e.id===s.id&&e.count>0)?"on":""}/>{s.name}<span className="sr-only">{day.supplements.some(e=>e.id===s.id&&e.count>0)?" eingenommen":" nicht erfasst"}</span></span>)}</div></section>
 <section className="g-card"><h2><Scale size={19}/> Letzte Messwerte</h2><div className="g-measures">{([{label:"Gewicht",m:detail.latestMeasurements.weight,key:"weightKg",unit:"kg"},{label:"Körperfett",m:detail.latestMeasurements.bodyFat,key:"bodyFatPercent",unit:"%"}] as const).map(({label,m,key,unit})=><div key={key}><span>{label}</span><strong>{m?.[key]!=null?n(m[key]!):"–"} <small>{m?.[key]!=null?unit:""}</small></strong><small>{m?"Gemessen am "+date(m.date):"Noch kein Messwert"}</small></div>)}</div></section>
 <section className="g-card"><h2>Lebensmittel · {selected===overview.today?"Heute":date(selected)}</h2>{!detail.meals.some(m=>m.items.length)&&<p className="g-note">Für diesen Tag sind keine Lebensmittel erfasst.</p>}{detail.meals.filter(m=>m.items.length).map((meal,i)=><div key={i} className="g-meal"><h3>{labels[meal.type]||meal.type}</h3><ul>{meal.items.map(item=><li key={item.id}><span>{item.name}</span><strong>{n(item.amount)} {item.unit}</strong></li>)}</ul></div>)}</section>
 </>}
 <section className="g-card g-history"><h2>Letzte 7 Tage</h2><p className="g-note">Tag antippen, um die Lebensmittel anzusehen.</p>{[...overview.days].reverse().map(d=><button key={d.date} aria-pressed={selected===d.date} onClick={()=>choose(d.date,true)}><i className={d.activityCount?"on":""} aria-label={d.activityCount?"Sport erfasst":"Kein Sport erfasst"}/><b>{date(d.date,true)}<small>{date(d.date)}</small></b>{detail&&<Rings small values={d} goal={detail.goal}/>}<span>{d.hasNutrition?<><strong>{n(d.calories)} kcal</strong><small>P {n(d.protein)} g · F {n(d.fat)} g · KH {n(d.carbs)} g</small></>:"Keine Daten"}</span><span>›</span></button>)}</section>
 </>}
 </div></main>;
}
