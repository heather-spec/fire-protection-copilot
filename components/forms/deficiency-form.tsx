"use client";

import { useFormState } from "react-dom";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "./submit-button";
import type { Deficiency, Site } from "@/lib/db/types";

type Action = (prev: unknown, form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

interface OrgMemberLite {
  profile: { id: string; full_name: string | null };
}

export function DeficiencyForm({
  action,
  sites,
  members,
  initial,
  defaultSiteId,
  defaultWorkRecordId,
  submitLabel = "Save",
}: {
  action: Action;
  sites: Pick<Site, "id" | "name">[];
  members: OrgMemberLite[];
  initial?: Partial<Deficiency>;
  defaultSiteId?: string;
  defaultWorkRecordId?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="grid gap-4">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input type="hidden" name="work_record_id" value={initial?.work_record_id ?? defaultWorkRecordId ?? ""} />

      <Field label="Title" htmlFor="title" required>
        <Input id="title" name="title" defaultValue={initial?.title ?? ""} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Site" htmlFor="site_id" required>
          <Select id="site_id" name="site_id" defaultValue={initial?.site_id ?? defaultSiteId ?? ""} required>
            <option value="">Select site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Severity" htmlFor="severity" required>
          <Select id="severity" name="severity" defaultValue={initial?.severity ?? "minor"} required>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="advisory">Advisory</option>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority" required>
          <Select id="priority" name="priority" defaultValue={initial?.priority ?? "normal"} required>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={4} defaultValue={initial?.description ?? ""} />
      </Field>

      <Field label="Recommended corrective action" htmlFor="recommended_action">
        <Textarea
          id="recommended_action"
          name="recommended_action"
          rows={3}
          defaultValue={initial?.recommended_action ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code reference" htmlFor="code_reference" hint="e.g. NFPA 25 8.3.2.4">
          <Input id="code_reference" name="code_reference" defaultValue={initial?.code_reference ?? ""} />
        </Field>
        <Field label="Due date" htmlFor="due_date">
          <Input id="due_date" name="due_date" type="date" defaultValue={initial?.due_date ?? ""} />
        </Field>
        <Field label="Assigned to" htmlFor="assigned_to">
          <Select id="assigned_to" name="assigned_to" defaultValue={initial?.assigned_to ?? ""}>
            <option value="">— unassigned —</option>
            {members.map((m) => (
              <option key={m.profile.id} value={m.profile.id}>
                {m.profile.full_name ?? m.profile.id}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
