import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerForm } from "@/components/forms/customer-form";
import { getActiveOrg, getCustomer } from "@/lib/db/queries";
import { updateCustomerAction } from "@/lib/actions/customers";

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const customer = await getCustomer(active.org.id, params.id);
  if (!customer) notFound();

  const action = updateCustomerAction.bind(null, customer.id);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${customer.name}`} description="Customer details" />
      <Card>
        <CardContent className="p-6">
          <CustomerForm action={action} initial={customer} submitLabel="Save changes" />
        </CardContent>
      </Card>
    </div>
  );
}
