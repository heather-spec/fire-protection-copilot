import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { combinePdfs } from "./combine";

async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200]);
  return doc.save();
}

describe("combinePdfs", () => {
  it("merges sources into one PDF whose page count is the sum", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const merged = await combinePdfs([a, b]);
    const out = await PDFDocument.load(merged);
    assert.equal(out.getPageCount(), 5);
  });

  it("returns a single-source PDF unchanged in page count", async () => {
    const a = await makePdf(4);
    const merged = await combinePdfs([a]);
    const out = await PDFDocument.load(merged);
    assert.equal(out.getPageCount(), 4);
  });
});
