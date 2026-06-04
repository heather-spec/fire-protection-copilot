// Hand-authored Database types for Supabase.
// In phase 2 these will be replaced by `supabase gen types typescript`.

export type UserRole = "admin" | "technician" | "reviewer";

export type WorkRecordType =
  | "inspection"
  | "test"
  | "maintenance"
  | "service_call"
  | "deficiency_followup"
  | "impairment"
  | "fire_watch";

export type WorkRecordStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "revision_requested"
  | "approved"
  | "rejected";

export type DeficiencyPriority = "urgent" | "high" | "normal" | "low";

export type ReportVersionKind = "ai_draft" | "reviewer_edit" | "finalized";

export type AssetType =
  | "sprinkler_system"
  | "fire_alarm_panel"
  | "fire_pump"
  | "standpipe"
  | "extinguisher"
  | "kitchen_hood"
  | "emergency_lighting"
  | "backflow_preventer"
  | "hydrant"
  | "smoke_detector"
  | "heat_detector"
  | "co_detector"
  | "other";

export type DeficiencySeverity = "critical" | "major" | "minor" | "advisory";
export type DeficiencyStatus = "open" | "in_progress" | "resolved" | "wont_fix";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  org_id: string;
  profile_id: string;
  role: UserRole;
  created_at: string;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  org_id: string;
  customer_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  occupancy_type: string | null;
  square_footage: number | null;
  ahj: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  org_id: string;
  site_id: string;
  asset_type: AssetType;
  identifier: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  installed_on: string | null;
  last_serviced_on: string | null;
  location_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkRecord {
  id: string;
  org_id: string;
  site_id: string;
  customer_id: string;
  record_type: WorkRecordType;
  status: WorkRecordStatus;
  reference_code: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  technician_id: string | null;
  reviewer_id: string | null;
  summary: string | null;
  notes: string | null;
  voice_transcript: string | null;
  final_report: string | null;
  latest_ai_draft_id: string | null;
  final_report_version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface WorkRecordObservation {
  id: string;
  org_id: string;
  work_record_id: string;
  asset_id: string | null;
  check_code: string | null;
  description: string;
  result: string;
  notes: string | null;
  created_at: string;
}

export interface Deficiency {
  id: string;
  org_id: string;
  site_id: string;
  work_record_id: string | null;
  asset_id: string | null;
  observation_id: string | null;
  severity: DeficiencySeverity;
  status: DeficiencyStatus;
  priority: DeficiencyPriority;
  title: string;
  description: string | null;
  code_reference: string | null;
  recommended_action: string | null;
  due_date: string | null;
  discovered_on: string;
  resolved_on: string | null;
  estimated_cost: number | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeficiencyUpdate {
  id: string;
  org_id: string;
  deficiency_id: string;
  author_id: string | null;
  body: string;
  from_status: DeficiencyStatus | null;
  to_status: DeficiencyStatus | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  org_id: string;
  related_table: string;
  related_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SiteContact {
  id: string;
  org_id: string;
  site_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface ReportVersion {
  id: string;
  org_id: string;
  work_record_id: string;
  version: number;
  kind: ReportVersionKind;
  content: string;
  author_id: string | null;
  ai_generation_id: string | null;
  created_at: string;
}

export interface AiGeneration {
  id: string;
  org_id: string;
  target_table: string;
  target_id: string;
  kind: string;
  provider: string;
  model: string;
  prompt: string;
  input_snapshot: Record<string, unknown>;
  output: string;
  status: string;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

// ----- Database shape for typed supabase-js client -----

// Row is strongly typed for reads (we get typed query results).
// Insert/Update are intentionally loose: supabase-js Json constraints
// would reject `metadata: Record<string, unknown>` otherwise, and at MVP
// we validate at the SQL + RLS layer rather than at the type layer.
type Row<T> = {
  Row: T;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      organizations: Row<Organization>;
      profiles: Row<Profile>;
      memberships: Row<Membership>;
      customers: Row<Customer>;
      sites: Row<Site>;
      assets: Row<Asset>;
      work_records: Row<WorkRecord>;
      work_record_observations: Row<WorkRecordObservation>;
      deficiencies: Row<Deficiency>;
      deficiency_updates: Row<DeficiencyUpdate>;
      attachments: Row<Attachment>;
      audit_logs: Row<AuditLog>;
      site_contacts: Row<SiteContact>;
      report_versions: Row<ReportVersion>;
      ai_generations: Row<AiGeneration>;
    };
    Enums: {
      user_role: UserRole;
      work_record_type: WorkRecordType;
      work_record_status: WorkRecordStatus;
      asset_type: AssetType;
      deficiency_severity: DeficiencySeverity;
      deficiency_status: DeficiencyStatus;
      deficiency_priority: DeficiencyPriority;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
