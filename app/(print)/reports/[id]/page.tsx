import { notFound, redirect } from "next/navigation";
import { Flame } from "lucide-react";
import {
  getActiveOrg,
  getCurrentUser,
  getWorkRecord,
  listObservations,
  listReportVersions,
} from "@/lib/db/queries";
// NOTE: The next four imports are added by Agent B's data-model PR:
//   - getInspectionTemplateByFormId / getInspectionTemplateForRecord — template lookup
//   - listWorkRecordReadings — readings table query
//   - listAssetsForWorkRecord — assets scoped to the work record
// If those aren't yet on `lib/db/queries`, the dispatch path is gated on the
// template lookup returning null, so the existing generic layout still renders.
import {
  getInspectionTemplateForRecord,
  listWorkRecordReadings,
  listAssetsForWorkRecord,
} from "@/lib/db/queries";
import { formatDate, titleCase } from "@/lib/utils/format";
import { PrintButton } from "./print-button";

import { AnnualInspectionForm } from "./_forms/annual-inspection";
import { AnnualInspectionAlt5Form } from "./_forms/annual-inspection-alt5";
import { AnnualInspectionLegacyForm } from "./_forms/annual-inspection-legacy";
import { BackflowForm } from "./_forms/backflow";
import { FireHydrantForm } from "./_forms/fire-hydrant";
import { FirePumpForm } from "./_forms/fire-pump";
import { RiserForm } from "./_forms/riser";
import type { FormProps } from "./_forms/types";

export const dynamic = "force-dynamic";

// Map a schema form_id to the per-form React component. The combined report
// (combined_customer_v1) is a wrapper that takes multiple per-form data sets;
// it's not dispatched from a single work record, so it isn't in this map.
const FORM_COMPONENTS: Record<string, (props: FormProps) => JSX.Element> = {
  annual_inspection_v1: AnnualInspectionForm,
  annual_inspection_legacy: AnnualInspectionLegacyForm,
  annual_inspection_alt5: AnnualInspectionAlt5Form,
  riser_v1: RiserForm,
  fire_pump_v1: FirePumpForm,
  fire_hydrant_v1: FireHydrantForm,
  backflow_v1: BackflowForm,
};

export default async function PrintableReportPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const active = await getActiveOrg();
  if (!active) redirect("/dashboard");

  const record = await getWorkRecord(active.org.id, params.id);
  if (!record) notFound();

  // Always fetch observations + versions for both the templated path and the
  // generic fallback.
  const [observations, versions] = await Promise.all([
    listObservations(record.id),
    listReportVersions(record.id),
  ]);

  // Best-effort: try to resolve a form template + readings + assets. If any of
  // these calls fail (e.g., Agent B's migrations haven't landed in this env),
  // we silently fall back to the generic layout.
  let template: Awaited<ReturnType<typeof getInspectionTemplateForRecord>> | null = null;
  let readings: Awaited<ReturnType<typeof listWorkRecordReadings>> = [];
  let assets: Awaited<ReturnType<typeof listAssetsForWorkRecord>> = [];
  try {
    template = await getInspectionTemplateForRecord(record);
    if (template) {
      [readings, assets] = await Promise.all([
        listWorkRecordReadings(record.id),
        listAssetsForWorkRecord(active.org.id, record.id),
      ]);
    }
  } catch {
    template = null;
  }

  const Renderer = template ? FORM_COMPONENTS[template.form_id] : undefined;

  if (template && Renderer) {
    return (
      <article className="space-y-6">
        <header className="flex items-start justify-between border-b border-slate-300 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4" />
            Fire Protection Compliance Copilot
          </div>
          <PrintButton />
        </header>

        <Renderer
          schema={template.schema_json}
          workRecord={record}
          observations={observations}
          readings={readings}
          assets={assets}
        />

        <footer className="mt-8 border-t border-slate-300 pt-3 text-[10px] text-slate-500 print:fixed print:bottom-4 print:left-0 print:right-0 print:px-8">
          Generated from Fire Protection Compliance Copilot · {record.reference_code ?? record.id}
        </footer>
      </article>
    );
  }

  // ----- Fallback: existing generic layout -----

  const md = (record.metadata ?? {}) as Record<string, unknown>;
  const finalized = versions.find((v) => v.kind === "finalized");

  const passes = observations.filter((o) => o.result.toLowerCase() === "pass");
  const fails = observations.filter((o) => o.result.toLowerCase() === "fail");
  const nas = observations.filter((o) => ["na", "n/a"].includes(o.result.toLowerCase()));

  return (
    <article className="space-y-8">
      <header className="flex items-start justify-between border-b border-slate-300 pb-4 print:hidden">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4" />
          Fire Protection Compliance Copilot
        </div>
        <PrintButton />
      </header>

      <section className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {active.org.name} · {titleCase(record.record_type)} report
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{record.reference_code ?? "Report"}</h1>
        <p className="text-sm text-slate-600">
          {record.customer?.name} · {record.site?.name}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 rounded-md border border-slate-300 p-4 text-sm">
        <Row label="Status">{titleCase(record.status)}</Row>
        <Row label="Visit type">{titleCase(record.record_type)}</Row>
        <Row label="Technician">{record.technician?.full_name ?? "—"}</Row>
        <Row label="Reviewer">{record.reviewer?.full_name ?? "—"}</Row>
        <Row label="Scheduled">{formatDate(record.scheduled_for, "MMM d, yyyy h:mm a")}</Row>
        <Row label="Completed">{formatDate(record.completed_at, "MMM d, yyyy h:mm a")}</Row>
        <Row label="Address">
          {[record.site?.address_line1, record.site?.city, record.site?.state, record.site?.postal_code]
            .filter(Boolean).join(", ") || "—"}
        </Row>
        <Row label="AHJ">{record.site?.ahj ?? "—"}</Row>
        <Row label="Report version">v{record.final_report_version}</Row>
        <Row label="Finalized">{formatDate(record.reviewed_at)}</Row>
      </section>

      {record.final_report ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Report narrative</h2>
          <div className="whitespace-pre-wrap rounded-md border border-slate-300 p-4 text-sm leading-relaxed">
            {record.final_report}
          </div>
          {finalized ? (
            <p className="mt-2 text-xs text-slate-500">
              Finalized version {finalized.version} on {formatDate(finalized.created_at, "PPpp")}.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-md border border-slate-300 bg-slate-50 p-4 text-sm">
          No finalized report narrative on record.
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Observations</h2>
        {observations.length === 0 ? (
          <p className="text-sm text-slate-500">No observations recorded.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <ObservationBlock title="Failed" items={fails} />
            <ObservationBlock title="Passed" items={passes} />
            <ObservationBlock title="Not applicable" items={nas} />
          </div>
        )}
      </section>

      {Object.keys(md).filter((k) => k !== "client_summary").length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Visit-specific data</h2>
          <pre className="overflow-auto rounded-md border border-slate-300 bg-slate-50 p-3 text-xs">
            {JSON.stringify(stripKnown(md), null, 2)}
          </pre>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-300 pt-4 text-xs text-slate-500">
        Generated from Fire Protection Compliance Copilot. Compliance citations must be verified by a qualified reviewer.
      </footer>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ObservationBlock({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof listObservations>>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title} ({items.length})</h3>
      <ul className="space-y-1 pl-4">
        {items.map((o) => (
          <li key={o.id}>
            {o.check_code ? <span className="font-mono text-xs">[{o.check_code}]</span> : null}{" "}
            <span>{o.description}</span>
            {o.notes ? <span className="text-slate-600"> — {o.notes}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function stripKnown(md: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(md)) if (k !== "client_summary") out[k] = md[k];
  return out;
}
