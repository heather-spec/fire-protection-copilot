// Titled section wrapper. RTF forms number their sections 1-11 in the annual
// inspection form; the optional `number` prop renders the numbered label.

import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  number?: number;
  children: ReactNode;
  // Some sections (general notes, photo blocks) want a different background
  // tone in the source PDF — let the caller hint at it.
  tone?: "default" | "muted";
}

export function FormSection({
  title,
  number,
  children,
  tone = "default",
}: FormSectionProps) {
  const bg = tone === "muted" ? "bg-slate-50" : "bg-white";
  return (
    <section
      className={`overflow-hidden rounded-md border border-slate-300 ${bg} print:break-inside-avoid`}
    >
      <div className="flex items-center gap-2 border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        {number != null ? (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm bg-[#0b1f4d] px-1 text-[10px] font-bold text-white">
            {number}
          </span>
        ) : null}
        <span>{title}</span>
      </div>
      <div className="px-3 py-2 text-xs">{children}</div>
    </section>
  );
}
