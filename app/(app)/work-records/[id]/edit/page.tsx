import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WorkRecordForm } from "@/components/forms/work-record-form";
import { getActiveOrg, getWorkRecord, listCustomers, listSites } from "@/lib/db/queries";
import { updateWorkRecordAction } from "@/lib/actions/work-records";

export default async function EditWorkRecordPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const record = await getWorkRecord(active.org.id, params.id);
  if (!record) notFound();
  const [customers, sites] = await Promise.all([
    listCustomers(active.org.id),
    listSites(active.org.id),
  ]);

  const action = updateWorkRecordAction.bind(null, record.id);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${record.reference_code ?? "work record"}`} description="Source-of-truth inputs" />
      <Card>
        <CardContent className="p-6">
          <WorkRecordForm
            action={action}
            customers={customers}
            sites={sites.map((s) => ({ id: s.id, name: s.name, customer_id: s.customer_id }))}
            initial={record}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
