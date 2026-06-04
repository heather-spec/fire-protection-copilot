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
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { getActiveOrg, listSites } from "@/lib/db/queries";

export default async function SitesPage() {
  const active = await getActiveOrg();
  if (!active) return null;
  const sites = await listSites(active.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Physical buildings, complexes, or properties where work happens."
        actions={
          <Link href="/sites/new" className={buttonVariants({ size: "sm" })}>+ New site</Link>
        }
      />

      {sites.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No sites yet"
          description="Sites are where techs do work. Add one to begin."
          action={
            <Link href="/sites/new" className={buttonVariants({ size: "sm" })}>Add site</Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead className="text-right">Sq ft</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/sites/${s.id}`} className="hover:underline">{s.name}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.customer ? (
                        <Link href={`/customers/${s.customer.id}`} className="hover:underline">
                          {s.customer.name}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[s.address_line1, s.city, s.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.occupancy_type ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {s.square_footage?.toLocaleString() ?? "—"}
                    </TableCell>
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
