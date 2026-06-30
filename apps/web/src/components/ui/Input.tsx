import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/20 dark:border-slate-700 dark:bg-slate-950",
        props.className
      )}
    />
  );
}
