import Link from "next/link";
import {
  AlertOctagon,
  ClipboardCheck,
  ShieldAlert,
  Calendar,
  Flame,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WorkStatusBadge,
  DeficiencyStatusBadge,
  SeverityBadge,
} from "@/components/dashboard/status-pill";
import {
  getActiveOrg,
  getDashboardMetrics,
  listDeficiencies,
  listWorkRecords,
} from "@/lib/db/queries";
import { formatRelative, titleCase } from "@/lib/utils/format";

export default async function DashboardPage() {
  const active = await getActiveOrg();
  if (!active) return null;
  const orgId = active.org.id;

  const [metrics, records, defs] = await Promise.all([
    getDashboardMetrics(orgId),
    listWorkRecords(orgId, 6),
    listDeficiencies(orgId, 6),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Compliance dashboard"
        description={`Operational snapshot for ${active.org.name}.`}
        actions={
          <Link href="/work-records/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New work record
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Open deficiencies"
          value={metrics.openDeficiencies}
          icon={AlertOctagon}
          tone="destructive"
          hint="Open + in progress"
        />
        <MetricCard
          title="Reports in review"
          value={metrics.reportsPendingReview}
          icon={ClipboardCheck}
          tone="warning"
          hint="Awaiting reviewer"
        />
        <MetricCard
          title="Impairments / 7d"
          value={metrics.recentImpairments}
          icon={ShieldAlert}
          tone="warning"
          hint="Last 7 days"
        />
        <MetricCard
          title="Visits / 7d"
          value={metrics.visitsThisWeek}
          icon={Calendar}
          hint="All visit types"
        />
        <MetricCard
          title="Fire watch"
          value={metrics.fireWatchEntries}
          icon={Flame}
          hint="All time"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent work records</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Drafts, submissions, and approvals across all sites.
              </p>
            </div>
            <Link
              href="/work-records"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              All <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/work-records/${r.id}`} className="hover:underline">
                        {r.reference_code ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground">{titleCase(r.record_type)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.site?.name ?? "—"}</TableCell>
                    <TableCell><WorkStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatRelative(r.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">
                      No work records yet. <Link href="/work-records/new" className="underline">Create one</Link>.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent deficiencies</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Code violations and corrective actions in flight.
              </p>
            </div>
            <Link
              href="/deficiencies"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              All <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Discovered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/deficiencies/${d.id}`} className="font-medium hover:underline">
                        {d.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{d.site?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell><SeverityBadge severity={d.severity} /></TableCell>
                    <TableCell><DeficiencyStatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatRelative(d.discovered_on)}</TableCell>
                  </TableRow>
                ))}
                {defs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">
                      No deficiencies tracked.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How a report gets created</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reports aren&apos;t entered directly — they&apos;re generated from work records and approved by a reviewer.
            Every step is logged in the audit trail.
          </p>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Step
              n={1}
              title="Technician creates a work record"
              detail="Visit type, site, notes, and observations are captured in the field."
              link={{ href: "/work-records/new", label: "New record" }}
            />
            <Step
              n={2}
              title="Submits for review"
              detail="Source-of-truth inputs are locked; the record enters the review queue."
            />
            <Step
              n={3}
              title="Reviewer drafts the narrative"
              detail="AI assists from the technician's notes — never invents codes. Reviewer edits."
            />
            <Step
              n={4}
              title="Approved → report"
              detail="A versioned, finalized report appears in /reports, ready to print or export."
              link={{ href: "/reports", label: "All reports" }}
            />
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({
  n,
  title,
  detail,
  link,
}: {
  n: number;
  title: string;
  detail: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="grid h-5 w-5 place-items-center rounded-sm bg-foreground text-background tabular-nums">
          {n}
        </span>
        Step {n}
      </div>
      <h4 className="text-sm font-semibold leading-snug">{title}</h4>
      <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      {link ? (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
        >
          {link.label} <ArrowUpRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}
