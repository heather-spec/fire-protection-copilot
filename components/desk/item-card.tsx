import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DeskItemWithState } from "@/lib/desk/types";

export function ItemCard({ item }: { item: DeskItemWithState }) {
  const errs = item.state.completeness?.summary.errors ?? null;
  return (
    <Link
      href={`/desk/${item.id}`}
      className="block rounded-lg border border-border/60 bg-card p-3 hover:border-border transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm">{item.customer}</div>
        {errs !== null &&
          (errs > 0 ? (
            <Badge variant="destructive">{errs} missing</Badge>
          ) : (
            <Badge variant="success">checked</Badge>
          ))}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{item.inspectionType}</div>
      <div className="mt-1 text-xs text-muted-foreground">Job #{item.jobNumber}</div>
      {item.state.bounceNote ? (
        <div className="mt-2 text-xs text-warning">Returned to tech</div>
      ) : null}
    </Link>
  );
}
