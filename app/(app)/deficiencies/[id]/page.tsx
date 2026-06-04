import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { DeficiencyStatusBadge, SeverityBadge } from "@/components/dashboard/status-pill";
import { getActiveOrg, getDeficiency, listDeficiencyUpdates } from "@/lib/db/queries";
import {
  addDeficiencyUpdateAction,
  changeDeficiencyStatusAction,
} from "@/lib/actions/deficiencies";
import { formatDate, formatRelative, titleCase } from "@/lib/utils/format";

export default async function DeficiencyDetailPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const def = await getDeficiency(active.org.id, params.id);
  if (!def) notFound();
  const updates = await listDeficiencyUpdates(def.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={def.title}
        description={def.site?.name ?? "Deficiency detail"}
        actions={
          <Link
            href={`/deficiencies/${def.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Row label="Severity"><SeverityBadge severity={def.severity} /></Row>
            <Row label="Status"><DeficiencyStatusBadge status={def.status} /></Row>
            <Row label="Priority"><Badge variant="secondary">{titleCase(def.priority)}</Badge></Row>
            <Row label="Code reference">{def.code_reference ?? "—"}</Row>
            <Row label="Discovered">{formatDate(def.discovered_on)}</Row>
            <Row label="Due">{formatDate(def.due_date)}</Row>
            <Row label="Resolved">{formatDate(def.resolved_on)}</Row>
            <Row label="Assigned to">{def.assignee?.full_name ?? "—"}</Row>
            <Row label="Site">
              {def.site ? <Link className="hover:underline" href={`/sites/${def.site.id}`}>{def.site.name}</Link> : "—"}
            </Row>
            <Row label="Work record">
              {def.work_record ? (
                <Link className="hover:underline" href={`/work-records/${def.work_record.id}`}>
                  {def.work_record.reference_code ?? def.work_record.record_type}
                </Link>
              ) : "—"}
            </Row>
            <Row label="Asset">{def.asset?.identifier ?? "—"}</Row>
            {def.description ? (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{def.description}</p>
              </div>
            ) : null}
            {def.recommended_action ? (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommended action</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{def.recommended_action}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent>
            <form action={changeDeficiencyStatusAction} className="space-y-3">
              <input type="hidden" name="id" value={def.id} />
              <Field label="Change status to" htmlFor="to">
                <Select id="to" name="to" defaultValue={def.status}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="wont_fix">Won&apos;t fix</option>
                </Select>
              </Field>
              <Field label="Note (optional)" htmlFor="body">
                <Textarea id="body" name="body" rows={3} placeholder="Why are you changing status?" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" size="sm">Update status</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form action={addDeficiencyUpdateAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="id" value={def.id} />
            <Input name="body" placeholder="Add a comment to the timeline…" className="flex-1" />
            <Button type="submit" variant="outline" size="default">Add update</Button>
          </form>

          {updates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <ol className="space-y-3">
              {updates.map((u) => (
                <li key={u.id} className="rounded-md border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {u.from_status && u.to_status ? (
                        <>
                          status: <Badge variant="outline">{u.from_status}</Badge> →{" "}
                          <Badge variant="outline">{u.to_status}</Badge>
                        </>
                      ) : "comment"}
                    </span>
                    <span>{formatRelative(u.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{u.body}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
