import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Printer, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { WorkStatusBadge } from "@/components/dashboard/status-pill";
import {
  getActiveOrg,
  getWorkRecord,
  listAssetsForSite,
  listObservations,
  listReportVersions,
} from "@/lib/db/queries";
import {
  addObservationAction,
  approveWorkRecordAction,
  rejectWorkRecordAction,
  removeObservationAction,
  requestRevisionAction,
  saveFinalReportAction,
  submitWorkRecordAction,
} from "@/lib/actions/work-records";
import {
  extractDeficienciesAction,
  generateClientSummaryAction,
  generateReportDraftAction,
} from "@/lib/actions/ai";
import { formatDate, formatRelative, titleCase } from "@/lib/utils/format";

export default async function WorkRecordDetailPage({ params }: { params: { id: string } }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const record = await getWorkRecord(active.org.id, params.id);
  if (!record) notFound();

  const [observations, versions, assets] = await Promise.all([
    listObservations(record.id),
    listReportVersions(record.id),
    listAssetsForSite(active.org.id, record.site_id),
  ]);

  const role = active.role;
  const canReview = role === "admin" || role === "reviewer";
  const isMutable = ["draft", "revision_requested"].includes(record.status);
  const isReviewable = ["submitted", "in_review"].includes(record.status);
  const md = (record.metadata ?? {}) as Record<string, unknown>;
  const clientSummary = typeof md["client_summary"] === "string" ? (md["client_summary"] as string) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.reference_code ?? "Work record"}
        description={`${titleCase(record.record_type)} · ${record.site?.name ?? ""}`}
        actions={
          <>
            <WorkStatusBadge status={record.status} />
            {isMutable ? (
              <Link
                href={`/work-records/${record.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            ) : null}
            {record.status === "approved" ? (
              <Link
                href={`/reports/${record.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print report
              </Link>
            ) : null}
          </>
        }
      />

      {record.rejection_reason && record.status !== "approved" ? (
        <Alert variant={record.status === "rejected" ? "destructive" : "warning"}>
          <AlertTitle>
            {record.status === "rejected" ? "Rejected" : "Revision requested"}
          </AlertTitle>
          <AlertDescription>{record.rejection_reason}</AlertDescription>
        </Alert>
      ) : null}

      {/* Source-of-truth panel ------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source inputs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Captured by the technician. This block is the source of truth and is never overwritten by AI.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Row label="Customer">{record.customer?.name ?? "—"}</Row>
          <Row label="Site">{record.site?.name ?? "—"}</Row>
          <Row label="Visit type">{titleCase(record.record_type)}</Row>
          <Row label="Status"><WorkStatusBadge status={record.status} /></Row>
          <Row label="Technician">{record.technician?.full_name ?? "—"}</Row>
          <Row label="Reviewer">{record.reviewer?.full_name ?? "—"}</Row>
          <Row label="Scheduled">{formatDate(record.scheduled_for)}</Row>
          <Row label="Completed">{formatDate(record.completed_at)}</Row>
          {record.summary ? (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Field summary</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{record.summary}</p>
            </div>
          ) : null}
          {record.notes ? (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Technician notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{record.notes}</p>
            </div>
          ) : null}
          {record.voice_transcript ? (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Voice transcript</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{record.voice_transcript}</p>
            </div>
          ) : null}
          {Object.keys(md).filter((k) => k !== "client_summary").length > 0 ? (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Type-specific data</div>
              <pre className="mt-1 max-h-48 overflow-auto rounded border bg-muted/40 p-2 text-xs">
                {JSON.stringify(stripKnown(md), null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Observations ------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observations ({observations.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Line items the technician recorded against assets or checks.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No observations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {observations.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.check_code ?? "—"}</TableCell>
                    <TableCell>{o.description}</TableCell>
                    <TableCell>
                      <Badge variant={badgeForResult(o.result)}>{o.result}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {isMutable ? (
                        <form action={removeObservationAction}>
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="work_record_id" value={record.id} />
                          <Button type="submit" variant="ghost" size="icon" aria-label="Remove">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {isMutable ? (
            <form action={addObservationAction} className="grid gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-6">
              <input type="hidden" name="work_record_id" value={record.id} />
              <Field label="Code" htmlFor="o_code" className="sm:col-span-1">
                <Input id="o_code" name="check_code" placeholder="NFPA 25 5.2.1" />
              </Field>
              <Field label="Description" htmlFor="o_desc" required className="sm:col-span-2">
                <Input id="o_desc" name="description" required />
              </Field>
              <Field label="Result" htmlFor="o_result" className="sm:col-span-1">
                <Select id="o_result" name="result" defaultValue="pass">
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="na">N/A</option>
                </Select>
              </Field>
              <Field label="Asset" htmlFor="o_asset" className="sm:col-span-2">
                <Select id="o_asset" name="asset_id" defaultValue="">
                  <option value="">— none —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.identifier ?? a.asset_type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes" htmlFor="o_notes" className="sm:col-span-5">
                <Input id="o_notes" name="notes" />
              </Field>
              <div className="flex items-end sm:col-span-1">
                <Button type="submit" size="sm" variant="outline" className="w-full">Add</Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* AI-assisted drafting ---------------------------------------------- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI-assisted draft
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Generated content is kept separate from source data and is always editable by the reviewer.
            </p>
          </div>
          <Badge variant="outline">v{record.final_report_version}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <form action={generateReportDraftAction}>
              <input type="hidden" name="id" value={record.id} />
              <Button type="submit" size="sm" variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                Draft report
              </Button>
            </form>
            <form action={generateClientSummaryAction}>
              <input type="hidden" name="id" value={record.id} />
              <Button type="submit" size="sm" variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                Client summary
              </Button>
            </form>
            <form action={extractDeficienciesAction}>
              <input type="hidden" name="id" value={record.id} />
              <Button type="submit" size="sm" variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                Extract deficiencies
              </Button>
            </form>
          </div>

          {canReview ? (
            <form action={saveFinalReportAction} className="space-y-3">
              <input type="hidden" name="id" value={record.id} />
              <Field label="Report text (reviewer-editable)" htmlFor="final_report">
                <Textarea
                  id="final_report"
                  name="final_report"
                  rows={12}
                  defaultValue={record.final_report ?? ""}
                  placeholder="Generate a draft above, then refine here before approving."
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="outline">Save edit (v{record.final_report_version + 1})</Button>
              </div>
            </form>
          ) : record.final_report ? (
            <div className="rounded border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{record.final_report}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No draft generated yet.</p>
          )}

          {clientSummary ? (
            <Alert variant="info">
              <AlertTitle>Client summary (generated)</AlertTitle>
              <AlertDescription className="mt-1 whitespace-pre-wrap">{clientSummary}</AlertDescription>
            </Alert>
          ) : null}

          {versions.length > 0 ? (
            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Version history ({versions.length})
              </summary>
              <ol className="mt-3 space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="rounded border bg-card p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>
                        <Badge variant="outline">v{v.version}</Badge>{" "}
                        <span className="ml-2 font-medium">{titleCase(v.kind.replace("_", " "))}</span>
                      </span>
                      <span className="text-muted-foreground">{formatRelative(v.created_at)}</span>
                    </div>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{v.content}</pre>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </CardContent>
      </Card>

      {/* Workflow actions -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {isMutable ? (
            <form action={submitWorkRecordAction}>
              <input type="hidden" name="id" value={record.id} />
              <Button type="submit">Submit for review</Button>
            </form>
          ) : null}

          {canReview && isReviewable ? (
            <>
              <form action={approveWorkRecordAction}>
                <input type="hidden" name="id" value={record.id} />
                <Button type="submit">Approve</Button>
              </form>
              <form action={requestRevisionAction} className="flex items-end gap-2">
                <input type="hidden" name="id" value={record.id} />
                <Field label="Revision note" htmlFor="rev_reason">
                  <Input id="rev_reason" name="reason" placeholder="What needs to change" />
                </Field>
                <Button type="submit" variant="outline">Request revision</Button>
              </form>
              <form action={rejectWorkRecordAction} className="flex items-end gap-2">
                <input type="hidden" name="id" value={record.id} />
                <Field label="Reject reason" htmlFor="rej_reason">
                  <Input id="rej_reason" name="reason" placeholder="Why rejected" />
                </Field>
                <Button type="submit" variant="destructive">Reject</Button>
              </form>
            </>
          ) : null}

          {!isMutable && !isReviewable ? (
            <p className="text-sm text-muted-foreground">
              No actions available for status <strong>{titleCase(record.status)}</strong>.
            </p>
          ) : null}
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

function badgeForResult(result: string): "success" | "destructive" | "secondary" | "outline" {
  const r = result.toLowerCase();
  if (r === "pass") return "success";
  if (r === "fail" || r === "fault") return "destructive";
  if (r === "na" || r === "n/a") return "outline";
  return "secondary";
}

function stripKnown(md: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(md)) if (k !== "client_summary") out[k] = md[k];
  return out;
}
