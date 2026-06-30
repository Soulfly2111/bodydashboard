export function ProgressRing({ label, value, goal, color = "#26A69A" }: { label: string; value: number; goal: number; color?: string }) {
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 96 96" className="h-20 w-20 shrink-0">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="53" textAnchor="middle" className="fill-ink text-sm font-bold dark:fill-white">
          {Math.round(pct)}%
        </text>
      </svg>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold">{Math.round(value)} / {goal}</p>
      </div>
    </div>
  );
}
