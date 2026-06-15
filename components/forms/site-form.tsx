"use client";

import { useFormState } from "react-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "./submit-button";
import type { Customer, Jurisdiction, Site } from "@/lib/db/types";

type Action = (prev: unknown, form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

export function SiteForm({
  action,
  customers,
  jurisdictions = [],
  initial,
  submitLabel = "Save",
}: {
  action: Action;
  customers: Pick<Customer, "id" | "name">[];
  jurisdictions?: Pick<Jurisdiction, "id" | "name" | "state" | "jurisdiction_type">[];
  initial?: Partial<Site>;
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
        </Field>
        <Field label="Customer" htmlFor="customer_id" required>
          <Select id="customer_id" name="customer_id" defaultValue={initial?.customer_id ?? ""} required>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" htmlFor="address_line1">
          <Input id="address_line1" name="address_line1" defaultValue={initial?.address_line1 ?? ""} />
        </Field>
        <Field label="Address line 2" htmlFor="address_line2">
          <Input id="address_line2" name="address_line2" defaultValue={initial?.address_line2 ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
        </Field>
        <Field label="State" htmlFor="state">
          <Input id="state" name="state" defaultValue={initial?.state ?? ""} />
        </Field>
        <Field label="Postal code" htmlFor="postal_code">
          <Input id="postal_code" name="postal_code" defaultValue={initial?.postal_code ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Occupancy type" htmlFor="occupancy_type" hint="e.g. Business B, Storage S-1">
          <Input id="occupancy_type" name="occupancy_type" defaultValue={initial?.occupancy_type ?? ""} />
        </Field>
        <Field label="Square footage" htmlFor="square_footage">
          <Input id="square_footage" name="square_footage" type="number" defaultValue={initial?.square_footage ?? ""} />
        </Field>
        <Field
          label="Jurisdiction (AHJ)"
          htmlFor="jurisdiction_id"
          hint="Determines which code citations apply"
        >
          <Select
            id="jurisdiction_id"
            name="jurisdiction_id"
            defaultValue={initial?.jurisdiction_id ?? ""}
          >
            <option value="">— none —</option>
            {jurisdictions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.state} · {j.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="AHJ contact / notes" htmlFor="ahj" hint="Free-text name if no jurisdiction matches — kept for back-compat">
        <Input id="ahj" name="ahj" defaultValue={initial?.ahj ?? ""} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} rows={3} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
