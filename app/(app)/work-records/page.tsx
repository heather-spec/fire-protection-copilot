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
import { buttonVariants } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { getActiveOrg, listWorkRecords } from "@/lib/db/queries";
import { formatDate, titleCase } from "@/lib/utils/format";

export default async function WorkRecordsPage() {
  const active = await getActiveOrg();
  if (!active) return null;
  const records = await listWorkRecords(active.org.id, 200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work records"
        description="Inspections, tests, maintenance, service calls, deficiency follow-ups, impairments, fire watch."
        actions={
          <Link href="/work-records/new" className={buttonVariants({ size: "sm" })}>+ New work record</Link>
        }
      />

      {records.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No work records yet"
          action={
            <Link href="/work-records/new" className={buttonVariants({ size: "sm" })}>Create the first one</Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer / site</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/work-records/${r.id}`} className="hover:underline">
                        {r.reference_code ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{titleCase(r.record_type)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{r.customer?.name ?? "—"}</div>
                      <div className="text-xs">{r.site?.name ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.technician?.full_name ?? "—"}
                    </TableCell>
                    <TableCell><WorkStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.completed_at)}</TableCell>
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
