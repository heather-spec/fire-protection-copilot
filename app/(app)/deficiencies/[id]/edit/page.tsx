import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DeficiencyForm } from "@/components/forms/deficiency-form";
import { getActiveOrg, getDeficiency, listOrgMembers, listSites } from "@/lib/db/queries";
import { updateDeficiencyAction } from "@/lib/actions/deficiencies";

export default async function EditDeficiencyPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const def = await getDeficiency(active.org.id, params.id);
  if (!def) notFound();
  const [sites, members] = await Promise.all([
    listSites(active.org.id),
    listOrgMembers(active.org.id),
  ]);

  const action = updateDeficiencyAction.bind(null, def.id);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${def.title}`} description="Deficiency details" />
      <Card>
        <CardContent className="p-6">
          <DeficiencyForm
            action={action}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            members={members}
            initial={def}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
