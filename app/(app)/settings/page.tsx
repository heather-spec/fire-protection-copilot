import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getActiveOrg, listOrgMembers } from "@/lib/db/queries";
import { titleCase } from "@/lib/utils/format";

export default async function SettingsPage() {
  const active = await getActiveOrg();
  if (!active) return null;
  const members = await listOrgMembers(active.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organization details and team members."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Phase 2 will let admins rename and re-brand the org here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={active.org.name} />
          <Field label="Slug" value={active.org.slug} />
          <Field label="Your role" value={titleCase(active.role)} />
          <Field label="Organization ID" value={active.org.id} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>Everyone in this organization.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.membership_id}>
                  <TableCell className="font-medium">{m.profile.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.profile.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{titleCase(m.role)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 text-sm"}>{value}</div>
    </div>
  );
}
