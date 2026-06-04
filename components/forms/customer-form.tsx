"use client";

import { useFormState } from "react-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "./submit-button";
import type { Customer } from "@/lib/db/types";

type Action = (prev: unknown, form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

export function CustomerForm({
  action,
  initial,
  submitLabel = "Save",
}: {
  action: Action;
  initial?: Partial<Customer>;
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
      <Field label="Customer name" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary contact" htmlFor="contact_name">
          <Input id="contact_name" name="contact_name" defaultValue={initial?.contact_name ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="contact_phone">
          <Input id="contact_phone" name="contact_phone" defaultValue={initial?.contact_phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="contact_email">
          <Input id="contact_email" name="contact_email" type="email" defaultValue={initial?.contact_email ?? ""} />
        </Field>
        <Field label="Billing address" htmlFor="billing_address">
          <Input id="billing_address" name="billing_address" defaultValue={initial?.billing_address ?? ""} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} rows={3} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
