import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

// A more confident metric card: large tabular numeral, micro-label, optional hint,
// optional trailing dot to indicate severity (no chunky icon boxes).
export function MetricCard({
  title,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  title: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "warning" | "destructive" | "success";
}) {
  const accent =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warning"
        ? "bg-warning"
        : tone === "success"
          ? "bg-success"
          : "bg-foreground/40";

  return (
    <div className="group relative flex flex-col justify-between gap-3 rounded-md border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className={cn("h-1 w-1 rounded-full", accent)} />
            {title}
          </div>
        </div>
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground/60" /> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </div>
        {hint ? (
          <div className="pb-1 text-right text-[11px] leading-snug text-muted-foreground">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}
