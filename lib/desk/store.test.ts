import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listDeskItems, getDeskItem, updateDeskState, resetDesk } from "./store";

describe("desk store", () => {
  it("loads seeded items, all starting in the review stage", () => {
    resetDesk();
    const items = listDeskItems();
    assert.ok(items.length >= 1, "expected at least one seeded item");
    assert.ok(items.every((i) => i.state.stage === "review"));
  });

  it("updateDeskState patches one item and getDeskItem reflects it", () => {
    resetDesk();
    const first = listDeskItems()[0];
    updateDeskState(first.id, { stage: "file", combinedPageCount: 4 });
    const after = getDeskItem(first.id);
    assert.equal(after!.state.stage, "file");
    assert.equal(after!.state.combinedPageCount, 4);
  });

  it("resetDesk restores every item to the review stage", () => {
    resetDesk();
    const first = listDeskItems()[0];
    updateDeskState(first.id, { stage: "done" });
    resetDesk();
    assert.equal(getDeskItem(first.id)!.state.stage, "review");
  });
});
