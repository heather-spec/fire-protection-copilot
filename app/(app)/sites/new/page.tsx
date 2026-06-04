import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SiteForm } from "@/components/forms/site-form";
import { getActiveOrg, listCustomers } from "@/lib/db/queries";
import { createSiteAction } from "@/lib/actions/sites";

export default async function NewSitePage({ searchParams }: { searchParams: { customer?: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const customers = await listCustomers(active.org.id);

  const initial = searchParams.customer ? { customer_id: searchParams.customer } : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="New site" description="A physical site belonging to a customer." />
      <Card>
        <CardContent className="p-6">
          <SiteForm
            action={createSiteAction}
            customers={customers}
            initial={initial}
            submitLabel="Create site"
          />
        </CardContent>
      </Card>
    </div>
  );
}
