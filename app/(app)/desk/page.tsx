import { listDeskItems } from "@/lib/desk/store";
import { resetDesk } from "@/lib/actions/desk";
import { Lane } from "@/components/desk/lane";
import { Button } from "@/components/ui/button";
import type { DeskStage } from "@/lib/desk/types";

export const dynamic = "force-dynamic";

export default function DeskPage() {
  const items = listDeskItems();
  const byStage = (stage: DeskStage) => items.filter((i) => i.state.stage === stage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dawn&apos;s Desk</h1>
          <p className="text-sm text-muted-foreground">
            Inspection reports flowing from review to filed. Open a card to work it.
          </p>
        </div>
        <form action={resetDesk}>
          <Button type="submit" variant="outline">Reset demo</Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-4">
        <Lane stage="review" items={byStage("review")} />
        <Lane stage="combine" items={byStage("combine")} />
        <Lane stage="file" items={byStage("file")} />
        <Lane stage="done" items={byStage("done")} />
      </div>
    </div>
  );
}
