import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FileDestination } from "@/lib/desk/types";

export function DestinationsPanel({ destinations }: { destinations: FileDestination[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filed to</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {destinations.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            {d.status === "real" ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{d.name}</span>
            {d.status === "simulated" ? <Badge variant="warning">simulated</Badge> : null}
            <span className="text-xs text-muted-foreground">{d.detail}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
