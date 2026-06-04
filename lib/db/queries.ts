import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Asset,
  Customer,
  Deficiency,
  DeficiencyUpdate,
  Membership,
  Organization,
  Profile,
  ReportVersion,
  Site,
  SiteContact,
  UserRole,
  WorkRecord,
  WorkRecordObservation,
} from "@/lib/db/types";

/**
 * Server-side data access.
 *
 * Every query relies on Supabase RLS to filter by the caller's
 * org memberships. We *also* defensively pass org_id where we know it
 * to keep queries fast and explicit.
 */

export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  return data ?? null;
}

export interface MembershipWithOrg extends Membership {
  organization: Organization;
}

export async function getMyMemberships(): Promise<MembershipWithOrg[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("*, organization:organizations(*)")
    .order("created_at", { ascending: true });
  return (data ?? []) as MembershipWithOrg[];
}

/**
 * Resolve the active organization. MVP rule: first membership wins;
 * later replaced by a cookie-pinned org switcher.
 */
export async function getActiveOrg(): Promise<{
  org: Organization;
  role: UserRole;
} | null> {
  const memberships = await getMyMemberships();
  if (memberships.length === 0) return null;
  const first = memberships[0];
  return { org: first.organization, role: first.role };
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

export async function getSite(orgId: string, id: string): Promise<(Site & { customer: Customer | null }) | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("sites")
    .select("*, customer:customers(*)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return (data as (Site & { customer: Customer | null }) | null) ?? null;
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
