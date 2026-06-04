import { Badge } from "@/components/ui/badge";
import type { DeficiencySeverity, DeficiencyStatus, WorkRecordStatus } from "@/lib/db/types";

const workStatus: Record<WorkRecordStatus, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  draft:              { label: "Draft",       variant: "outline" },
  submitted:          { label: "Submitted",   variant: "warning" },
  in_review:          { label: "In review",   variant: "warning" },
  revision_requested: { label: "Revision",    variant: "warning" },
  approved:           { label: "Approved",    variant: "success" },
  rejected:           { label: "Rejected",    variant: "destructive" },
};

export function WorkStatusBadge({ status }: { status: WorkRecordStatus }) {
  const s = workStatus[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const defStatus: Record<DeficiencyStatus, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  open:         { label: "Open",        variant: "destructive" },
  in_progress:  { label: "In progress", variant: "warning" },
  resolved:     { label: "Resolved",    variant: "success" },
  wont_fix:     { label: "Won't fix",   variant: "outline" },
};

export function DeficiencyStatusBadge({ status }: { status: DeficiencyStatus }) {
  const s = defStatus[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const sev: Record<DeficiencySeverity, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  critical: { label: "Critical", variant: "destructive" },
  major:    { label: "Major",    variant: "warning" },
  minor:    { label: "Minor",    variant: "secondary" },
  advisory: { label: "Advisory", variant: "outline" },
};

export function SeverityBadge({ severity }: { severity: DeficiencySeverity }) {
  const s = sev[severity];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
