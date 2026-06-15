/**
 * Reviewer-facing completeness panel.
 *
 * Pure server component — takes a CompletenessResult (from
 * lib/validation/checker.ts) and renders a per-group breakdown of
 * issues plus a top-line status badge so the reviewer can decide
 * whether the record is ready to approve.
 *
 * The panel never mutates state; the actual approve/reject buttons
 * still live in the parent page's workflow card.
 */

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils/cn";
import type { CompletenessIssue, CompletenessResult } from "@/lib/validation/types";

interface Props {
  result: CompletenessResult;
}

const RULE_LABELS: Record<CompletenessIssue["rule"], string> = {
  missing_required: "Missing required",
  triplet_unanswered: "Unanswered",
  triplet_multiple: "Conflicting answers",
  asset_empty: "Empty asset row",
  reading_partial: "Partial reading row",
  stale_copy_suspect: "Stale copy?",
};

export function CompletenessPanel({ result }: Props) {
  const { ok, summary, issues } = result;
  const grouped = groupIssues(issues);
  const groupKeys = Array.from(grouped.keys()).sort();

  const readyToApprove = ok && summary.warnings === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            {readyToApprove ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : summary.errors > 0 ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Info className="h-4 w-4 text-warning" />
            )}
            Completeness check
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Schema-driven validation against the inspection form template. Required:{" "}
            <span className="font-medium text-foreground">
              {summary.required_complete}/{summary.required_total}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {readyToApprove ? (
            <Badge variant="success">Ready to approve</Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {summary.errors > 0 ? (
                <Badge variant="destructive">
                  {summary.errors} {summary.errors === 1 ? "error" : "errors"}
                </Badge>
              ) : null}
              {summary.warnings > 0 ? (
                <Badge variant="warning">
                  {summary.warnings} {summary.warnings === 1 ? "warning" : "warnings"}
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.length === 0 ? (
          <Alert variant="success">
            <AlertTitle>All required fields satisfied</AlertTitle>
            <AlertDescription>
              No completeness issues detected against the {result.summary.required_total} required
              fields on this form.
            </AlertDescription>
          </Alert>
        ) : (
          groupKeys.map((group) => {
            const list = grouped.get(group)!;
            return (
              <details
                key={group}
                open={list.some((i) => i.severity === "error")}
                className="rounded border border-border/60 bg-muted/20"
              >
                <summary className="cursor-pointer list-none px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span className="font-medium">{prettyGroup(group)}</span>
                  <span className="flex items-center gap-1.5">
                    {countBy(list, "error") > 0 ? (
                      <Badge variant="destructive">
                        {countBy(list, "error")} {countBy(list, "error") === 1 ? "error" : "errors"}
                      </Badge>
                    ) : null}
                    {countBy(list, "warning") > 0 ? (
                      <Badge variant="warning">
                        {countBy(list, "warning")}{" "}
                        {countBy(list, "warning") === 1 ? "warning" : "warnings"}
                      </Badge>
                    ) : null}
                  </span>
                </summary>
                <ul className="divide-y divide-border/60 border-t border-border/60">
                  {list.map((issue, idx) => (
                    <li
                      key={`${issue.rule}-${issue.field_name ?? "x"}-${idx}`}
                      className="px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "font-medium",
                            issue.severity === "error"
                              ? "text-destructive"
                              : "text-warning",
                          )}
                        >
                          {issue.field_label ?? issue.field_name ?? "Field"}
                        </span>
                        <Badge
                          variant={issue.severity === "error" ? "destructive" : "warning"}
                        >
                          {RULE_LABELS[issue.rule]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{issue.message}</p>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function groupIssues(issues: CompletenessIssue[]): Map<string, CompletenessIssue[]> {
  const out = new Map<string, CompletenessIssue[]>();
  for (const i of issues) {
    const key = i.group ?? "other";
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(i);
  }
  return out;
}

function countBy(list: CompletenessIssue[], severity: CompletenessIssue["severity"]): number {
  return list.filter((i) => i.severity === severity).length;
}

function prettyGroup(group: string): string {
  return group
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
