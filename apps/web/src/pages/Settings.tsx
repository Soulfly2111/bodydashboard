import { type FormEvent, useState } from "react";
import { LogOut, Save } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

type Profile = {
  name: string;
  heightCm: string;
  language: string;
  units: string;
  timezone: string;
  trackWeight: boolean;
  trackBodyFat: boolean;
  trackMuscleMass: boolean;
  trackWater: boolean;
};

export default function Settings() {
  const { logout, updateUser, user } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    name: user?.name ?? "",
    heightCm: user?.heightCm ? String(user.heightCm) : "",
    language: user?.language ?? "de",
    units: user?.units ?? "metric",
    timezone: user?.timezone ?? "Europe/Berlin",
    trackWeight: user?.trackWeight ?? true,
    trackBodyFat: user?.trackBodyFat ?? true,
    trackMuscleMass: user?.trackMuscleMass ?? true,
    trackWater: user?.trackWater ?? true
  });

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const updated = await api<NonNullable<typeof user>>("/auth/me", {
      method: "PUT",
      body: JSON.stringify({
        name: profile.name,
        heightCm: profile.heightCm ? Number(profile.heightCm) : null,
        language: profile.language,
        units: profile.units,
        timezone: profile.timezone,
        trackWeight: profile.trackWeight,
        trackBodyFat: profile.trackBodyFat,
        trackMuscleMass: profile.trackMuscleMass,
        trackWater: profile.trackWater
      })
    });
    updateUser(updated);
    toast.success("Einstellungen gespeichert");
  }

  return (
    <form onSubmit={saveSettings} className="grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="mb-4 font-bold">Benutzerprofil</h2>
        <div className="space-y-3">
          <Input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Name" />
          <Input value={user?.email ?? ""} readOnly />
          <Input type="number" step="0.1" value={profile.heightCm} onChange={(event) => setProfile({ ...profile, heightCm: event.target.value })} placeholder="Körpergröße in cm" />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">Tracking</h2>
        <div className="space-y-3">
          {[
            ["trackWeight", "Körpergewicht"],
            ["trackBodyFat", "Körperfett"],
            ["trackMuscleMass", "Muskelmasse"],
            ["trackWater", "Wasser"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <span className="font-medium">{label}</span>
              <input
                type="checkbox"
                checked={Boolean(profile[key as keyof Profile])}
                onChange={(event) => setProfile({ ...profile, [key]: event.target.checked })}
              />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">Einheiten & Sprache</h2>
        <div className="grid gap-3">
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={profile.units} onChange={(event) => setProfile({ ...profile, units: event.target.value })}>
            <option value="metric">Metrisch</option>
            <option value="imperial">Imperial</option>
          </select>
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950" value={profile.language} onChange={(event) => setProfile({ ...profile, language: event.target.value })}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
          <Input value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} placeholder="Zeitzone" />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-bold">Aktionen</h2>
        <div className="flex flex-wrap gap-3">
          <Button><Save size={18} />Alle Einstellungen speichern</Button>
          <Button type="button" className="bg-slate-200 text-ink dark:bg-slate-800 dark:text-white" onClick={logout}><LogOut size={18} />Ausloggen</Button>
        </div>
      </Card>
    </form>
  );
}
