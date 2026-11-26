import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-mint disabled:opacity-60",
        variant === "primary" ? "bg-ink text-white hover:bg-slate-800 dark:bg-mint dark:text-slate-950" : "border border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800",
        className
      )}
      {...props}
    />
  );
}
