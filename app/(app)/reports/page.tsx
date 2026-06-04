import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { WorkStatusBadge } from "@/components/dashboard/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";
import { getActiveOrg, listWorkRecords } from "@/lib/db/queries";
import { formatDate, titleCase } from "@/lib/utils/format";

export default async function ReportsPage() {
  const active = await getActiveOrg();
  if (!active) return null;

  // Reports = approved or in-review work records. Phase 2 will generate
  // signed PDFs and AI-assisted narratives; for now this is the queue view.
  const all = await listWorkRecords(active.org.id, 200);
  const reportable = all.filter((r) => ["approved", "in_review", "submitted"].includes(r.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Approved and review-stage work records. Phase 2: PDF export + AI-drafted narratives."
      />

      {reportable.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No reports yet" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer / site</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportable.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/work-records/${r.id}`}>
                        {r.reference_code ?? "—"}
                      </Link>
                      {r.status === "approved" ? (
                        <Link
                          className="ml-2 text-xs font-normal text-primary underline-offset-4 hover:underline"
                          href={`/reports/${r.id}`}
                        >
                          print
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell>{titleCase(r.record_type)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{r.customer?.name ?? "—"}</div>
                      <div className="text-xs">{r.site?.name ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.reviewer?.full_name ?? "—"}
                    </TableCell>
                    <TableCell><WorkStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.reviewed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
