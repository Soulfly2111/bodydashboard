import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ErrorMessage, field, planner, update, useAction, type Household } from "./shared";

const expiry = (time: string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" }).format(new Date(time));

export default function HouseholdPanel({ household, onChange }: { household: Household | null; onChange: (value: Household) => void }) {
  const [name, setName] = useState(household?.name ?? "");
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<{ token: string; expiresAt: string; id: string }>();
  const [servings, setServings] = useState(household?.servings ?? 4);
  const [dishCount, setDishCount] = useState(household?.dishCount ?? 3);
  const [preferences, setPreferences] = useState(household?.preferences ?? "");
  const [budget, setBudget] = useState(household?.budgetCents == null ? "" : String(household.budgetCents / 100));
  const [autoPlan, setAutoPlan] = useState(household?.autoPlan ?? false);
  const { busy, error, run } = useAction();
  const path = planner + "/household";

  if (!household) return <Card className="space-y-4">
    <h2 className="text-lg font-bold">Dein Haushalt</h2>
    <ErrorMessage>{error}</ErrorMessage>
    <div className="grid gap-4 sm:grid-cols-2">
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => onChange(await update<Household>(path, "POST", { name })));
      }}>
        <label>Haushaltsname<Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <Button disabled={busy}>Haushalt anlegen</Button>
      </form>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => onChange(await update<Household>(path + "/join", "POST", { token })));
      }}>
        <label>Einladungscode<Input required autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label>
        <Button disabled={busy}>Einladung annehmen</Button>
      </form>
    </div>
  </Card>;

  return <Card className="space-y-3">
    <details>
      <summary className="cursor-pointer text-lg font-bold">Haushalt · {household.name}</summary>
      <div className="mt-3 space-y-4">
        <ErrorMessage>{error}</ErrorMessage>
        <ul className="space-y-1">{household.members.map((member) => <li key={member.userId} className="flex flex-wrap items-center gap-3">
          <span>{member.user.name}{member.role === "owner" ? " · Verwaltung" : ""}</span>
          {household.role === "owner" && member.role !== "owner" && <Button variant="secondary" type="button" disabled={busy} onClick={() => void run(async () => {
            await update(path + "/members/" + member.userId, "DELETE");
            onChange({ ...household, members: household.members.filter(({ userId }) => userId !== member.userId) });
          })}>Entfernen</Button>}
        </li>)}</ul>
        {household.role === "owner" && <>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(async () => {
            const value = await update<NonNullable<typeof invite>>(path + "/invites", "POST");
            setInvite(value);
            onChange({ ...household, invitations: [...household.invitations, value] });
          })}>Einladungscode erstellen</Button>
          {invite && <label className="block">Code zum Weitergeben (gültig bis {expiry(invite.expiresAt)})<Input readOnly value={invite.token} onFocus={(event) => event.currentTarget.select()} /></label>}
          {household.invitations.length > 0 && <ul className="space-y-2">
            {household.invitations.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>Offene Einladung · gültig bis {expiry(entry.expiresAt)}</span>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(async () => {
                await update(path + "/invites/" + entry.id, "DELETE");
                if (invite?.id === entry.id) setInvite(undefined);
                onChange({ ...household, invitations: household.invitations.filter(({ id }) => id !== entry.id) });
              })}>Einladung widerrufen</Button>
            </li>)}
          </ul>}
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => onChange(await update<Household>(path, "PUT", { name, servings, dishCount, preferences, budgetCents: budget ? Math.round(Number(budget) * 100) : null, autoPlan })), "Haushaltseinstellungen gespeichert");
          }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>Haushaltsname<Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label>Portionen pro Gericht<Input required type="number" min={1} max={100} value={servings || ""} onChange={(event) => setServings(Number(event.target.value))} /></label>
              <label>Gerichte pro Woche<Input required type="number" min={1} max={14} value={dishCount || ""} onChange={(event) => setDishCount(Number(event.target.value))} /></label>
              <label>Einkaufsbudget (€)<Input type="number" min={0} max={10000} step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
            </div>
            <label className="block">Gemeinsame Vorlieben<textarea className={field} maxLength={1500} value={preferences} onChange={(event) => setPreferences(event.target.value)} /></label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={autoPlan} onChange={(event) => setAutoPlan(event.target.checked)} /> Wochenentwurf sonntags um 09:00 Uhr erstellen</label>
            <Button disabled={busy}>Einstellungen speichern</Button>
          </form>
        </>}
      </div>
    </details>
  </Card>;
}
