import fs from "node:fs";
import path from "node:path";
import type { DeskItem } from "./types";

const SEED_PATH = path.join(process.cwd(), "data", "desk-seed", "items.json");
export const PDF_DIR = path.join(process.cwd(), "data", "desk-seed", "pdfs");

export function loadSeedItems(): DeskItem[] {
  const raw = fs.readFileSync(SEED_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("items.json must be a JSON array");
  return parsed as DeskItem[];
}

export function pdfPath(filename: string): string {
  return path.join(PDF_DIR, filename);
}
