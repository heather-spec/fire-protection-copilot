import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkRecordForm } from "@/components/forms/work-record-form";
import { getActiveOrg, listCustomers, listSites } from "@/lib/db/queries";
import { createWorkRecordAction } from "@/lib/actions/work-records";

export default async function NewWorkRecordPage({
  searchParams,
}: {
  searchParams: { customer?: string; site?: string };
}) {
  const active = await getActiveOrg();
  if (!active) return null;
  const [customers, sites] = await Promise.all([
    listCustomers(active.org.id),
    listSites(active.org.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New work record"
        description="Pick a visit type and fill in only what applies. You can add observations and photos after saving."
      />
      <Card>
        <CardContent className="p-6">
          <WorkRecordForm
            action={createWorkRecordAction}
            customers={customers}
            sites={sites.map((s) => ({ id: s.id, name: s.name, customer_id: s.customer_id }))}
            defaultCustomerId={searchParams.customer}
            defaultSiteId={searchParams.site}
            submitLabel="Create work record"
          />
        </CardContent>
      </Card>
    </div>
  );
}
