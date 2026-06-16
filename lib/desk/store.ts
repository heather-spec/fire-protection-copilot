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

interface DeskStoreState {
  items: DeskItem[];
  states: Map<string, DeskItemState>;
}

// Hold the store on globalThis so a SINGLE instance is shared between server
// actions and page renders (Next can otherwise evaluate this module more than
// once, which would let an action mutate a different copy than the page reads),
// and so the queue survives dev hot-reloads.
const g = globalThis as unknown as { __deskStore?: DeskStoreState };

function store(): DeskStoreState {
  if (!g.__deskStore) {
    const items = loadSeedItems();
    g.__deskStore = {
      items,
      states: new Map(items.map((i) => [i.id, freshState()])),
    };
  }
  return g.__deskStore;
}

export function listDeskItems(): DeskItemWithState[] {
  const { items, states } = store();
  return items.map((i) => ({ ...i, state: states.get(i.id)! }));
}

export function getDeskItem(id: string): DeskItemWithState | null {
  const { items, states } = store();
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  return { ...item, state: states.get(id)! };
}

export function updateDeskState(id: string, patch: Partial<DeskItemState>): void {
  const { states } = store();
  const current = states.get(id);
  if (!current) throw new Error(`updateDeskState: unknown id "${id}"`);
  states.set(id, { ...current, ...patch });
}

export function resetDesk(): void {
  g.__deskStore = undefined;
  store();
}
