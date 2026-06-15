import { PDFDocument } from "pdf-lib";

/**
 * Merge several PDFs (as raw bytes) into one, preserving page order.
 * Pure + dependency-light so it runs under the node:test harness.
 */
export async function combinePdfs(sources: Uint8Array[]): Promise<Uint8Array> {
  if (sources.length === 0) {
    throw new Error("combinePdfs: no sources provided");
  }
  const out = await PDFDocument.create();
  for (const bytes of sources) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  return out.save();
}
