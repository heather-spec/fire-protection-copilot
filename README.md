# Fire Protection Compliance Copilot

A compliance-first workflow platform for small and mid-sized fire protection contractors:
inspections, testing, maintenance, service calls, deficiency tracking, impairments,
and fire-watch documentation — all with a real review workflow and audit trail.

This repository is the **phase 2 MVP**: technicians can capture work in the field,
reviewers can approve reports with a full audit trail, deficiencies are tracked with
priority + due dates + a timeline, AI drafting is wired in behind a provider
abstraction, and reports print on letter-size paper. Photo capture, offline mode,
and a customer portal are deferred to phase 3 (see bottom).

---

## Stack

- **Next.js 14** App Router + TypeScript
- **Tailwind CSS** + shadcn-style hand-rolled UI primitives (no CLI dep)
- **Supabase** — Postgres, Auth, Storage, RLS, Realtime-ready
- **Vercel**-ready (zero-config deploy)

---

## Quick start

### 1. Install

```bash
cd fire-protection-copilot
npm install
```

### 2. Create a Supabase project

Go to [app.supabase.com](https://app.supabase.com) → New project. Grab from
**Project Settings → API**:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

And from **Project Settings → Database → Connection string**:

- URI → `SUPABASE_DB_URL`

Copy `.env.example` to `.env.local` and fill those in.

### 3. Apply schema + RLS + seed

Run each in order via the Supabase SQL editor or `psql`:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_features.sql
psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
psql "$SUPABASE_DB_URL" -f supabase/seed/0002_seed_features.sql
```

### Optional: AI keys

The AI features ship with a deterministic **mock provider** that never invents
NFPA codes — drafts only rearrange the technician's source inputs. To use a real
model, add either of these to `.env.local`:

```bash
ANTHROPIC_API_KEY=...     # uses claude-sonnet-4-6 by default
# or
OPENAI_API_KEY=...        # uses gpt-4o-mini by default
# optional overrides
AI_PROVIDER=anthropic     # forces a provider
AI_MODEL=claude-sonnet-4-6
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo logins after seeding:

| Role        | Email                        | Password        |
| ----------- | ---------------------------- | --------------- |
| Admin       | `admin@sentinel.demo`        | `DemoPass123!`  |
| Reviewer    | `reviewer@sentinel.demo`     | `DemoPass123!`  |
| Technician  | `tech1@sentinel.demo`        | `DemoPass123!`  |
| Technician  | `tech2@sentinel.demo`        | `DemoPass123!`  |

All four are members of **Sentinel Fire Protection**, the demo organization.

---

## Architecture

### Multi-tenant model

```
organizations
   └─ memberships  (org_id × profile_id × role: admin|technician|reviewer)
        └─ profiles (1:1 with auth.users)

organizations
   └─ customers
        └─ sites
             ├─ site_contacts         (per-site facilities leads etc.)
             ├─ assets                (sprinklers, panels, pumps, extinguishers…)
             └─ work_records          (inspection|test|maintenance|service_call|
                                       deficiency_followup|impairment|fire_watch)
                  ├─ work_record_observations  (line items, NFPA code references)
                  ├─ report_versions   (every AI draft + reviewer edit + finalized)
                  └─ deficiencies
                       └─ deficiency_updates   (timeline + status changes)

cross-cutting
   ├─ attachments      (polymorphic: photos, PDFs, signatures)
   ├─ ai_generations   (every AI call: provider, model, prompt, output, status)
   └─ audit_logs       (every notable state change, including AI generations)
```

Every tenant-scoped table carries `org_id`, every column is typed, every
timestamp is `timestamptz`, every FK respects cascades.

### Row-Level Security

Every table has RLS enabled. Two `SECURITY DEFINER` helper functions
(`is_org_member`, `has_org_role`) keep policies short and prevent
recursive lookups on the `memberships` table itself.

Workflow rules are encoded in the security layer, not the app layer:

- Technicians can only edit their own **draft** work records.
- Reviewers and admins can update any record (e.g. approve/reject).
- Audit logs are readable only by admin/reviewer; writable by any member.

This means even a buggy or compromised client can't bypass workflow.

### Auth flow

- **`middleware.ts`** uses `@supabase/ssr` to refresh the session cookie on
  every request and redirect unauthenticated users to `/login`.
- **`/login`** and **`/signup`** use the browser client and Zod validation.
- **`/callback`** handles email-confirmation redirects.
- **`POST /api/auth/signout`** clears the session server-side.

### Folder map

```
app/
├── (auth)/           login, signup, /callback
├── (app)/            dashboard, customers, sites, work-records,
│                     deficiencies, reports, settings  (all auth-gated)
├── api/auth/         signout route handler
├── layout.tsx
├── page.tsx          → /login
└── globals.css

components/
├── ui/               button, card, table, badge, input, label,
│                     separator, skeleton, empty-state, page-header
├── app-shell/        sidebar, mobile-nav, topbar, user-menu, nav-items
└── dashboard/        metric-card, status-pill

lib/
├── supabase/         client (browser), server (RSC), middleware, admin
├── db/               types (typed Database), queries (server data access)
└── utils/            cn, format

supabase/
├── migrations/
│   ├── 0001_init.sql  (schema, enums, indexes, triggers)
│   └── 0002_rls.sql   (helpers + every RLS policy)
└── seed/
    └── seed.sql       (one demo org with realistic fire-protection data)
```

---

## Scripts

```bash
npm run dev         # next dev
npm run build       # next build
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm run db:seed     # psql -f supabase/seed/seed.sql  (requires SUPABASE_DB_URL)
```

---

## What's in this MVP (phase 2 additions)

### Workflows

- **Full CRUD** on customers, sites, work records, deficiencies.
- **Site detail** page with related work records, deficiencies, assets, and an
  inline editor for site contacts.
- **Adaptive work-record form**: ITM (inspection/test/maintenance) collects
  observations as line items; service calls capture issue/action/parts/resolution;
  deficiency follow-ups capture addressed/result/remaining; impairments capture
  system-out + AHJ-notified + start/expected-end; fire watch captures
  interval + rounds + incidents + related impairment.
- **Reviewer console** on the work-record detail page: source-of-truth inputs
  are visually separated from generated content. Reviewers can edit, approve,
  reject, or request revision. Every reviewer edit is a new `report_versions`
  row (versioned and timestamped). Approving writes a `finalized` version row.
- **Deficiency workflows**: manual create, AI-extracted (see below),
  per-deficiency timeline with status-change comments, filterable list,
  board (kanban) view by status, CSV export at `/api/deficiencies/export`.

### AI-assisted drafting

- **Provider abstraction** (`lib/ai/`) — selects between Anthropic, OpenAI, or
  a deterministic mock based on env vars. Mock works without keys so demos always run.
- **Three actions**: generate a report draft, generate a client-facing
  summary, extract structured deficiencies from observations. Each call:
  1. Loads the work record's source inputs (notes, observations, voice transcript).
  2. Renders a prompt template from `lib/ai/prompts.ts` (rules: never invent
     NFPA codes; output starts with `DRAFT — generated...; Reviewer must
     verify before finalizing.`; insufficient data → say so explicitly).
  3. Calls the provider, captures `provider`, `model`, `prompt`, `output`,
     `status` into `ai_generations`.
  4. Writes a `report_versions` row of kind `ai_draft` linked back to that
     `ai_generations.id`.
  5. Audit-logs the event.
- **Deficiency extraction** parses strict JSON output and creates real
  `deficiencies` rows; every row gets its own `ai_extract` audit entry so
  a reviewer can trace and undo.

### Audit trail

Every server-side mutation calls `audit({...})` which writes a row into
`audit_logs` with `org_id`, `actor_id`, `action`, `target_table`, `target_id`,
and a payload. Logged actions include `create`, `update`, `delete`, `submit`,
`approve`, `reject`, `request_revision`, `edit_report`, `status_change`,
`comment`, `ai_generate`, `ai_extract`, `export`.

### Reports & exports

- **Printable report** at `/reports/[id]` — bare layout, browser-print friendly,
  shows site address, AHJ, observations grouped by result, finalized narrative.
- **CSV export** at `/api/deficiencies/export` (audit-logged).

### UX

- Mobile-friendly drawer nav for technicians in the field.
- Desktop sidebar + topbar for office review work.
- Empty states with primary actions on every list page.
- Form validation with `useFormState`; pending state via `useFormStatus`.

---

## What's intentionally NOT in this MVP

- **Photo capture + attachments UI.** The `attachments` table + RLS exist;
  storage bucket and upload UI come in phase 3.
- **Offline-first field mode.** IndexedDB queue + background sync.
- **Customer portal.** Read-only subdomain for customers.
- **Org switcher + admin invites.** Today the first membership wins.
- **PDF rendering server-side.** Today, reports print via the browser; a
  signed `@react-pdf/renderer` flow is phase 3.
- **Real prompt caching + token tracking.** Anthropic prompt caching
  headers will go in phase 3 once the prompts stabilize.
- **NFPA template library.** Pre-built observation checklists per system type.

---

## Known gaps + phase 3 roadmap

In rough priority order:

1. **Photo capture + Supabase Storage** — wire the existing `attachments`
   table to an upload UI; show photos inline on observations and deficiencies.
2. **Signed PDF reports** via `@react-pdf/renderer` (server-side, with org logo).
3. **Offline-first field mode** — service worker + IndexedDB queue for slow
   sites; sync drafts when back online.
4. **Org switcher + admin invites** — cookie-pinned active org + email-invite
   flow; today the first membership always wins.
5. **NFPA template library** — pre-built observation checklists for NFPA 25
   (water-based), 72 (alarm), 10 (extinguishers), 17A (hood) so techs pick a
   template and observations are pre-populated.
6. **AI hardening** — Anthropic prompt caching headers; token + cost tracking
   per `ai_generation` row; eval suite that checks prompts never invent codes.
7. **Realtime collaboration** — Supabase Realtime channel per work record so
   two techs editing a fire-watch log don't clobber each other.
8. **Customer portal** — read-only subdomain for facilities managers to see
   their reports + open deficiencies without a full account.
9. **Recurring schedule engine** — auto-create work records on a frequency
   per asset (quarterly inspection, annual flow test, etc.).
10. **Mobile native shell** — wrap the existing PWA in Capacitor for camera +
    GPS + push notifications without rebuilding the app.

---

## License

Internal. All rights reserved.
