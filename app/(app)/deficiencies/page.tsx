import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeficiencyStatusBadge, SeverityBadge } from "@/components/dashboard/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { AlertOctagon } from "lucide-react";
import { getActiveOrg, listDeficiencies } from "@/lib/db/queries";
import { formatDate, titleCase } from "@/lib/utils/format";
import type { DeficiencyStatus, DeficiencySeverity } from "@/lib/db/types";

type Filters = {
  status?: string;
  severity?: string;
  priority?: string;
  view?: "list" | "board";
};

export default async function DeficienciesPage({ searchParams }: { searchParams: Filters }) {
  const active = await getActiveOrg();
  if (!active) return null;
  const all = await listDeficiencies(active.org.id, 500);

  const filtered = all.filter((d) => {
    if (searchParams.status && d.status !== searchParams.status) return false;
    if (searchParams.severity && d.severity !== searchParams.severity) return false;
    if (searchParams.priority && d.priority !== searchParams.priority) return false;
    return true;
  });

  const view = searchParams.view === "board" ? "board" : "list";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deficiencies"
        description="Open code violations, marginal passes, and corrective actions."
        actions={
          <>
            <Link
              href="/api/deficiencies/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Link>
            <Link href="/deficiencies/new" className={buttonVariants({ size: "sm" })}>
              + New deficiency
            </Link>
          </>
        }
      />

      <FilterBar current={searchParams} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<AlertOctagon className="h-8 w-8" />}
          title="No deficiencies match those filters"
          description="Try clearing filters or create a new one."
        />
      ) : view === "board" ? (
        <Board items={filtered} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link href={`/deficiencies/${d.id}`} className="hover:underline">
                        {d.title}
                      </Link>
                      {d.code_reference ? (
                        <div className="text-xs text-muted-foreground">{d.code_reference}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.site?.name ?? "—"}</TableCell>
                    <TableCell><SeverityBadge severity={d.severity} /></TableCell>
                    <TableCell><Badge variant="secondary">{titleCase(d.priority)}</Badge></TableCell>
                    <TableCell><DeficiencyStatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(d.due_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{d.assignee?.full_name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STATUSES: DeficiencyStatus[] = ["open", "in_progress", "resolved", "wont_fix"];
const SEVERITIES: DeficiencySeverity[] = ["critical", "major", "minor", "advisory"];

function FilterBar({ current }: { current: Filters }) {
  const qs = (next: Filters) => {
    const params = new URLSearchParams();
    Object.entries({ ...current, ...next }).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    return "?" + params.toString();
  };

  const Pill = ({
    label, active, href,
  }: { label: string; active: boolean; href: string }) => (
    <Link
      href={href}
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")
      }
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Status:</span>
      <Pill label="All" active={!current.status} href={qs({ status: "" })} />
      {STATUSES.map((s) => (
        <Pill key={s} label={titleCase(s)} active={current.status === s} href={qs({ status: s })} />
      ))}
      <span className="ml-4 text-xs uppercase tracking-wide text-muted-foreground">Severity:</span>
      <Pill label="All" active={!current.severity} href={qs({ severity: "" })} />
      {SEVERITIES.map((s) => (
        <Pill key={s} label={titleCase(s)} active={current.severity === s} href={qs({ severity: s })} />
      ))}
      <span className="ml-auto flex items-center gap-1">
        <Pill label="List" active={current.view !== "board"} href={qs({ view: "list" })} />
        <Pill label="Board" active={current.view === "board"} href={qs({ view: "board" })} />
      </span>
    </div>
  );
}

function Board({ items }: { items: Awaited<ReturnType<typeof listDeficiencies>> }) {
  const cols: { key: DeficiencyStatus; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In progress" },
    { key: "resolved", label: "Resolved" },
    { key: "wont_fix", label: "Won't fix" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {cols.map((c) => {
        const list = items.filter((i) => i.status === c.key);
        return (
          <Card key={c.key} className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">{c.label}</CardTitle>
              <Badge variant="outline">{list.length}</Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              {list.map((d) => (
                <Link
                  key={d.id}
                  href={`/deficiencies/${d.id}`}
                  className="block rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="font-medium">{d.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <SeverityBadge severity={d.severity} />
                    <Badge variant="secondary">{titleCase(d.priority)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {d.site?.name ?? "—"}
                    {d.due_date ? ` · due ${formatDate(d.due_date)}` : ""}
                  </div>
                </Link>
              ))}
              {list.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">none</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
