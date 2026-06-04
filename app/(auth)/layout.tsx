import { Flame } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5" />
          Fire Protection Copilot
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-medium leading-snug">
            Field-first compliance for fire protection contractors.
          </p>
          <p className="text-sm text-primary-foreground/80">
            Inspections, deficiencies, impairments, and fire-watch in one auditable workflow.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/70">© Fire Protection Copilot</div>
      </div>
      <div className="flex items-center justify-center px-6 py-10 lg:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
