import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerForm } from "@/components/forms/customer-form";
import { createCustomerAction } from "@/lib/actions/customers";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New customer" description="Add a company your team services." />
      <Card>
        <CardContent className="p-6">
          <CustomerForm action={createCustomerAction} submitLabel="Create customer" />
        </CardContent>
      </Card>
    </div>
  );
}
