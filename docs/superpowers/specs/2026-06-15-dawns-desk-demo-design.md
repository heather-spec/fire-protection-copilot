# Dawn's Desk — Reporting-Automation Demo (Design Spec)

**Date:** 2026-06-15
**Status:** Draft, awaiting approval
**Repo:** `fire-protection-copilot` (extend, do not fork)
**Audience for the demo:** Max, Alyson, and Dawn at RTF Fire — a pitch artifact shown locally.

## 1. Goal

Show RTF, in one screen, how the manual reporting work Dawn does by hand could flow through an assisted pipeline. The demo walks her three reporting steps end to end:

1. **Combine** — a job's multiple system reports merge into one branded customer packet.
2. **Check** — AI reads the report against the inspection standard and flags anything missing, with a one-click bounce-back to the tech. *(This is the live step.)*
3. **File** — the approved packet lands in ServiceTrade and fans out to the other destinations.

The bar: it must look like a real product and the Check step must genuinely run, on a real RTF report, so Heather can say "I tested it and it works" without an asterisk.

## 2. Scope

**In:**
- A new `/desk` route ("Dawn's Desk") in the existing app, reached via the role-switcher.
- A pipeline board (Review → Combine → File lanes) and a per-job detail view.
- One genuinely live AI completeness check on a real partially-filled inspection PDF.
- A real write-back of the finished packet to the ServiceTrade **demo** account (9000).

**Out (explicitly):**
- Live-account access of any kind. Demo account only.
- Real OneDrive / network-drive / portal integrations (shown as simulated destination fan-out).
- Auth/login. App stays in demo mode for local use. **If this is ever deployed, re-enable the auth gate first** (see §8).
- Estimating, invoicing, and the asset-backfill flows. This demo is the reporting lane only.

## 3. Decisions (locked unless changed at review)

- **Live AI step:** Claude reads a real inspection report PDF, returns a structured completeness assessment (missing/blank required readings, partial rows), and drafts the plain-English bounce-back note. The existing deterministic checker (`lib/validation/checker.ts`) stays as the backbone for clean AcroForm reports; AI handles reading the PDF and writing the human-friendly note.
- **Showpiece report:** a genuinely partially-filled report selected from the live census set (`~/Desktop/rtf-fire/live-exploration/census/`), so the catch is real and not staged. Copied into the repo as a demo fixture (no live access at demo time).
- **Deployment:** local only.

## 4. What already exists (reused) vs. what's new

| Step | Reuses (built + verified) | New (thin) |
|---|---|---|
| Combine | `app/(print)/reports/[id]/_forms/combined-customer.tsx`, `combined_customer_v1` schema, print layout | A "combine" action that assembles the packet for a desk item |
| Check | `components/reviewer/completeness-panel.tsx`, `lib/validation/checker.ts` (+ tests), `lib/ai/provider.ts` (anthropic/openai/mock, no-invented-NFPA guardrail), `lib/ai/prompts.ts` | An AI function that reads a PDF and returns a `CompletenessResult`; a bounce-note prompt |
| File | `scripts/push-to-servicetrade.mjs` pattern, demo creds (`~/Desktop/rtf-fire/servicetrade.env`), attachment API facts in `CLAUDE.md` | A server-side demo ServiceTrade client + a "file" action + destinations panel |
| Shell | `components/app-shell/*` (sidebar, role-switcher, nav-items), existing `app/(app)/layout.tsx`, UI kit | A "Dawn" role + `/desk` nav entry |

The net new code is mostly orchestration and one AI call. The hard parts (completeness UI/engine, combine template, ST attachment mechanics, app shell) are done.

## 5. Architecture

```
/desk (board)            app/(app)/desk/page.tsx
  └─ lanes: Review → Combine → File, cards = desk items
/desk/[id] (detail)      app/(app)/desk/[id]/page.tsx
  ├─ CompletenessPanel (live AI result)
  ├─ bounce-back action (AI-drafted note → "returned to tech")
  ├─ combined packet preview (reuse print form)
  └─ File action + destinations fan-out panel

lib/actions/desk.ts      server actions: runCheck, bounceBack, combine, filePacket
lib/ai/completeness.ts   new: PDF → CompletenessResult via getAiProvider()
lib/servicetrade/demo-client.ts  new: server-only GET/POST to demo acct,
                                  guarded by GET /oauth2/userinfo == 9000 before any write
data/desk-seed/          a small snapshot of demo-account jobs + the showpiece PDF fixture
```

**Pipeline state:** persisted so the demo is repeatable and resettable. Mechanism (new Supabase table vs. lightweight store) finalized in the implementation plan; the app already runs on Supabase.

**Data flow:** seed provides the queue (jobs/customers/locations cached from the demo account, so no mid-pitch network dependency for the board). The **File** step makes a real `POST /api/attachment` to the demo job, then the destinations panel simulates the OneDrive/portal fan-out with clear "simulated" labeling.

## 6. The live AI step (detail)

- Input: the showpiece PDF (AcroForm fields read with `pdf-lib` where present; full-page text/vision otherwise).
- `lib/ai/completeness.ts` sends the extracted report content to `getAiProvider()` and asks for the missing/incomplete required items, mapped to the same `CompletenessResult` shape the existing panel renders. Reuses the no-invented-NFPA guardrail in `prompts.ts`.
- The deterministic `checkCompleteness` runs alongside for AcroForm reports; the two agree on clean reports and the AI adds value on messy ones.
- Bounce-back: a new prompt drafts a short, specific note to the tech ("Static pressure reading on the riser is blank"). Marking the item "returned" moves the card back to the Review lane.
- Provider: real Claude when `ANTHROPIC_API_KEY` is set; `mock` provider keeps the board working with no key (but the showpiece moment needs a key to be genuinely live).

## 7. Real vs. simulated (honesty contract)

- **Real:** the AI completeness check on a real report; the combined packet; the `POST /attachment` write into the ServiceTrade demo job.
- **Simulated (labeled):** OneDrive, network-drive, and portal destinations. The point made (one click, many destinations) holds without pretending the integrations exist.

## 8. Security

The app's `middleware.ts` is intentionally in demo mode (auth disabled). Acceptable for local-only use against fake demo data. **Pre-deploy checklist item:** restore the Supabase session check (or a shared-password / Vercel deployment-protection gate) before this is ever exposed on a URL, because the File step can write to the ServiceTrade demo account. Tracked here so it is not forgotten.

## 9. Success criteria (the demo script)

1. Flip role-switcher to **Dawn** → land on `/desk` with a realistic queue.
2. Open the showpiece job → **Combine** assembles the branded packet from its system reports.
3. **Check** runs live: Claude reads the real report and flags the genuinely-missing reading; panel shows the issue.
4. One click **bounces it back** to the tech with an AI-drafted note; card returns to Review.
5. On a clean job, **File** writes the packet to the ServiceTrade demo job; flip to the real ServiceTrade screen to show it landed; destinations fan out.
6. Reset returns the board to its seeded start for the next run-through.

## 10. Testing

- Keep/extend `lib/validation/checker.test.ts` for the deterministic path.
- Unit-test `lib/ai/completeness.ts` against the `mock` provider (deterministic output) so the build is verifiable without a key.
- A manual smoke checklist matching the §9 script.

## 11. Open questions

- Pipeline-state mechanism (new table vs. lightweight store) — decide in the plan.
- Which exact census report is the showpiece — pick during implementation; criteria: real, conspicuous missing required reading, AcroForm-readable so the deterministic and AI paths can be shown agreeing.

## 12. Phase 3 — where this goes in production (not built now)

The demo is a local, code-orchestrated workflow with a human gate (Dawn approves). That is the correct shape for the pitch and for the workflow itself. The production evolution is a **Claude managed agent** running the same pipeline autonomously:

- An **"overnight clerk"** — a scheduled (cron) managed-agent deployment that nightly pulls the day's completed inspections, combines + completeness-checks them, files the clean ones, and leaves Dawn a morning queue of only the exceptions.
- The **live-account guardrail maps cleanly**: the ServiceTrade write stays a host-side custom tool (the sandbox never holds the credential), preserving the existing "never write to live; credential stays host-side" rule.
- Model `claude-opus-4-8`; rubric-graded Outcomes can enforce "packet complete or bounced."

This is a narrative slide and a future build, not part of this demo's scope. Captured here so the arc (feel it locally now → it runs itself overnight later) is visible to Jon.
