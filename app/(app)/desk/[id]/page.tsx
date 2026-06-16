import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeskItem } from "@/lib/desk/store";
import { CompletenessPanel } from "@/components/reviewer/completeness-panel";
import { DeskActionButton } from "@/components/desk/desk-actions";
import { DestinationsPanel } from "@/components/desk/destinations-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  "showpiece_mpr.pdf": "Monthly Pump Report",
  "riser_report.pdf": "Riser Report",
  "backflow_report.pdf": "Backflow Report",
};

function sourceLabel(file: string): string {
  return SOURCE_LABELS[file] ?? file.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
}

export default function DeskItemPage({ params }: { params: { id: string } }) {
  const item = getDeskItem(params.id);
  if (!item) notFound();
  const s = item.state;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link href="/desk" className="text-sm text-muted-foreground hover:underline">
          ← Dawn&apos;s Desk
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{item.customer}</h1>
        <p className="text-sm text-muted-foreground">
          {item.inspectionType} · {item.site} · Job #{item.jobNumber}
        </p>
      </div>

      {s.error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{s.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">1 · Combine the packet</CardTitle>
          <DeskActionButton id={item.id} action="combine" variant="outline" />
        </CardHeader>
        <CardContent>
          {s.combinedPacketUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {item.sourcePdfs.length} system report(s) merged into one {s.combinedPageCount}-page packet.
              </p>
              <a className="text-sm underline" href={s.combinedPacketUrl} target="_blank" rel="noreferrer">
                View packet PDF
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {item.sourcePdfs.length} system report{item.sourcePdfs.length === 1 ? "" : "s"} to
                combine into one customer packet:
              </p>
              <ul className="space-y-1">
                {item.sourcePdfs.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a
                      className="underline"
                      href={`/desk-src/${f}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sourceLabel(f)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">2 · Completeness check (live AI)</CardTitle>
          <DeskActionButton id={item.id} action="check" variant="outline" />
        </CardHeader>
        <CardContent className="space-y-3">
          {s.completeness ? (
            <CompletenessPanel result={s.completeness} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Claude reads the actual report and flags any missing required readings.
            </p>
          )}
          {s.completeness && s.completeness.summary.errors > 0 ? (
            <DeskActionButton id={item.id} action="bounce" variant="destructive" />
          ) : null}
          {s.bounceNote ? (
            <Alert>
              <AlertTitle>Returned to the tech with this note</AlertTitle>
              <AlertDescription>{s.bounceNote}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">3 · File it</CardTitle>
          <DeskActionButton id={item.id} action="file" disabled={!s.combinedPacketUrl} />
        </CardHeader>
        <CardContent>
          {s.destinations ? (
            <DestinationsPanel destinations={s.destinations} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Writes the packet to the ServiceTrade demo job, then fans out to the other destinations.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
