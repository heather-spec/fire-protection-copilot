"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { combineItem, runCheck, bounceBack, fileItem } from "@/lib/actions/desk";

type Action = "combine" | "check" | "bounce" | "file";

const LABELS: Record<Action, string> = {
  combine: "Combine packet",
  check: "Run completeness check",
  bounce: "Bounce back to tech",
  file: "File it",
};

export function DeskActionButton({
  id,
  action,
  variant = "default",
  disabled = false,
}: {
  id: string;
  action: Action;
  variant?: "default" | "outline" | "destructive";
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const fns = { combine: combineItem, check: runCheck, bounce: bounceBack, file: fileItem };
  return (
    <Button
      variant={variant}
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          await fns[action](id);
          router.refresh(); // re-fetch the server component so the result shows
        })
      }
    >
      {pending ? "Working…" : LABELS[action]}
    </Button>
  );
}
