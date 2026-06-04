"use client";

import { useFormState } from "react-dom";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "./submit-button";
import type {
  Customer,
  Site,
  WorkRecord,
  WorkRecordType,
} from "@/lib/db/types";
import { titleCase } from "@/lib/utils/format";

type Action = (prev: unknown, form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

const TYPES: { value: WorkRecordType; label: string; hint: string }[] = [
  { value: "inspection", label: "Inspection", hint: "Routine inspection of one or more systems" },
  { value: "test", label: "Testing", hint: "Functional or performance test (e.g., fire pump flow)" },
  { value: "maintenance", label: "Maintenance", hint: "Preventive or corrective maintenance" },
  { value: "service_call", label: "Service call", hint: "Customer-reported issue, troubleshoot + fix" },
  { value: "deficiency_followup", label: "Deficiency follow-up", hint: "Return visit to address a known deficiency" },
  { value: "impairment", label: "Impairment", hint: "System out of service; planned or emergency" },
  { value: "fire_watch", label: "Fire watch", hint: "Continuous watch during impairment" },
];

export function WorkRecordForm({
  action,
  customers,
  sites,
  initial,
  defaultCustomerId,
  defaultSiteId,
  submitLabel = "Save",
}: {
  action: Action;
  customers: Pick<Customer, "id" | "name">[];
  sites: Array<Pick<Site, "id" | "name" | "customer_id">>;
  initial?: Partial<WorkRecord>;
  defaultCustomerId?: string;
  defaultSiteId?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const [customerId, setCustomerId] = useState(
    initial?.customer_id ?? defaultCustomerId ?? customers[0]?.id ?? "",
  );
  const [type, setType] = useState<WorkRecordType>(
    (initial?.record_type as WorkRecordType) ?? "inspection",
  );

  const filteredSites = useMemo(
    () => sites.filter((s) => !customerId || s.customer_id === customerId),
    [sites, customerId],
  );

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Visit type" htmlFor="record_type" required>
          <Select
            id="record_type"
            name="record_type"
            value={type}
            onChange={(e) => setType(e.target.value as WorkRecordType)}
            required
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Scheduled for" htmlFor="scheduled_for">
          <Input
            id="scheduled_for"
            name="scheduled_for"
            type="datetime-local"
            defaultValue={toLocalInput(initial?.scheduled_for ?? null)}
          />
        </Field>
        <Field label="Customer" htmlFor="customer_id" required>
          <Select
            id="customer_id"
            name="customer_id"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Site" htmlFor="site_id" required>
          <Select
            id="site_id"
            name="site_id"
            defaultValue={initial?.site_id ?? defaultSiteId ?? ""}
            required
          >
            <option value="">Select site…</option>
            {filteredSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-4">
        <Field label="Field summary" htmlFor="summary" hint="One-line description of the visit.">
          <Input id="summary" name="summary" defaultValue={initial?.summary ?? ""} />
        </Field>
        <Field label="Technician notes" htmlFor="notes" hint="Raw notes — the source of truth. Do not edit AI drafts here.">
          <Textarea
            id="notes"
            name="notes"
            rows={5}
            defaultValue={initial?.notes ?? ""}
            placeholder="What you observed in the field, what you did, what you noticed."
          />
        </Field>
        <Field
          label="Voice transcript (paste)"
          htmlFor="voice_transcript"
          hint="Future: live voice-to-text. For now, paste a transcript here."
        >
          <Textarea
            id="voice_transcript"
            name="voice_transcript"
            rows={3}
            defaultValue={initial?.voice_transcript ?? ""}
          />
        </Field>
      </section>

      <TypeSpecificFields type={type} initial={initial} />

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

function TypeSpecificFields({
  type,
  initial,
}: {
  type: WorkRecordType;
  initial?: Partial<WorkRecord>;
}) {
  const md = (initial?.metadata ?? {}) as Record<string, unknown>;
  const v = (k: string) => (typeof md[k] === "string" ? (md[k] as string) : "");

  if (type === "inspection" || type === "test" || type === "maintenance") {
    return (
      <Card title={`${titleCase(type)} details`}>
        <p className="text-sm text-muted-foreground">
          Add inspected items as <strong>observations</strong> on the work record detail page after saving.
          Each observation captures the asset (optional), pass/fail/N-A, NFPA code reference, and notes.
        </p>
      </Card>
    );
  }
  if (type === "service_call") {
    return (
      <Card title="Service call details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Issue reported" htmlFor="md_issue_reported">
            <Input id="md_issue_reported" name="md_issue_reported" defaultValue={v("issue_reported")} />
          </Field>
          <Field label="Resolution" htmlFor="md_resolution">
            <Input id="md_resolution" name="md_resolution" defaultValue={v("resolution")} />
          </Field>
          <Field label="Action taken" htmlFor="md_action_taken" className="sm:col-span-2">
            <Textarea id="md_action_taken" name="md_action_taken" rows={3} defaultValue={v("action_taken")} />
          </Field>
          <Field label="Parts used" htmlFor="md_parts_used" className="sm:col-span-2">
            <Input id="md_parts_used" name="md_parts_used" defaultValue={v("parts_used")} placeholder="e.g. 1× pressure gauge, 2× sprinkler escutcheons" />
          </Field>
        </div>
      </Card>
    );
  }
  if (type === "deficiency_followup") {
    return (
      <Card title="Deficiency follow-up details">
        <div className="grid gap-4">
          <Field label="What was addressed" htmlFor="md_addressed">
            <Textarea id="md_addressed" name="md_addressed" rows={3} defaultValue={v("addressed")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Result" htmlFor="md_result">
              <Input id="md_result" name="md_result" defaultValue={v("result")} placeholder="Resolved / Partially / Still open" />
            </Field>
            <Field label="Remaining issues" htmlFor="md_remaining">
              <Input id="md_remaining" name="md_remaining" defaultValue={v("remaining")} />
            </Field>
          </div>
        </div>
      </Card>
    );
  }
  if (type === "impairment") {
    return (
      <Card title="Impairment details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Impairment type" htmlFor="md_impairment_type">
            <Select id="md_impairment_type" name="md_impairment_type" defaultValue={v("impairment_type") || "planned"}>
              <option value="planned">Planned</option>
              <option value="emergency">Emergency</option>
            </Select>
          </Field>
          <Field label="System out of service" htmlFor="md_system_out">
            <Input id="md_system_out" name="md_system_out" defaultValue={v("system_out")} placeholder="e.g. ESFR-C" />
          </Field>
          <Field label="Start (date/time)" htmlFor="md_start">
            <Input id="md_start" name="md_start" type="datetime-local" defaultValue={toLocalInput(v("start"))} />
          </Field>
          <Field label="Expected end" htmlFor="md_expected_end">
            <Input id="md_expected_end" name="md_expected_end" type="datetime-local" defaultValue={toLocalInput(v("expected_end"))} />
          </Field>
          <Field label="Mitigation steps" htmlFor="md_mitigation_steps" className="sm:col-span-2">
            <Textarea id="md_mitigation_steps" name="md_mitigation_steps" rows={3} defaultValue={v("mitigation_steps")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="md_ahj_notified" defaultChecked={md["ahj_notified"] === true} value="on" />
            AHJ notified
          </label>
        </div>
      </Card>
    );
  }
  if (type === "fire_watch") {
    return (
      <Card title="Fire watch details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interval (minutes)" htmlFor="md_interval_minutes">
            <Input id="md_interval_minutes" name="md_interval_minutes" type="number" defaultValue={String(md["interval_minutes"] ?? 60)} />
          </Field>
          <Field label="Rounds logged" htmlFor="md_rounds_logged">
            <Input id="md_rounds_logged" name="md_rounds_logged" type="number" defaultValue={String(md["rounds_logged"] ?? 0)} />
          </Field>
          <Field label="Related impairment (ref)" htmlFor="md_related_impairment" className="sm:col-span-2">
            <Input id="md_related_impairment" name="md_related_impairment" defaultValue={v("related_impairment")} placeholder="IMP-2026-####" />
          </Field>
          <Field label="Incidents observed" htmlFor="md_incidents" className="sm:col-span-2">
            <Textarea id="md_incidents" name="md_incidents" rows={3} defaultValue={v("incidents")} />
          </Field>
        </div>
      </Card>
    );
  }
  return null;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
