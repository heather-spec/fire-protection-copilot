"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/db/audit";
import { ActionResult, asOptional, asString, requireOrg, supa } from "./_shared";

export async function createCustomerAction(_prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const name = asString(form, "name");
  if (!name) return { ok: false, error: "Customer name is required." };

  const { data, error } = await supa()
    .from("customers")
    .insert({
      org_id: orgId,
      name,
      contact_name: asOptional(form, "contact_name"),
      contact_email: asOptional(form, "contact_email"),
      contact_phone: asOptional(form, "contact_phone"),
      billing_address: asOptional(form, "billing_address"),
      notes: asOptional(form, "notes"),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create customer." };

  await audit({ orgId, action: "create", targetTable: "customers", targetId: data.id, payload: { name } });
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomerAction(id: string, _prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const name = asString(form, "name");
  if (!name) return { ok: false, error: "Customer name is required." };

  const { error } = await supa()
    .from("customers")
    .update({
      name,
      contact_name: asOptional(form, "contact_name"),
      contact_email: asOptional(form, "contact_email"),
      contact_phone: asOptional(form, "contact_phone"),
      billing_address: asOptional(form, "billing_address"),
      notes: asOptional(form, "notes"),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  await audit({ orgId, action: "update", targetTable: "customers", targetId: id, payload: { name } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const { orgId, role } = await requireOrg();
  if (role !== "admin") throw new Error("forbidden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supa().from("customers").delete().eq("id", id).eq("org_id", orgId);
  await audit({ orgId, action: "delete", targetTable: "customers", targetId: id });
  revalidatePath("/customers");
  redirect("/customers");
}
