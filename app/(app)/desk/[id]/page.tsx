import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeskItem } from "@/lib/desk/store";
import { CompletenessPanel } from "@/components/reviewer/completeness-panel";
import { DeskActionButton } from "@/components/desk/desk-actions";
import { DestinationsPanel } from "@/components/desk/destinations-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

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
            <p className="text-sm text-muted-foreground">Not combined yet.</p>
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
