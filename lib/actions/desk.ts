"use server";

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getDeskItem, updateDeskState, resetDesk as resetStore } from "@/lib/desk/store";
import { pdfPath } from "@/lib/desk/seed";
import { combinePdfs } from "@/lib/desk/combine";
import { checkPdfCompleteness } from "@/lib/ai/completeness";
import { getAiProvider } from "@/lib/ai/provider";
import { bounceNotePrompt } from "@/lib/ai/prompts";
import { filePacket, demoCredsFromEnv } from "@/lib/servicetrade/demo-client";
import type { FileDestination } from "@/lib/desk/types";

const OUT_DIR = path.join(process.cwd(), "public", "desk-out");

function revalidate(id: string): void {
  revalidatePath("/desk");
  revalidatePath(`/desk/${id}`);
}

export async function combineItem(id: string): Promise<void> {
  const item = getDeskItem(id);
  if (!item) return;
  try {
    const buffers = await Promise.all(
      item.sourcePdfs.map((f) => fs.readFile(pdfPath(f))),
    );
    const merged = await combinePdfs(buffers.map((b) => new Uint8Array(b)));
    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUT_DIR, `${id}.pdf`), merged);
    const { PDFDocument } = await import("pdf-lib");
    const pageCount = (await PDFDocument.load(merged)).getPageCount();
    updateDeskState(id, {
      stage: "combine",
      combinedPacketUrl: `/desk-out/${id}.pdf`,
      combinedPageCount: pageCount,
      error: null,
    });
  } catch (e) {
    updateDeskState(id, { error: `Combine failed: ${(e as Error).message}` });
  }
  revalidate(id);
}

export async function runCheck(id: string): Promise<void> {
  const item = getDeskItem(id);
  if (!item) return;
  try {
    const bytes = new Uint8Array(await fs.readFile(pdfPath(item.showpiecePdf)));
    const completeness = await checkPdfCompleteness({
      pdfBytes: bytes,
      formName: item.formName,
      requiredFields: item.requiredFields,
    });
    updateDeskState(id, { completeness, error: null });
  } catch (e) {
    updateDeskState(id, { error: `Check failed: ${(e as Error).message}` });
  }
  revalidate(id);
}

export async function bounceBack(id: string): Promise<void> {
  const item = getDeskItem(id);
  if (!item || !item.state.completeness) return;
  const missing = item.state.completeness.issues
    .filter((i) => i.rule === "missing_required")
    .map((i) => ({ field: i.field_label ?? i.field_name ?? "field", reason: i.message }));
  let note = "";
  try {
    const { systemPrompt, userPrompt } = bounceNotePrompt({
      formName: item.formName,
      customer: item.customer,
      missing,
    });
    const res = await getAiProvider().generate({ systemPrompt, userPrompt, maxTokens: 512 });
    note = res.output;
  } catch (e) {
    note = `Please complete the missing readings: ${missing.map((m) => m.field).join(", ")}.`;
  }
  updateDeskState(id, { stage: "review", bounceNote: note, error: null });
  revalidate(id);
}

export async function fileItem(id: string): Promise<void> {
  const item = getDeskItem(id);
  if (!item || !item.state.combinedPacketUrl) {
    updateDeskState(id, { error: "Combine the packet before filing." });
    revalidate(id);
    return;
  }
  const destinations: FileDestination[] = [];
  try {
    const merged = new Uint8Array(await fs.readFile(path.join(OUT_DIR, `${id}.pdf`)));
    const result = await filePacket(merged, `${item.jobNumber}-packet.pdf`, demoCredsFromEnv());
    destinations.push({
      name: "ServiceTrade (demo job)",
      status: "real",
      detail: `Attached as Job Paperwork (attachment #${result.attachmentId}).`,
    });
  } catch (e) {
    updateDeskState(id, { error: `File to ServiceTrade failed: ${(e as Error).message}` });
    revalidate(id);
    return;
  }
  destinations.push(
    { name: "OneDrive", status: "simulated", detail: "Customer folder (simulated)." },
    { name: "Network drive", status: "simulated", detail: "Compliance archive (simulated)." },
    { name: "Customer portal", status: "simulated", detail: "Delivery queue (simulated)." },
  );
  updateDeskState(id, { stage: "done", destinations, error: null });
  revalidate(id);
}

export async function resetDesk(): Promise<void> {
  resetStore();
  revalidatePath("/desk");
}
