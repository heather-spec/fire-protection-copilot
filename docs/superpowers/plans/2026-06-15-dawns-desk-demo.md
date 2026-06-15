# Dawn's Desk Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, polished three-step "Dawn's Desk" demo (Combine → Check → File) on the existing `fire-protection-copilot` app, where the Check step genuinely runs Claude on a real RTF inspection PDF.

**Architecture:** A new `/desk` route group renders a pipeline board over a small in-memory store seeded from a JSON fixture + copied census PDFs (no Supabase, no auth — the app is in demo mode). Combine merges the item's source PDFs with `pdf-lib`; Check extracts the showpiece PDF's AcroForm fields with `pdf-lib` and asks the existing `AiProvider` (Claude) which required readings are blank, rendering through the existing `CompletenessPanel`; File writes the merged packet to the ServiceTrade **demo** account (9000) via a guarded client, then shows a simulated destination fan-out.

**Tech Stack:** Next.js 14 (App Router, Server Actions), TypeScript, `pdf-lib`, the in-repo `AiProvider` (Anthropic Messages API via `fetch`), `node:test`/`tsx` for tests, existing shadcn-style `components/ui` + `CompletenessPanel`.

---

## Conventions for this plan

- Run a single test file with: `node --test --import tsx <path>` (matches `package.json`'s `test` script pattern).
- Typecheck with: `npm run typecheck`.
- All new server-only modules start with `import "server-only";` except pure logic/util modules that are unit-tested under Node (those must NOT import `server-only`, or the test runner errors).
- Commit after each task with the shown message.

## File Structure

**New files:**
- `data/desk-seed/items.json` — the seeded desk queue (3 items).
- `data/desk-seed/pdfs/*.pdf` — copied real census PDFs (showpiece + source reports).
- `public/desk-out/.gitkeep` — output dir for generated packet PDFs (served statically).
- `lib/desk/types.ts` — `DeskItem`, `DeskStage`, `DeskItemState` types (no `server-only`).
- `lib/desk/seed.ts` — loads `items.json` (no `server-only`; read by store + a script).
- `lib/desk/store.ts` — in-memory pipeline state + `resetDesk()` (no `server-only`; pure module state).
- `lib/desk/combine.ts` — `combinePdfs(buffers)` merge util (no `server-only`; unit-tested).
- `lib/desk/combine.test.ts` — merge test.
- `lib/ai/completeness.ts` — `extractAcroFields()` + `checkPdfCompleteness()` (no `server-only`; unit-tested).
- `lib/ai/completeness.test.ts` — extraction + AI-judgement tests (injected provider).
- `lib/servicetrade/demo-client.ts` — `filePacket()` with account-9000 guard (no `server-only`; injectable `fetch`).
- `lib/servicetrade/demo-client.test.ts` — guard + happy-path test (fake fetch).
- `lib/actions/desk.ts` — server actions: `runCheck`, `combineItem`, `bounceBack`, `fileItem`, `resetDesk` (`"use server"`).
- `app/(app)/desk/page.tsx` — the board.
- `app/(app)/desk/[id]/page.tsx` — the item detail view.
- `components/desk/lane.tsx`, `components/desk/item-card.tsx`, `components/desk/destinations-panel.tsx`, `components/desk/desk-actions.tsx` — UI pieces.

**Modified files:**
- `lib/ai/prompts.ts` — append `pdfCompletenessPrompt()` and `bounceNotePrompt()`.
- `components/app-shell/nav-items.ts` — add the "Dawn's Desk" nav entry.

---

### Task 1: Seed data, types, and in-memory store

**Files:**
- Create: `data/desk-seed/pdfs/` (copy 3 PDFs in)
- Create: `data/desk-seed/items.json`
- Create: `public/desk-out/.gitkeep`
- Create: `lib/desk/types.ts`
- Create: `lib/desk/seed.ts`
- Create: `lib/desk/store.ts`
- Test: `lib/desk/store.test.ts`

- [ ] **Step 1: Copy real census PDFs into the repo as demo fixtures**

Pick one mostly-blank AcroForm report as the showpiece (lots of blank required readings → the AI catches real gaps) plus two as "source reports" to merge.

Run:
```bash
mkdir -p data/desk-seed/pdfs public/desk-out
touch public/desk-out/.gitkeep
cp "/Users/heathernianouris/Desktop/rtf-fire/live-exploration/census/2025_42963959_2189265398279297.pdf" data/desk-seed/pdfs/showpiece_mpr.pdf
cp "/Users/heathernianouris/Desktop/rtf-fire/live-exploration/census/2024_36396439_1678151816657281.pdf" data/desk-seed/pdfs/riser_report.pdf
cp "/Users/heathernianouris/Desktop/rtf-fire/live-exploration/census/2024_36410949_1678009950077953.pdf" data/desk-seed/pdfs/backflow_report.pdf
ls -la data/desk-seed/pdfs/
```
Expected: three `.pdf` files listed. (If a path is missing, substitute any other `LIVE_FIELDS` entry from `census_results.json` — criteria: an AcroForm with visibly blank required readings.)

- [ ] **Step 2: Write the seed fixture**

Create `data/desk-seed/items.json`:
```json
[
  {
    "id": "molson-coors-monthly",
    "customer": "Molson Coors — Trenton",
    "site": "115 Enterprise Dr",
    "jobNumber": "48737189",
    "inspectionType": "Monthly Pump Report",
    "formName": "Monthly Fire Pump Report",
    "showpiecePdf": "showpiece_mpr.pdf",
    "sourcePdfs": ["showpiece_mpr.pdf"],
    "requiredFields": [
      "Suction Pressure",
      "Discharge Pressure",
      "Pump Started By",
      "Run Time (min)",
      "Packing Adjusted"
    ]
  },
  {
    "id": "wayfair-riser",
    "customer": "Wayfair — Donaldson",
    "site": "1600 Donaldson Rd",
    "jobNumber": "36396439",
    "inspectionType": "Riser + Backflow",
    "formName": "Annual Riser Report",
    "showpiecePdf": "riser_report.pdf",
    "sourcePdfs": ["riser_report.pdf", "backflow_report.pdf"],
    "requiredFields": [
      "Static Pressure",
      "Residual Pressure",
      "Main Drain Test",
      "Inspector Signature"
    ]
  },
  {
    "id": "sharon-backflow",
    "customer": "242 W Sharon Rd",
    "site": "242 W Sharon Rd",
    "jobNumber": "36410949",
    "inspectionType": "Backflow",
    "formName": "Backflow Device Test Report",
    "showpiecePdf": "backflow_report.pdf",
    "sourcePdfs": ["backflow_report.pdf"],
    "requiredFields": [
      "Initial Reading PSI",
      "Final Reading PSI",
      "Test Gauge Type",
      "Inspector Cert No"
    ]
  }
]
```

- [ ] **Step 3: Write the types**

Create `lib/desk/types.ts`:
```ts
import type { CompletenessResult } from "@/lib/validation/types";

export type DeskStage = "review" | "combine" | "file" | "done";

/** Static, seeded definition of one inspection job on the desk. */
export interface DeskItem {
  id: string;
  customer: string;
  site: string;
  jobNumber: string;
  inspectionType: string;
  formName: string;
  showpiecePdf: string; // filename under data/desk-seed/pdfs
  sourcePdfs: string[]; // filenames under data/desk-seed/pdfs
  requiredFields: string[];
}

export type FileDestinationStatus = "real" | "simulated";

export interface FileDestination {
  name: string;
  status: FileDestinationStatus;
  detail: string;
}

/** Mutable per-session pipeline state for one item. */
export interface DeskItemState {
  stage: DeskStage;
  combinedPacketUrl: string | null; // /desk-out/<id>.pdf once combined
  combinedPageCount: number | null;
  completeness: CompletenessResult | null;
  bounceNote: string | null;
  destinations: FileDestination[] | null;
  error: string | null;
}

export interface DeskItemWithState extends DeskItem {
  state: DeskItemState;
}
```

- [ ] **Step 4: Write the seed loader**

Create `lib/desk/seed.ts`:
```ts
import fs from "node:fs";
import path from "node:path";
import type { DeskItem } from "./types";

const SEED_PATH = path.join(process.cwd(), "data", "desk-seed", "items.json");
export const PDF_DIR = path.join(process.cwd(), "data", "desk-seed", "pdfs");

export function loadSeedItems(): DeskItem[] {
  const raw = fs.readFileSync(SEED_PATH, "utf8");
  return JSON.parse(raw) as DeskItem[];
}

export function pdfPath(filename: string): string {
  return path.join(PDF_DIR, filename);
}
```

- [ ] **Step 5: Write the in-memory store**

Create `lib/desk/store.ts`:
```ts
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

// Module-level state. In Next dev this persists across requests, which is
// exactly what a single-user local demo needs. resetDesk() reloads the seed.
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
  if (!current) return;
  states!.set(id, { ...current, ...patch });
}

export function resetDesk(): void {
  items = null;
  states = null;
  ensure();
}
```

- [ ] **Step 6: Write the failing store test**

Create `lib/desk/store.test.ts`:
```ts
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node --test --import tsx lib/desk/store.test.ts`
Expected: PASS (3 tests). If `items.json` is malformed it fails at load — fix the JSON.

- [ ] **Step 8: Commit**

```bash
git add data/desk-seed public/desk-out lib/desk/types.ts lib/desk/seed.ts lib/desk/store.ts lib/desk/store.test.ts
git commit -m "feat(desk): seed fixture, types, and in-memory pipeline store"
```

---

### Task 2: PDF combine utility

**Files:**
- Create: `lib/desk/combine.ts`
- Test: `lib/desk/combine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/desk/combine.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --import tsx lib/desk/combine.test.ts`
Expected: FAIL — `combinePdfs` is not exported / module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/desk/combine.ts`:
```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test --import tsx lib/desk/combine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/desk/combine.ts lib/desk/combine.test.ts
git commit -m "feat(desk): pdf-lib combine utility for the packet step"
```

---

### Task 3: AI completeness check on a real PDF

**Files:**
- Create: `lib/ai/completeness.ts`
- Modify: `lib/ai/prompts.ts` (append two functions)
- Test: `lib/ai/completeness.test.ts`

- [ ] **Step 1: Append the prompts**

Add to the END of `lib/ai/prompts.ts`:
```ts
/* -------------------------------------------------------------------- */
/* Desk demo: PDF completeness + bounce-back note                       */
/* -------------------------------------------------------------------- */

export interface PdfCompletenessInputs {
  formName: string;
  requiredFields: string[];
  /** field name -> extracted value ("" means blank on the report) */
  reportFields: Record<string, string>;
}

export function pdfCompletenessPrompt(inp: PdfCompletenessInputs) {
  const fieldDump = Object.entries(inp.reportFields)
    .map(([k, v]) => `- ${k}: ${v.trim() === "" ? "(blank)" : v.trim()}`)
    .join("\n");
  const userPrompt = [
    `You are reviewing a completed "${inp.formName}" fire-protection inspection report.`,
    `These readings are REQUIRED for this report to be complete:`,
    inp.requiredFields.map((f) => `- ${f}`).join("\n"),
    ``,
    `Here is every field captured on the report and its value:`,
    fieldDump || "(no extractable fields)",
    ``,
    `Decide which REQUIRED readings are missing or blank. Match required readings`,
    `to report fields by meaning, not exact string (e.g. "Suction Pressure" may`,
    `appear as "Suction PSI"). A field present but blank counts as missing.`,
    ``,
    `Output STRICT JSON only, no prose, this exact shape:`,
    `{ "missing": [ { "field": string, "reason": string } ], "satisfied_count": number }`,
    `where satisfied_count is how many of the ${inp.requiredFields.length} required`,
    `readings are present and non-blank. If everything is present, "missing" is [].`,
  ].join("\n");
  const systemPrompt =
    "You are a meticulous fire-protection report reviewer. Report only what the " +
    "data shows. Never invent values or NFPA codes. Output JSON only.";
  return { systemPrompt, userPrompt };
}

export interface BounceNoteInputs {
  formName: string;
  customer: string;
  missing: Array<{ field: string; reason: string }>;
}

export function bounceNotePrompt(inp: BounceNoteInputs) {
  const userPrompt = [
    `Write a short, friendly note to the field technician asking them to complete`,
    `their "${inp.formName}" report for ${inp.customer}. List exactly what is missing:`,
    inp.missing.map((m) => `- ${m.field}`).join("\n"),
    ``,
    `Two or three sentences. Specific, not preachy. No greeting block, no signature.`,
  ].join("\n");
  const systemPrompt =
    "You write brief, plain, respectful internal messages for a fire-protection " +
    "contractor's back office. No marketing tone.";
  return { systemPrompt, userPrompt };
}

export function safeParseCompletenessJson(
  raw: string,
): { missing: Array<{ field: string; reason: string }>; satisfied_count: number } | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.missing)) return null;
    const missing = parsed.missing
      .filter((m: unknown): m is { field: string; reason: string } =>
        !!m && typeof (m as { field?: unknown }).field === "string")
      .map((m: { field: string; reason?: string }) => ({
        field: m.field,
        reason: typeof m.reason === "string" ? m.reason : "",
      }));
    const satisfied_count =
      typeof parsed.satisfied_count === "number" ? parsed.satisfied_count : 0;
    return { missing, satisfied_count };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/ai/completeness.test.ts`:
```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { extractAcroFields, checkPdfCompleteness } from "./completeness";
import type { AiProvider } from "./types";

async function pdfWithFields(values: Record<string, string>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  let y = 360;
  for (const [name, value] of Object.entries(values)) {
    const tf = form.createTextField(name);
    tf.setText(value);
    tf.addToPage(page, { x: 20, y, width: 200, height: 18 });
    y -= 24;
  }
  return doc.save();
}

/** Provider stub that returns a canned JSON body regardless of input. */
function stubProvider(output: string): AiProvider {
  return {
    name: "mock",
    defaultModel: "stub",
    async generate() {
      return { provider: "mock", model: "stub", output };
    },
  };
}

describe("extractAcroFields", () => {
  it("reads filled and blank text fields by name", async () => {
    const bytes = await pdfWithFields({ "Suction PSI": "55", "Discharge PSI": "" });
    const fields = await extractAcroFields(bytes);
    assert.equal(fields["Suction PSI"], "55");
    assert.equal(fields["Discharge PSI"], "");
  });
});

describe("checkPdfCompleteness", () => {
  it("maps the AI's reported gaps into error-severity issues", async () => {
    const bytes = await pdfWithFields({ "Suction PSI": "55", "Discharge PSI": "" });
    const provider = stubProvider(
      JSON.stringify({
        missing: [{ field: "Discharge Pressure", reason: "blank on report" }],
        satisfied_count: 1,
      }),
    );
    const result = await checkPdfCompleteness(
      {
        pdfBytes: bytes,
        formName: "Monthly Fire Pump Report",
        requiredFields: ["Suction Pressure", "Discharge Pressure"],
      },
      provider,
    );
    assert.equal(result.ok, false);
    assert.equal(result.summary.errors, 1);
    assert.equal(result.summary.required_total, 2);
    assert.equal(result.summary.required_complete, 1);
    const issue = result.issues.find((i) => i.rule === "missing_required");
    assert.ok(issue);
    assert.equal(issue!.severity, "error");
    assert.match(issue!.field_label ?? "", /Discharge Pressure/);
  });

  it("returns ok=true when the AI reports nothing missing", async () => {
    const bytes = await pdfWithFields({ "Suction PSI": "55" });
    const provider = stubProvider(JSON.stringify({ missing: [], satisfied_count: 1 }));
    const result = await checkPdfCompleteness(
      { pdfBytes: bytes, formName: "X", requiredFields: ["Suction Pressure"] },
      provider,
    );
    assert.equal(result.ok, true);
    assert.equal(result.summary.errors, 0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test --import tsx lib/ai/completeness.test.ts`
Expected: FAIL — `extractAcroFields` / `checkPdfCompleteness` not found.

- [ ] **Step 4: Write the implementation**

Create `lib/ai/completeness.ts`:
```ts
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import type { CompletenessResult, CompletenessIssue } from "@/lib/validation/types";
import type { AiProvider } from "./types";
import { getAiProvider } from "./provider";
import { pdfCompletenessPrompt, safeParseCompletenessJson } from "./prompts";

/** Read an AcroForm's fields into a name -> string-value map. Blank = "". */
export async function extractAcroFields(bytes: Uint8Array): Promise<Record<string, string>> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const out: Record<string, string> = {};
  for (const field of form.getFields()) {
    const name = field.getName();
    if (field instanceof PDFTextField) {
      out[name] = field.getText() ?? "";
    } else if (field instanceof PDFCheckBox) {
      out[name] = field.isChecked() ? "checked" : "";
    } else if (field instanceof PDFDropdown) {
      out[name] = (field.getSelected()[0] ?? "");
    } else if (field instanceof PDFRadioGroup) {
      out[name] = field.getSelected() ?? "";
    } else {
      out[name] = "";
    }
  }
  return out;
}

export interface PdfCompletenessArgs {
  pdfBytes: Uint8Array;
  formName: string;
  requiredFields: string[];
}

/**
 * Genuinely-live completeness check: extract the report's fields, ask Claude
 * which required readings are missing, and shape the answer into the same
 * CompletenessResult the existing CompletenessPanel renders.
 *
 * `provider` is injectable for tests; defaults to the configured provider.
 */
export async function checkPdfCompleteness(
  args: PdfCompletenessArgs,
  provider: AiProvider = getAiProvider(),
): Promise<CompletenessResult> {
  const reportFields = await extractAcroFields(args.pdfBytes);
  const { systemPrompt, userPrompt } = pdfCompletenessPrompt({
    formName: args.formName,
    requiredFields: args.requiredFields,
    reportFields,
  });

  const { output } = await provider.generate({
    systemPrompt,
    userPrompt,
    maxTokens: 1024,
  });

  const parsed = safeParseCompletenessJson(output);
  const total = args.requiredFields.length;

  if (!parsed) {
    // Defensive: if the model returned unparseable text, surface one warning
    // rather than crashing the demo.
    const issue: CompletenessIssue = {
      severity: "warning",
      rule: "stale_copy_suspect",
      message: "AI completeness check returned an unreadable response; review manually.",
      group: "ai_check",
    };
    return {
      ok: true,
      issues: [issue],
      summary: { errors: 0, warnings: 1, required_complete: total, required_total: total },
    };
  }

  const issues: CompletenessIssue[] = parsed.missing.map((m) => ({
    severity: "error",
    rule: "missing_required",
    field_name: m.field,
    field_label: m.field,
    group: "ai_check",
    message: m.reason || `${m.field} is missing or blank on the report.`,
  }));

  const complete = Math.max(0, Math.min(total, parsed.satisfied_count));
  return {
    ok: issues.length === 0,
    issues,
    summary: {
      errors: issues.length,
      warnings: 0,
      required_complete: complete,
      required_total: total,
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test --import tsx lib/ai/completeness.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/completeness.ts lib/ai/completeness.test.ts lib/ai/prompts.ts
git commit -m "feat(desk): live AI PDF completeness check + bounce-note prompt"
```

---

### Task 4: ServiceTrade demo-account client (guarded)

**Files:**
- Create: `lib/servicetrade/demo-client.ts`
- Test: `lib/servicetrade/demo-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/servicetrade/demo-client.test.ts`:
```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filePacket } from "./demo-client";

type FetchImpl = typeof fetch;

/** Build a fake fetch routing on URL substring. */
function fakeFetch(routes: {
  token: object;
  account: number;
  attachmentOk?: boolean;
}): FetchImpl {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/oauth2/token")) {
      return new Response(JSON.stringify(routes.token), { status: 200 });
    }
    if (u.includes("/oauth2/userinfo")) {
      return new Response(JSON.stringify({ data: { account: { id: routes.account } } }), {
        status: 200,
      });
    }
    if (u.includes("/attachment")) {
      return new Response(JSON.stringify({ data: { id: 123 } }), {
        status: routes.attachmentOk === false ? 500 : 200,
      });
    }
    return new Response("not found", { status: 404 });
  }) as FetchImpl;
}

const creds = {
  clientId: "demo-id",
  clientSecret: "demo-secret",
  jobId: "999",
};

describe("filePacket", () => {
  it("REFUSES to write when the account is not the demo (9000)", async () => {
    const f = fakeFetch({ token: { access_token: "t" }, account: 9316 });
    await assert.rejects(
      () => filePacket(new Uint8Array([1, 2, 3]), "packet.pdf", creds, f),
      /demo account/i,
    );
  });

  it("uploads the packet when the account is the demo (9000)", async () => {
    const f = fakeFetch({ token: { access_token: "t" }, account: 9000, attachmentOk: true });
    const res = await filePacket(new Uint8Array([1, 2, 3]), "packet.pdf", creds, f);
    assert.equal(res.attachmentId, 123);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --import tsx lib/servicetrade/demo-client.test.ts`
Expected: FAIL — `filePacket` not found.

- [ ] **Step 3: Write the implementation**

Create `lib/servicetrade/demo-client.ts`:
```ts
// Demo-account ServiceTrade client. Structurally cannot touch the live account:
// it asserts the authenticated account id is 9000 before any write, and the
// only write path is uploading a packet to the configured demo job.

const BASE = "https://api.servicetrade.com/api"; // matches the proven Python client
const DEMO_ACCOUNT_ID = 9000;

export interface DemoCreds {
  clientId: string;
  clientSecret: string;
  jobId: string; // SERVICETRADE_TEST_JOB_ID
}

export interface FilePacketResult {
  attachmentId: number;
}

export function demoCredsFromEnv(): DemoCreds {
  const clientId = process.env.SERVICETRADE_CLIENT_ID;
  const clientSecret = process.env.SERVICETRADE_CLIENT_SECRET;
  const jobId = process.env.SERVICETRADE_TEST_JOB_ID;
  if (!clientId || !clientSecret || !jobId) {
    throw new Error("ServiceTrade demo creds missing from environment");
  }
  return { clientId, clientSecret, jobId };
}

async function mintToken(creds: DemoCreds, fetchImpl: typeof fetch): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const res = await fetchImpl(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`ServiceTrade token ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("ServiceTrade token response missing access_token");
  return json.access_token;
}

async function assertDemoAccount(token: string, fetchImpl: typeof fetch): Promise<void> {
  const res = await fetchImpl(`${BASE}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ServiceTrade userinfo ${res.status}`);
  const json = (await res.json()) as { data?: { account?: { id?: number } } };
  const accountId = json.data?.account?.id;
  if (accountId !== DEMO_ACCOUNT_ID) {
    throw new Error(
      `Refusing to write: authenticated account ${accountId} is not the demo account (${DEMO_ACCOUNT_ID}).`,
    );
  }
}

/**
 * Upload a packet PDF to the configured demo job as Job Paperwork.
 * `fetchImpl` is injectable for tests; defaults to global fetch.
 */
export async function filePacket(
  pdfBytes: Uint8Array,
  filename: string,
  creds: DemoCreds,
  fetchImpl: typeof fetch = fetch,
): Promise<FilePacketResult> {
  const token = await mintToken(creds, fetchImpl);
  await assertDemoAccount(token, fetchImpl); // hard guard before any write

  const form = new FormData();
  // ServiceTrade requires the file field to be named exactly "uploadedFile".
  form.append("uploadedFile", new Blob([pdfBytes], { type: "application/pdf" }), filename);
  form.append("entityId", creds.jobId);
  form.append("entityType", "3"); // 3 = Job
  form.append("purposeId", "1"); // 1 = Job Paperwork

  const res = await fetchImpl(`${BASE}/attachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // do NOT set content-type; let fetch add the boundary
    body: form,
  });
  if (!res.ok) throw new Error(`ServiceTrade attachment ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: { id?: number } };
  return { attachmentId: json.data?.id ?? -1 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test --import tsx lib/servicetrade/demo-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/servicetrade/demo-client.ts lib/servicetrade/demo-client.test.ts
git commit -m "feat(desk): guarded ServiceTrade demo-account file-back client"
```

---

### Task 5: Desk server actions

**Files:**
- Create: `lib/actions/desk.ts`

- [ ] **Step 1: Write the server actions**

Create `lib/actions/desk.ts`:
```ts
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
  updateDeskState(id, { stage: "review", bounceNote: note });
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors referencing `lib/actions/desk.ts`. (Pre-existing unrelated errors, if any, are out of scope — note them but don't fix here.)

- [ ] **Step 3: Commit**

```bash
git add lib/actions/desk.ts
git commit -m "feat(desk): server actions for combine, check, bounce, file, reset"
```

---

### Task 6: Desk UI (board + detail + nav)

**Files:**
- Modify: `components/app-shell/nav-items.ts`
- Create: `components/desk/item-card.tsx`
- Create: `components/desk/lane.tsx`
- Create: `components/desk/destinations-panel.tsx`
- Create: `components/desk/desk-actions.tsx`
- Create: `app/(app)/desk/page.tsx`
- Create: `app/(app)/desk/[id]/page.tsx`

- [ ] **Step 1: Add the nav item**

In `components/app-shell/nav-items.ts`, add the `Inbox` icon to the import and a nav entry at the TOP of the array (right after Dashboard):

Change the import line:
```ts
import {
  LayoutDashboard,
  Building2,
  MapPin,
  ClipboardList,
  AlertOctagon,
  FileText,
  Settings,
  Inbox,
  type LucideIcon,
} from "lucide-react";
```
And insert into `navItems` after the Dashboard entry:
```ts
  { href: "/desk",          label: "Dawn's Desk",  icon: Inbox },
```

- [ ] **Step 2: Build the item card**

Create `components/desk/item-card.tsx`:
```tsx
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
```

- [ ] **Step 3: Build the lane**

Create `components/desk/lane.tsx`:
```tsx
import type { DeskItemWithState, DeskStage } from "@/lib/desk/types";
import { ItemCard } from "./item-card";

const LANE_TITLES: Record<Exclude<DeskStage, "done"> | "done", string> = {
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
```

- [ ] **Step 4: Build the destinations panel**

Create `components/desk/destinations-panel.tsx`:
```tsx
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FileDestination } from "@/lib/desk/types";

export function DestinationsPanel({ destinations }: { destinations: FileDestination[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filed to</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {destinations.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            {d.status === "real" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{d.name}</span>
            {d.status === "simulated" ? <Badge variant="warning">simulated</Badge> : null}
            <span className="text-xs text-muted-foreground">{d.detail}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Build the action buttons (client component)**

Create `components/desk/desk-actions.tsx`:
```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { combineItem, runCheck, bounceBack, fileItem } from "@/lib/actions/desk";

type Action = "combine" | "check" | "bounce" | "file";

const LABELS: Record<Action, string> = {
  combine: "Combine packet",
  check: "Run completeness check",
  bounce: "Bounce back to tech",
  file: "File it",
};

export function DeskActionButton({
  id,
  action,
  variant = "default",
  disabled = false,
}: {
  id: string;
  action: Action;
  variant?: "default" | "outline" | "destructive";
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const fns = { combine: combineItem, check: runCheck, bounce: bounceBack, file: fileItem };
  return (
    <Button
      variant={variant}
      disabled={disabled || pending}
      onClick={() => start(() => fns[action](id))}
    >
      {pending ? "Working…" : LABELS[action]}
    </Button>
  );
}
```

- [ ] **Step 6: Build the board page**

Create `app/(app)/desk/page.tsx`:
```tsx
import { listDeskItems } from "@/lib/desk/store";
import { resetDesk } from "@/lib/actions/desk";
import { Lane } from "@/components/desk/lane";
import { Button } from "@/components/ui/button";
import type { DeskStage } from "@/lib/desk/types";

export const dynamic = "force-dynamic";

export default function DeskPage() {
  const items = listDeskItems();
  const byStage = (stage: DeskStage) => items.filter((i) => i.state.stage === stage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dawn&apos;s Desk</h1>
          <p className="text-sm text-muted-foreground">
            Inspection reports flowing from review to filed. Open a card to work it.
          </p>
        </div>
        <form action={resetDesk}>
          <Button type="submit" variant="outline">Reset demo</Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-4">
        <Lane stage="review" items={byStage("review")} />
        <Lane stage="combine" items={byStage("combine")} />
        <Lane stage="file" items={byStage("file")} />
        <Lane stage="done" items={byStage("done")} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Build the detail page**

Create `app/(app)/desk/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeskItem } from "@/lib/desk/store";
import { CompletenessPanel } from "@/components/reviewer/completeness-panel";
import { DeskActionButton } from "@/components/desk/desk-actions";
import { DestinationsPanel } from "@/components/desk/destinations-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default function DeskItemPage({ params }: { params: { id: string } }) {
  const item = getDeskItem(params.id);
  if (!item) notFound();
  const s = item.state;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link href="/desk" className="text-sm text-muted-foreground hover:underline">
          ← Dawn&apos;s Desk
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{item.customer}</h1>
        <p className="text-sm text-muted-foreground">
          {item.inspectionType} · {item.site} · Job #{item.jobNumber}
        </p>
      </div>

      {s.error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{s.error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Step 1: Combine */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">1 · Combine the packet</CardTitle>
          <DeskActionButton id={item.id} action="combine" variant="outline" />
        </CardHeader>
        <CardContent>
          {s.combinedPacketUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {item.sourcePdfs.length} system report(s) merged into one {s.combinedPageCount}-page packet.
              </p>
              <a className="text-sm underline" href={s.combinedPacketUrl} target="_blank" rel="noreferrer">
                View packet PDF
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not combined yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Check (live AI) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">2 · Completeness check (live AI)</CardTitle>
          <DeskActionButton id={item.id} action="check" variant="outline" />
        </CardHeader>
        <CardContent className="space-y-3">
          {s.completeness ? (
            <CompletenessPanel result={s.completeness} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Claude reads the actual report and flags any missing required readings.
            </p>
          )}
          {s.completeness && s.completeness.summary.errors > 0 ? (
            <DeskActionButton id={item.id} action="bounce" variant="destructive" />
          ) : null}
          {s.bounceNote ? (
            <Alert variant="warning">
              <AlertTitle>Returned to the tech with this note</AlertTitle>
              <AlertDescription>{s.bounceNote}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {/* Step 3: File */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">3 · File it</CardTitle>
          <DeskActionButton id={item.id} action="file" disabled={!s.combinedPacketUrl} />
        </CardHeader>
        <CardContent>
          {s.destinations ? (
            <DestinationsPanel destinations={s.destinations} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Writes the packet to the ServiceTrade demo job, then fans out to the other destinations.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Verify it typechecks**

Run: `npm run typecheck`
Expected: no new errors in `app/(app)/desk/**` or `components/desk/**`. If `Alert` has no `warning` variant, use `default` instead (check `components/ui/alert.tsx` variants) — adjust the one prop, don't invent a variant.

- [ ] **Step 9: Commit**

```bash
git add components/app-shell/nav-items.ts components/desk app/\(app\)/desk
git commit -m "feat(desk): board + item detail UI and Dawn's Desk nav entry"
```

---

### Task 7: End-to-end verification (manual)

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run each new test file:
```bash
node --test --import tsx lib/desk/store.test.ts
node --test --import tsx lib/desk/combine.test.ts
node --test --import tsx lib/ai/completeness.test.ts
node --test --import tsx lib/servicetrade/demo-client.test.ts
node --test --import tsx lib/validation/checker.test.ts
```
Expected: all PASS.

- [ ] **Step 2: Start the app**

Run: `npm run dev`
Open `http://localhost:3000/desk`.
Expected: three cards in the "Review" lane; "Dawn's Desk" appears in the sidebar.

- [ ] **Step 3: Walk the demo script on the showpiece item**

Open **Molson Coors — Trenton**:
1. Click **Combine packet** → see "1 report merged into a N-page packet" + a working "View packet PDF" link.
2. Click **Run completeness check** → the completeness panel renders with real errors for the blank required readings (this is the live Claude call; confirm it's not the mock by checking the terminal shows an outbound request, or that results vary from the mock's behavior).
3. Click **Bounce back to tech** → an AI-drafted note appears naming the missing fields; the card returns to Review.
4. On a clean item (or after marking complete), click **File it** → "ServiceTrade (demo job)" shows a real attachment id; OneDrive/portal show "simulated".
5. Optionally open the ServiceTrade demo UI for the test job to confirm the packet attachment landed.
6. Click **Reset demo** on the board → all items return to Review.

- [ ] **Step 4: Confirm the live key is actually in use**

If the check shows the "unreadable response" warning or obviously canned text, confirm `ANTHROPIC_API_KEY` is set in `.env.local` (it is — validated earlier) and that `getAiProvider()` is resolving to `anthropic`, not `mock`. Add a temporary `console.log(getAiProvider().name)` in `runCheck` if needed, then remove it.

- [ ] **Step 5: Commit any verification fixups**

```bash
git add -A
git commit -m "chore(desk): verification fixups"
```

---

## Self-Review

**1. Spec coverage**
- `/desk` board + role-reachable view → Task 6 (nav + board). *(Note: spec mentioned the role-switcher; this plan adds a plain nav entry instead, since auth/roles are off in demo mode — simpler and equivalent for a local demo. Acceptable deviation; flagged.)*
- Combine (reuse combined output) → Task 2 + `combineItem`. *(Deviation: uses a `pdf-lib` merge of source PDFs to produce a real attachable artifact rather than the `combined-customer.tsx` print template. The print template renders an on-screen branded view but isn't a file to attach; the merge is the honest, attachable "combined packet." Flagged.)*
- Check = live AI on a real partially-filled report → Task 3 + `runCheck`. ✓
- Bounce-back with AI-drafted note → Task 3 prompt + `bounceBack`. ✓
- File writes to ServiceTrade demo (9000), guarded → Task 4 + `fileItem`. ✓
- Real vs. simulated destinations → Task 6 `DestinationsPanel`. ✓
- Deterministic checker stays as backbone → untouched; its test runs in Task 7 Step 1. ✓
- Security/deploy gate (local only) → no middleware change; documented in spec §8. ✓
- Phase-3 managed-agent note → spec §12 (narrative only, not built). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Each code step shows complete code. Error handling is concrete (try/catch with `updateDeskState(... error ...)`).

**3. Type consistency:** `CompletenessResult`/`CompletenessIssue` used in `completeness.ts` and the panel match `lib/validation/types.ts` (verified: `rule: "missing_required"`, `severity`, `field_label`, `group`, `summary.{errors,warnings,required_complete,required_total}`). `AiProvider.generate({systemPrompt,userPrompt,maxTokens})` matches `lib/ai/types.ts`. `DeskItem`/`DeskItemState`/`FileDestination` are defined once in `lib/desk/types.ts` and reused. Store function names (`listDeskItems`, `getDeskItem`, `updateDeskState`, `resetDesk`) are consistent across store, actions, and pages.

**Open follow-ups (non-blocking):** the `npm test` script only runs the checker file; Task 7 runs the new test files explicitly. If desired, a later chore can widen the script to a glob — out of scope for the demo.

---

## Execution Handoff

(Handed off by the orchestrator after plan approval — see the parent skill flow.)
