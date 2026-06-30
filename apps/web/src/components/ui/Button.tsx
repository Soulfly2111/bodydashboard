import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.01] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-mint disabled:opacity-60 dark:bg-mint dark:text-slate-950",
        className
      )}
      {...props}
    />
  );
}
