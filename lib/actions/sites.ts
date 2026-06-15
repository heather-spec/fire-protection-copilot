"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/db/audit";
import {
  ActionResult,
  asBool,
  asInt,
  asOptional,
  asString,
  requireOrg,
  supa,
} from "./_shared";

export async function createSiteAction(_prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const name = asString(form, "name");
  const customer_id = asString(form, "customer_id");
  if (!name) return { ok: false, error: "Site name is required." };
  if (!customer_id) return { ok: false, error: "Customer is required." };

  const { data, error } = await supa()
    .from("sites")
    .insert({
      org_id: orgId,
      customer_id,
      name,
      address_line1: asOptional(form, "address_line1"),
      address_line2: asOptional(form, "address_line2"),
      city: asOptional(form, "city"),
      state: asOptional(form, "state"),
      postal_code: asOptional(form, "postal_code"),
      occupancy_type: asOptional(form, "occupancy_type"),
      square_footage: asInt(form, "square_footage"),
      ahj: asOptional(form, "ahj"),
      jurisdiction_id: asOptional(form, "jurisdiction_id"),
      notes: asOptional(form, "notes"),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create site." };

  await audit({ orgId, action: "create", targetTable: "sites", targetId: data.id, payload: { name } });
  revalidatePath("/sites");
  redirect(`/sites/${data.id}`);
}

export async function updateSiteAction(id: string, _prev: unknown, form: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const name = asString(form, "name");
  const customer_id = asString(form, "customer_id");
  if (!name) return { ok: false, error: "Site name is required." };
  if (!customer_id) return { ok: false, error: "Customer is required." };

  const { error } = await supa()
    .from("sites")
    .update({
      customer_id,
      name,
      address_line1: asOptional(form, "address_line1"),
      address_line2: asOptional(form, "address_line2"),
      city: asOptional(form, "city"),
      state: asOptional(form, "state"),
      postal_code: asOptional(form, "postal_code"),
      occupancy_type: asOptional(form, "occupancy_type"),
      square_footage: asInt(form, "square_footage"),
      ahj: asOptional(form, "ahj"),
      jurisdiction_id: asOptional(form, "jurisdiction_id"),
      notes: asOptional(form, "notes"),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  await audit({ orgId, action: "update", targetTable: "sites", targetId: id, payload: { name } });
  revalidatePath("/sites");
  revalidatePath(`/sites/${id}`);
  redirect(`/sites/${id}`);
}

export async function deleteSiteAction(formData: FormData): Promise<void> {
  const { orgId, role } = await requireOrg();
  if (role !== "admin") throw new Error("forbidden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supa().from("sites").delete().eq("id", id).eq("org_id", orgId);
  await audit({ orgId, action: "delete", targetTable: "sites", targetId: id });
  revalidatePath("/sites");
  redirect("/sites");
}

export async function addSiteContactAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const site_id = String(formData.get("site_id") ?? "");
  const name = asString(formData, "name");
  if (!site_id || !name) return;

  const { data } = await supa()
    .from("site_contacts")
    .insert({
      org_id: orgId,
      site_id,
      name,
      role: asOptional(formData, "role"),
      email: asOptional(formData, "email"),
      phone: asOptional(formData, "phone"),
      is_primary: asBool(formData, "is_primary"),
      notes: asOptional(formData, "notes"),
    })
    .select("id")
    .single();

  await audit({
    orgId,
    action: "create",
    targetTable: "site_contacts",
    targetId: data?.id ?? null,
    payload: { site_id, name },
  });
  revalidatePath(`/sites/${site_id}`);
}

export async function removeSiteContactAction(formData: FormData): Promise<void> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const site_id = String(formData.get("site_id") ?? "");
  if (!id) return;
  await supa().from("site_contacts").delete().eq("id", id).eq("org_id", orgId);
  await audit({ orgId, action: "delete", targetTable: "site_contacts", targetId: id });
  if (site_id) revalidatePath(`/sites/${site_id}`);
}
