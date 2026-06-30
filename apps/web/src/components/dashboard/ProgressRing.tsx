export function ProgressRing({ label, value, goal, color = "#26A69A" }: { label: string; value: number; goal: number; color?: string }) {
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <svg viewBox="0 0 96 96" className="h-[72px] w-[72px] shrink-0 sm:h-20 sm:w-20">
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
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={label}>{label}</p>
        <p className="whitespace-nowrap text-lg font-bold leading-tight">{Math.round(value)}</p>
        <p className="whitespace-nowrap text-lg font-bold leading-tight text-slate-900 dark:text-white">/ {goal}</p>
      </div>
    </div>
  );
}
