import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
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
import { EmptyState } from "@/components/ui/empty-state";
import { MapPin, Pencil } from "lucide-react";
import { getActiveOrg, getCustomer, listSitesForCustomer } from "@/lib/db/queries";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const customer = await getCustomer(active.org.id, params.id);
  if (!customer) notFound();

  const sites = await listSitesForCustomer(active.org.id, customer.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={customer.contact_name ?? "Customer detail"}
        actions={
          <>
            <Link href={`/customers/${customer.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
            <Link href={`/sites/new?customer=${customer.id}`} className={buttonVariants({ size: "sm" })}>
              + New site
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Contact">{customer.contact_name ?? "—"}</Row>
            <Row label="Email">{customer.contact_email ?? "—"}</Row>
            <Row label="Phone">{customer.contact_phone ?? "—"}</Row>
            <Row label="Billing address">{customer.billing_address ?? "—"}</Row>
            {customer.notes ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
                <p className="mt-1 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Sites</CardTitle>
            <span className="text-xs text-muted-foreground">{sites.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            {sites.length === 0 ? (
              <EmptyState
                icon={<MapPin className="h-7 w-7" />}
                title="No sites yet"
                description="Add a site to start scheduling visits."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Occupancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" href={`/sites/${s.id}`}>{s.name}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.occupancy_type ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
