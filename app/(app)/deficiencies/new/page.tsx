import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DeficiencyForm } from "@/components/forms/deficiency-form";
import { getActiveOrg, listOrgMembers, listSites } from "@/lib/db/queries";
import { createDeficiencyAction } from "@/lib/actions/deficiencies";

export default async function NewDeficiencyPage({
  searchParams,
}: {
  searchParams: { site?: string; work_record?: string };
}) {
  const active = await getActiveOrg();
  if (!active) return null;
  const [sites, members] = await Promise.all([
    listSites(active.org.id),
    listOrgMembers(active.org.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New deficiency"
        description="Manual entry. To extract automatically from a work record, use the AI tool on that record's detail page."
      />
      <Card>
        <CardContent className="p-6">
          <DeficiencyForm
            action={createDeficiencyAction}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            members={members}
            defaultSiteId={searchParams.site}
            defaultWorkRecordId={searchParams.work_record}
            submitLabel="Create deficiency"
          />
        </CardContent>
      </Card>
    </div>
  );
}
