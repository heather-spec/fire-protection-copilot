import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SiteForm } from "@/components/forms/site-form";
import { getActiveOrg, getSite, listCustomers, listJurisdictions } from "@/lib/db/queries";
import { updateSiteAction } from "@/lib/actions/sites";

export default async function EditSitePage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const site = await getSite(active.org.id, params.id);
  if (!site) notFound();
  const [customers, jurisdictions] = await Promise.all([
    listCustomers(active.org.id),
    listJurisdictions(),
  ]);

  const action = updateSiteAction.bind(null, site.id);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${site.name}`} description="Site details" />
      <Card>
        <CardContent className="p-6">
          <SiteForm
            action={action}
            customers={customers}
            jurisdictions={jurisdictions}
            initial={site}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
