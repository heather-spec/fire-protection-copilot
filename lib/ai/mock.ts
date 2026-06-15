import type { AiProvider, AiCompletionInput, AiCompletionResult } from "./types";

/**
 * Deterministic mock provider. Used when no AI API key is configured so
 * the demo works end-to-end without external dependencies.
 *
 * The mock does not invent NFPA codes, dates, or numbers; it only
 * re-arranges fragments of the input into a plausible narrative,
 * which honours the project rule: never fabricate facts.
 */
export const mockProvider: AiProvider = {
  name: "mock",
  defaultModel: "mock-baseline-v1",
  async generate(input: AiCompletionInput): Promise<AiCompletionResult> {
    const lines = input.userPrompt.split("\n").map((l) => l.trim()).filter(Boolean);

    // Pull lines that contain key:value pairs ("Site:", "Visit type:", etc.)
    const facts: Record<string, string> = {};
    for (const line of lines) {
      const m = line.match(/^([A-Z][A-Za-z _-]+):\s*(.+)$/);
      if (m) facts[m[1].trim()] = m[2].trim();
    }

    const observations = lines.filter((l) => /^[-•*]\s+/.test(l)).map((l) => l.replace(/^[-•*]\s+/, "").trim());

    const hasNotes = !!facts["Technician notes"] && facts["Technician notes"].toLowerCase() !== "(none)";
    const insufficient =
      observations.length === 0 && !hasNotes && !facts["Summary"];

    if (insufficient) {
      return {
        provider: "mock",
        model: "mock-baseline-v1",
        output:
          "Insufficient source data: no observations, notes, or summary were provided. " +
          "Please add at least one observation, a technician note, or a summary before generating a draft.",
      };
    }

    const parts: string[] = [];
    parts.push("DRAFT — generated from technician inputs. Reviewer must verify before finalizing.\n");

    if (facts["Visit type"] && facts["Site"] && facts["Customer"]) {
      const jurisdictionTail = facts["Jurisdiction"]
        ? ` (AHJ: ${facts["Jurisdiction"]}${facts["Adopted code"] ? `; ${facts["Adopted code"]}` : ""})`
        : "";
      parts.push(
        `A ${facts["Visit type"].toLowerCase()} visit was performed at ${facts["Site"]} ` +
          `(${facts["Customer"]})${jurisdictionTail}` +
          (facts["Completed"] ? ` on ${facts["Completed"]}.` : "."),
      );
    }

    if (facts["Technician"]) parts.push(`Work performed by ${facts["Technician"]}.`);

    if (observations.length > 0) {
      parts.push("\nObservations recorded during the visit:");
      for (const obs of observations) parts.push(`• ${obs}`);
    }

    if (hasNotes) {
      parts.push("\nTechnician notes:");
      parts.push(facts["Technician notes"]);
    }

    if (facts["Summary"]) {
      parts.push("\nField summary:");
      parts.push(facts["Summary"]);
    }

    const failed = observations.filter((o) => /\b(fail|fault|trouble|deficient)\b/i.test(o));
    if (failed.length > 0) {
      parts.push("\nItems flagged for follow-up:");
      for (const f of failed) parts.push(`• ${f}`);
    } else if (observations.length > 0) {
      parts.push("\nNo failing items were recorded; corrective actions should be reviewed against AHJ requirements.");
    }

    // If the source block listed jurisdiction amendments, surface a reminder.
    // We don't try to MATCH them to specific observations — that's the real
    // model's job. We just nudge the reviewer to check.
    if (lines.some((l) => l.startsWith("- NFPA") && l.includes("→"))) {
      parts.push(
        "\nLocal code amendments may apply for this jurisdiction (see source inputs). " +
          "Reviewer should verify each NFPA citation against the adopted local code reference.",
      );
    }

    parts.push(
      "\nThis draft was assembled from source inputs only. Any required NFPA citations, " +
        "code references, or values not present in the field record should be added by the reviewer.",
    );

    return {
      provider: "mock",
      model: "mock-baseline-v1",
      output: parts.join("\n"),
    };
  },
};
