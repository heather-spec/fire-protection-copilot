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
import { Building2 } from "lucide-react";
import { getActiveOrg, listCustomers } from "@/lib/db/queries";

export default async function CustomersPage() {
  const active = await getActiveOrg();
  if (!active) return null;
  const customers = await listCustomers(active.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Companies your team services."
        actions={
          <Link href="/customers/new" className={buttonVariants({ size: "sm" })}>
            + New customer
          </Link>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No customers yet"
          description="Add your first customer to start scheduling visits."
          action={
            <Link href="/customers/new" className={buttonVariants({ size: "sm" })}>
              Add customer
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/customers/${c.id}`} className="hover:underline">{c.name}</Link>
                    </TableCell>
                    <TableCell>{c.contact_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.contact_email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.contact_phone ?? "—"}</TableCell>
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
