import type { DeskItemWithState, DeskStage } from "@/lib/desk/types";
import { ItemCard } from "./item-card";

const LANE_TITLES: Record<DeskStage, string> = {
  review: "1 · Review",
  combine: "2 · Combine",
  file: "3 · File",
  done: "Filed",
};

export function Lane({ stage, items }: { stage: DeskStage; items: DeskItemWithState[] }) {
  return (
    <div className="flex-1 min-w-[220px] space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
        {LANE_TITLES[stage]} ({items.length})
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
            Nothing here
          </div>
        ) : (
          items.map((i) => <ItemCard key={i.id} item={i} />)
        )}
      </div>
    </div>
  );
}
