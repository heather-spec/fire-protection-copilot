import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDemoIdentity } from "@/lib/demo/identity";
import type {
  Asset,
  CodeAmendment,
  Customer,
  Deficiency,
  DeficiencyUpdate,
  InspectionTemplate,
  Jurisdiction,
  Membership,
  Organization,
  Profile,
  ReportVersion,
  Site,
  SiteContact,
  UserRole,
  WorkRecord,
  WorkRecordObservation,
  WorkRecordReading,
} from "@/lib/db/types";

/**
 * Server-side data access.
 *
 * Every query relies on Supabase RLS to filter by the caller's
 * org memberships. We *also* defensively pass org_id where we know it
 * to keep queries fast and explicit.
 */

// ---------- DEMO MODE — auth is disabled ----------
// These functions return the demo identity defined in lib/demo/identity.ts.
// The "role" comes from the demo_role cookie (admin/reviewer/technician)
// and updates instantly when the topbar role switcher sets it.

export async function getCurrentUser() {
  const { user } = await getDemoIdentity();
  // Shape-compatible enough with supabase.auth.User for our usage
  return { id: user.id, email: user.email } as { id: string; email: string };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { profile } = await getDemoIdentity();
  return profile;
}

export interface MembershipWithOrg extends Membership {
  organization: Organization;
}

export async function getMyMemberships(): Promise<MembershipWithOrg[]> {
  const { org, user, role } = await getDemoIdentity();
  return [
    {
      id: `demo-${role}`,
      org_id: org.id,
      profile_id: user.id,
      role,
      created_at: new Date().toISOString(),
      organization: org,
    },
  ];
}

export async function getActiveOrg(): Promise<{
  org: Organization;
  role: UserRole;
} | null> {
  const { org, role } = await getDemoIdentity();
  return { org, role };
}

// ---------- list queries ----------

export async function listCustomers(orgId: string): Promise<Customer[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  return data ?? [];
}

export interface SiteWithCustomer extends Site {
  customer: Pick<Customer, "id" | "name"> | null;
}

export async function listSites(orgId: string): Promise<SiteWithCustomer[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("sites")
    .select("*, customer:customers(id,name)")
    .eq("org_id", orgId)
    .order("name");
  return (data ?? []) as SiteWithCustomer[];
}

export interface WorkRecordWithRefs extends WorkRecord {
  site: Pick<Site, "id" | "name"> | null;
  customer: Pick<Customer, "id" | "name"> | null;
  technician: Pick<Profile, "id" | "full_name"> | null;
  reviewer: Pick<Profile, "id" | "full_name"> | null;
}

export async function listWorkRecords(orgId: string, limit = 100): Promise<WorkRecordWithRefs[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("work_records")
    .select(`
      *,
      site:sites(id,name),
      customer:customers(id,name),
      technician:profiles!work_records_technician_id_fkey(id,full_name),
      reviewer:profiles!work_records_reviewer_id_fkey(id,full_name)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as WorkRecordWithRefs[];
}

export interface DeficiencyWithSite extends Deficiency {
  site: Pick<Site, "id" | "name"> | null;
  assignee: Pick<Profile, "id" | "full_name"> | null;
}

export async function listDeficiencies(orgId: string, limit = 100): Promise<DeficiencyWithSite[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("deficiencies")
    .select(`
      *,
      site:sites(id,name),
      assignee:profiles!deficiencies_assigned_to_fkey(id,full_name)
    `)
    .eq("org_id", orgId)
    .order("discovered_on", { ascending: false })
    .limit(limit);
  return (data ?? []) as DeficiencyWithSite[];
}

// ---------- dashboard metrics ----------

export interface DashboardMetrics {
  openDeficiencies: number;
  reportsPendingReview: number;
  recentImpairments: number;
  visitsThisWeek: number;
  fireWatchEntries: number;
}

export async function getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
  const supabase = createSupabaseServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [openDef, pending, impair, visits, fw] = await Promise.all([
    supabase
      .from("deficiencies")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("work_records")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["submitted", "in_review"]),
    supabase
      .from("work_records")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("record_type", "impairment")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("work_records")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("work_records")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("record_type", "fire_watch"),
  ]);

  return {
    openDeficiencies: openDef.count ?? 0,
    reportsPendingReview: pending.count ?? 0,
    recentImpairments: impair.count ?? 0,
    visitsThisWeek: visits.count ?? 0,
    fireWatchEntries: fw.count ?? 0,
  };
}

// ---------- org members (settings page) ----------

export interface OrgMember {
  membership_id: string;
  role: UserRole;
  profile: Profile;
}

// ---------- detail queries ----------

export async function getCustomer(orgId: string, id: string): Promise<Customer | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function listSitesForCustomer(orgId: string, customerId: string): Promise<Site[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("sites")
    .select("*")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("name");
  return data ?? [];
}

export async function getSite(
  orgId: string,
  id: string,
): Promise<
  | (Site & { customer: Customer | null; jurisdiction: Jurisdiction | null })
  | null
> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("sites")
    .select("*, customer:customers(*), jurisdiction:jurisdictions(*)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return (data as (Site & { customer: Customer | null; jurisdiction: Jurisdiction | null }) | null) ?? null;
}

// ---------- jurisdictions (reference data, global) ----------

export async function listJurisdictions(): Promise<Jurisdiction[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("jurisdictions")
    .select("*")
    .order("state")
    .order("jurisdiction_type", { ascending: false }) // state, then city
    .order("name");
  return (data ?? []) as Jurisdiction[];
}

export async function getJurisdiction(id: string): Promise<Jurisdiction | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("jurisdictions").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as Jurisdiction | null;
}

export async function listAmendmentsForJurisdiction(
  jurisdictionId: string,
): Promise<CodeAmendment[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("code_amendments")
    .select("*")
    .eq("jurisdiction_id", jurisdictionId)
    .order("source_ref");
  return (data ?? []) as CodeAmendment[];
}

/**
 * For a given source NFPA reference (e.g. "NFPA 25 8.3.2.4") return the
 * local citation for the site's jurisdiction, if any. Walks up parent_id
 * so a city AHJ inherits its state's amendments unless overridden.
 */
export async function resolveLocalCitation(
  jurisdictionId: string | null,
  sourceRef: string,
): Promise<{ localRef: string | null; frequencyOverride: string | null }> {
  if (!jurisdictionId) return { localRef: null, frequencyOverride: null };
  const supabase = createSupabaseServerClient();

  // build the chain: current jurisdiction → parent → grandparent…
  const ids: string[] = [];
  let nextId: string | null = jurisdictionId;
  for (let i = 0; nextId && i < 5; i++) {
    const here: string = nextId;
    ids.push(here);
    const lookup: { data: { parent_id: string | null } | null } =
      await supabase.from("jurisdictions").select("parent_id").eq("id", here).maybeSingle();
    nextId = lookup.data?.parent_id ?? null;
  }

  const { data: amendments } = await supabase
    .from("code_amendments")
    .select("*")
    .in("jurisdiction_id", ids)
    .eq("source_ref", sourceRef);

  const rows = (amendments ?? []) as Array<CodeAmendment>;
  // Prefer the most-specific (lowest in the chain — earliest in ids[]).
  for (const id of ids) {
    const hit = rows.find((a) => a.jurisdiction_id === id);
    if (hit) return { localRef: hit.local_ref, frequencyOverride: hit.frequency_override };
  }
  return { localRef: null, frequencyOverride: null };
}

export async function listSiteContacts(orgId: string, siteId: string): Promise<SiteContact[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("site_contacts")
    .select("*")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .order("is_primary", { ascending: false })
    .order("name");
  return data ?? [];
}

export async function listAssetsForSite(orgId: string, siteId: string): Promise<Asset[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .order("identifier");
  return data ?? [];
}

export async function listWorkRecordsForSite(orgId: string, siteId: string): Promise<WorkRecordWithRefs[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("work_records")
    .select(`
      *,
      site:sites(id,name),
      customer:customers(id,name),
      technician:profiles!work_records_technician_id_fkey(id,full_name),
      reviewer:profiles!work_records_reviewer_id_fkey(id,full_name)
    `)
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  return (data ?? []) as WorkRecordWithRefs[];
}

export async function listDeficienciesForSite(orgId: string, siteId: string): Promise<DeficiencyWithSite[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("deficiencies")
    .select(`
      *,
      site:sites(id,name),
      assignee:profiles!deficiencies_assigned_to_fkey(id,full_name)
    `)
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .order("discovered_on", { ascending: false });
  return (data ?? []) as DeficiencyWithSite[];
}

export interface WorkRecordDetail extends WorkRecord {
  site: Site | null;
  customer: Customer | null;
  technician: Pick<Profile, "id" | "full_name" | "email"> | null;
  reviewer: Pick<Profile, "id" | "full_name" | "email"> | null;
}

export async function getWorkRecord(orgId: string, id: string): Promise<WorkRecordDetail | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("work_records")
    .select(`
      *,
      site:sites(*),
      customer:customers(*),
      technician:profiles!work_records_technician_id_fkey(id,full_name,email),
      reviewer:profiles!work_records_reviewer_id_fkey(id,full_name,email)
    `)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as WorkRecordDetail | null) ?? null;
}

export async function listObservations(workRecordId: string): Promise<WorkRecordObservation[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("work_record_observations")
    .select("*")
    .eq("work_record_id", workRecordId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function listReportVersions(workRecordId: string): Promise<ReportVersion[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("report_versions")
    .select("*")
    .eq("work_record_id", workRecordId)
    .order("version", { ascending: false });
  return data ?? [];
}

export interface DeficiencyDetail extends Deficiency {
  site: Pick<Site, "id" | "name"> | null;
  asset: { id: string; identifier: string | null; asset_type: string } | null;
  work_record: { id: string; reference_code: string | null; record_type: string } | null;
  assignee: Pick<Profile, "id" | "full_name"> | null;
}

export async function getDeficiency(orgId: string, id: string): Promise<DeficiencyDetail | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("deficiencies")
    .select(`
      *,
      site:sites(id,name),
      asset:assets(id,identifier,asset_type),
      work_record:work_records(id,reference_code,record_type),
      assignee:profiles!deficiencies_assigned_to_fkey(id,full_name)
    `)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as DeficiencyDetail | null) ?? null;
}

export async function listDeficiencyUpdates(deficiencyId: string): Promise<DeficiencyUpdate[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("deficiency_updates")
    .select("*")
    .eq("deficiency_id", deficiencyId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("id, role, profile:profiles(*)")
    .eq("org_id", orgId);
  return ((data ?? []) as Array<{ id: string; role: UserRole; profile: Profile }>).map((m) => ({
    membership_id: m.id,
    role: m.role,
    profile: m.profile,
  }));
}

// ---------- inspection templates (migration 0005) ----------

/**
 * All active inspection_templates rows. Global reference data — no org
 * filter. The full JSON schema lives in schema_json on each row.
 */
export async function listInspectionTemplates(): Promise<InspectionTemplate[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("inspection_templates")
    .select("*")
    .eq("is_active", true)
    .order("form_name");
  return (data ?? []) as InspectionTemplate[];
}

/**
 * Fetch one template by form_id (e.g. "backflow_v1"). Returns null if no
 * row exists, which is the contract callers expect when the form_id is
 * unknown or not yet seeded.
 */
export async function getInspectionTemplate(
  formId: string,
): Promise<InspectionTemplate | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("inspection_templates")
    .select("*")
    .eq("form_id", formId)
    .maybeSingle();
  return (data as InspectionTemplate | null) ?? null;
}

/**
 * All numeric readings captured for a work record (PSI, GPM, RPM, etc.).
 * Returned in capture order so the print template and completeness
 * checker walk readings the same way the inspector wrote them.
 */
export async function listReadingsForRecord(
  workRecordId: string,
): Promise<WorkRecordReading[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("work_record_readings")
    .select("*")
    .eq("work_record_id", workRecordId)
    .order("created_at", { ascending: true });
  return (data ?? []) as WorkRecordReading[];
}

// ---------- name-bridging adapters for the print dispatcher (Agent C) ----------
// Agent C's print page imports `getInspectionTemplateForRecord`,
// `listWorkRecordReadings`, and `listAssetsForWorkRecord`. Agent B published
// these as `getInspectionTemplate`/`listReadingsForRecord`/`listAssetsForSite`.
// Rather than rewrite either side, the orchestrator publishes the missing
// adapter names here.

export async function getInspectionTemplateForRecord(
  record: { template_form_id: string | null },
): Promise<InspectionTemplate | null> {
  if (!record.template_form_id) return null;
  return getInspectionTemplate(record.template_form_id);
}

export const listWorkRecordReadings = listReadingsForRecord;

/**
 * The print page wants assets for a given work record. We look up the
 * record's site_id and return that site's assets. (When per-record asset
 * pinning lands later, this query gets narrower.)
 */
export async function listAssetsForWorkRecord(
  orgId: string,
  workRecordId: string,
): Promise<Asset[]> {
  const supabase = createSupabaseServerClient();
  const { data: rec } = await supabase
    .from("work_records")
    .select("site_id")
    .eq("id", workRecordId)
    .eq("org_id", orgId)
    .maybeSingle();
  const siteId = (rec as { site_id: string } | null)?.site_id;
  if (!siteId) return [];
  return listAssetsForSite(orgId, siteId);
}
