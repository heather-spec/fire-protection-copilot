import {
  AlertOctagon,
  ClipboardCheck,
  ShieldAlert,
  Calendar,
  Flame,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import Link from "next/link";

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
        title="Dashboard"
        description={`Compliance overview for ${active.org.name}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Open deficiencies"
          value={metrics.openDeficiencies}
          icon={AlertOctagon}
          tone="destructive"
          hint="Open + in-progress"
        />
        <MetricCard
          title="Reports pending review"
          value={metrics.reportsPendingReview}
          icon={ClipboardCheck}
          tone="warning"
          hint="Submitted + in review"
        />
        <MetricCard
          title="Recent impairments"
          value={metrics.recentImpairments}
          icon={ShieldAlert}
          tone="warning"
          hint="Last 7 days"
        />
        <MetricCard
          title="Visits this week"
          value={metrics.visitsThisWeek}
          icon={Calendar}
          tone="default"
          hint="All work-record types"
        />
        <MetricCard
          title="Fire watch entries"
          value={metrics.fireWatchEntries}
          icon={Flame}
          tone="default"
          hint="All time"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent work records</CardTitle>
            <Link
              href="/work-records"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              View all
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
                    <TableCell className="font-medium">{r.reference_code ?? "—"}</TableCell>
                    <TableCell>{titleCase(r.record_type)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.site?.name ?? "—"}</TableCell>
                    <TableCell><WorkStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelative(r.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No work records yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent deficiencies</CardTitle>
            <Link
              href="/deficiencies"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              View all
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
                    <TableCell className="font-medium">
                      <div>{d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.site?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell><SeverityBadge severity={d.severity} /></TableCell>
                    <TableCell><DeficiencyStatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatRelative(d.discovered_on)}</TableCell>
                  </TableRow>
                ))}
                {defs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No deficiencies yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
