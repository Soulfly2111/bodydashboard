import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";

export function MetricCard({ icon: Icon, label, value, unit }: { icon: LucideIcon; label: string; value: string | number; unit?: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}<span className="text-sm font-medium text-slate-500"> {unit}</span></p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-mint/12 text-mint">
          <Icon size={22} />
        </div>
      </div>
    </Card>
  );
}
