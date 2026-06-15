import { loadSeedItems } from "./seed";
import type { DeskItem, DeskItemState, DeskItemWithState } from "./types";

function freshState(): DeskItemState {
  return {
    stage: "review",
    combinedPacketUrl: null,
    combinedPageCount: null,
    completeness: null,
    bounceNote: null,
    destinations: null,
    error: null,
  };
}

let items: DeskItem[] | null = null;
let states: Map<string, DeskItemState> | null = null;

function ensure(): void {
  if (items && states) return;
  items = loadSeedItems();
  states = new Map(items.map((i) => [i.id, freshState()]));
}

export function listDeskItems(): DeskItemWithState[] {
  ensure();
  return items!.map((i) => ({ ...i, state: states!.get(i.id)! }));
}

export function getDeskItem(id: string): DeskItemWithState | null {
  ensure();
  const item = items!.find((i) => i.id === id);
  if (!item) return null;
  return { ...item, state: states!.get(id)! };
}

export function updateDeskState(id: string, patch: Partial<DeskItemState>): void {
  ensure();
  const current = states!.get(id);
  if (!current) throw new Error(`updateDeskState: unknown id "${id}"`);
  states!.set(id, { ...current, ...patch });
}

export function resetDesk(): void {
  items = null;
  states = null;
  ensure();
}
