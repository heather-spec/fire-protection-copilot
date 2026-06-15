#!/usr/bin/env node
/**
 * Build clean AcroForm PDF templates from /schema/*.json.
 *
 * Each PDF preserves the EXACT AcroForm field names from the schema so
 * ServiceTrade's auto-fill (which keys off `servicetrade_*` merge fields)
 * works without any additional mapping. This replaces RTF's PowerPoint-built
 * forms that drift on every edit.
 *
 * Run:
 *   npm install pdf-lib          # one-time
 *   node scripts/build-pdf-templates.mjs            # build all forms
 *   node scripts/build-pdf-templates.mjs backflow   # build just one
 *
 * Output: scripts/pdf-out/<form_id>.pdf
 *
 * STATUS: backflow_v1 is the worked sample. Extend the same renderer to the
 * other form IDs using each schema's `group` values as the section boundaries.
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SCHEMA_DIR = resolve(process.cwd(), "schema");
const OUT_DIR = resolve(process.cwd(), "scripts/pdf-out");
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Layout constants — Letter, 1-inch margins, top-down cursor
// ---------------------------------------------------------------------------
const PAGE = { width: 612, height: 792 };
const MARGIN = 54;
const LABEL_W = 180;          // fixed label column; controls start right of it
const LABEL_FONT_SIZE = 8;
const HEADER_FONT_SIZE = 16;
const SECTION_FONT_SIZE = 10;
const RTF_NAVY = rgb(0.07, 0.16, 0.34);
const RTF_ORANGE = rgb(0.96, 0.55, 0.16);

// Minimum row heights per control — label and control share ONE row.
// Actual row height grows to fit the label once wrapped (see measureRow).
const ROW_H = {
  text: 21, triplet: 19, boolean: 18, checkbox: 18,
  long_text: 52, signature: 24, photo: 58,
};
const LABEL_LINE_H = LABEL_FONT_SIZE + 1.5;

// Greedy word-wrap using real font metrics so long checklist questions
// never overflow their row (the cause of the overlapping-labels bug).
function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// A row must fit BOTH its control and its wrapped label.
function measureRow(field, font) {
  const base = ROW_H[field.data_type] ?? ROW_H.text;
  const lines = wrapText(field.label, font, LABEL_FONT_SIZE, LABEL_W - 10);
  const labelH = lines.length * LABEL_LINE_H;
  return { rowH: Math.max(base, labelH + 8), lines };
}

// ---------------------------------------------------------------------------
// Schema → PDF renderer
// ---------------------------------------------------------------------------
async function buildForm(schemaPath) {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  // ----- Brand header bar -----
  page.drawRectangle({
    x: 0, y: y - 6, width: PAGE.width, height: 32,
    color: RTF_NAVY,
  });
  page.drawText("RTF Fire Protection", {
    x: MARGIN, y: y + 8, size: HEADER_FONT_SIZE, font: boldFont, color: rgb(1, 1, 1),
  });
  y -= 50;

  // ----- Form title -----
  page.drawText(schema.form_name, {
    x: MARGIN, y, size: 14, font: boldFont, color: RTF_NAVY,
  });
  if (schema.rtf_form_version) {
    page.drawText(`Form ${schema.rtf_form_version}`, {
      x: PAGE.width - MARGIN - 80, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    });
  }
  y -= 24;

  // ----- Group fields by their `group` property and render section-by-section -----
  const groups = new Map();
  for (const field of schema.fields) {
    const g = field.group ?? "default";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(field);
  }

  for (const [groupName, fields] of groups) {
    // Section heading — keep it glued to at least its first row (no orphans)
    const firstRowH = fields[0] ? measureRow(fields[0], font).rowH : ROW_H.text;
    if (y < MARGIN + 24 + firstRowH) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
    page.drawText(titleCase(groupName), {
      x: MARGIN, y, size: SECTION_FONT_SIZE, font: boldFont, color: RTF_NAVY,
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 4 },
      end: { x: PAGE.width - MARGIN, y: y - 4 },
      thickness: 0.5,
      color: RTF_ORANGE,
    });
    y -= 16;

    // Render each field — measure first so page breaks use the REAL height
    for (const field of fields) {
      const { rowH, lines } = measureRow(field, font);
      if (y - rowH < MARGIN + 10) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
      }
      y = renderField({ field, form, page, font, y, rowH, lines });
    }
    y -= 10; // spacing between groups
  }

  // ----- Footer on every page -----
  for (const p of pdf.getPages()) {
    p.drawText(
      `${schema.form_id} · generated from /schema/${schema.form_id}.json · do not edit PDF directly`,
      { x: MARGIN, y: MARGIN - 24, size: 6, font, color: rgb(0.5, 0.5, 0.5) },
    );
  }

  return pdf;
}

// ---------------------------------------------------------------------------
// Field renderer — sets the AcroForm field name to the EXACT schema.name.
// That is the contract with ServiceTrade auto-fill: ST writes by field name,
// so the name must match the schema verbatim.
//
// Layout model: `y` is the TOP of this field's row. Label and control share
// the row — label baseline vertically centered against the control — so each
// label unambiguously belongs to the control beside it, never the one above.
// Returns the top of the next row.
// ---------------------------------------------------------------------------
function renderField({ field, form, page, font, y, rowH, lines }) {
  const inputX = MARGIN + LABEL_W;
  const inputWidth = PAGE.width - MARGIN - inputX;

  // Label block: vertically centered within the row, drawn line by line
  // (we wrap manually — never pass maxWidth, it overflows the row)
  const labelBlockH = lines.length * LABEL_LINE_H;
  let lineY = y - (rowH - labelBlockH) / 2 - LABEL_FONT_SIZE;
  for (const line of lines) {
    page.drawText(line, {
      x: MARGIN, y: lineY, size: LABEL_FONT_SIZE, font, color: rgb(0.2, 0.2, 0.2),
    });
    lineY -= LABEL_LINE_H;
  }

  // Controls center on the row's midline; single-line inputs stay a fixed
  // height instead of stretching with tall labels.
  const midY = y - rowH / 2;
  const labelY = midY - 3; // baseline for control-side captions (YES/N/A/NO)
  const boxH = field.data_type === "long_text" ? rowH - 6 : Math.min(rowH - 6, 15);
  const boxY = field.data_type === "long_text" ? y - rowH + 3 : midY - boxH / 2;

  switch (field.data_type) {
    case "triplet": {
      // YES / N/A / NO — one checklist line, boxes centered on the label line
      const boxSize = 10;
      const labels = ["YES", "N/A", "NO"];
      let bx = inputX;
      for (const opt of labels) {
        const cb = form.createCheckBox(`${field.name}__${opt.replace("/", "")}`);
        cb.addToPage(page, { x: bx, y: labelY - 2, width: boxSize, height: boxSize });
        page.drawText(opt, {
          x: bx + boxSize + 3, y: labelY, size: LABEL_FONT_SIZE, font,
        });
        bx += 60;
      }
      break;
    }
    case "boolean":
    case "checkbox": {
      const cb = form.createCheckBox(field.name);
      cb.addToPage(page, { x: inputX, y: labelY - 2, width: 10, height: 10 });
      break;
    }
    case "long_text": {
      const tx = form.createTextField(field.name);
      tx.enableMultiline();
      tx.addToPage(page, {
        x: inputX, y: boxY, width: inputWidth, height: boxH,
        borderColor: rgb(0.7, 0.8, 0.95), backgroundColor: rgb(0.94, 0.97, 1),
      });
      break;
    }
    case "signature":
      // No native signature field — render an underline to be signed
      page.drawLine({
        start: { x: inputX, y: labelY - 2 },
        end: { x: PAGE.width - MARGIN, y: labelY - 2 },
        thickness: 0.5, color: rgb(0.3, 0.3, 0.3),
      });
      break;
    case "photo":
      // Photo placeholder box — appears empty in the AcroForm
      page.drawRectangle({
        x: inputX, y: boxY, width: 140, height: boxH,
        borderColor: rgb(0.6, 0.85, 0.6), borderWidth: 0.5,
        color: rgb(0.95, 1, 0.95),
      });
      break;
    default: {
      // text, date, number, enum (rendered as text — ST auto-fill is value-based)
      const tx = form.createTextField(field.name);
      tx.addToPage(page, {
        x: inputX, y: boxY, width: inputWidth, height: boxH,
        borderColor: rgb(0.7, 0.8, 0.95), backgroundColor: rgb(0.94, 0.97, 1),
      });
    }
  }
  return y - rowH;
}

function titleCase(s) {
  return s.split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const arg = process.argv[2];
const allFiles = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith(".json") && !f.startsWith("_") && f !== "index.json");

const toBuild = arg
  ? allFiles.filter((f) => f.replace(".json", "") === arg || JSON.parse(readFileSync(join(SCHEMA_DIR, f), "utf8")).form_id === arg)
  : allFiles;

if (toBuild.length === 0) {
  console.error(`No schema matches "${arg}". Available:`, allFiles.map((f) => f.replace(".json", "")));
  process.exit(1);
}

for (const file of toBuild) {
  try {
    const pdf = await buildForm(join(SCHEMA_DIR, file));
    const bytes = await pdf.save();
    const formId = JSON.parse(readFileSync(join(SCHEMA_DIR, file), "utf8")).form_id;
    const outPath = join(OUT_DIR, `${formId}.pdf`);
    writeFileSync(outPath, bytes);
    console.log(`✓ ${formId.padEnd(28)} → ${outPath}`);
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}
console.log(`\nWrote ${toBuild.length} PDF(s) to ${OUT_DIR}`);
