"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Check, ShieldCheck, ClipboardCheck, HardHat } from "lucide-react";
import { setDemoRoleAction } from "@/lib/actions/demo";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/lib/db/types";

interface RoleConfig {
  value: UserRole;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
}

const ROLES: RoleConfig[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Full control · settings + delete",
    icon: ShieldCheck,
  },
  {
    value: "reviewer",
    label: "Reviewer",
    description: "Approve reports · run AI · sign off",
    icon: ClipboardCheck,
  },
  {
    value: "technician",
    label: "Technician",
    description: "Field capture · draft + submit",
    icon: HardHat,
  },
];

export function RoleSwitcher({ currentRole }: { currentRole: UserRole }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const current = ROLES.find((r) => r.value === currentRole) ?? ROLES[0];
  const CurrentIcon = current.icon;

  function pick(role: UserRole) {
    setOpen(false);
    if (role === currentRole) return;
    const fd = new FormData();
    fd.set("role", role);
    startTransition(() => setDemoRoleAction(fd));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        className="flex items-center gap-2 rounded-md border bg-card py-1 pl-1.5 pr-2 text-[13px] shadow-sm transition-colors hover:bg-muted"
        aria-label="Switch role"
      >
        <span className="grid h-6 w-6 place-items-center rounded-sm bg-foreground text-background">
          <CurrentIcon className="h-3.5 w-3.5" />
        </span>
        <span className="text-left">
          <span className="block text-[10.5px] uppercase tracking-wider leading-tight text-muted-foreground">
            Viewing as
          </span>
          <span className="block font-medium leading-tight">{current.label}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-md border bg-card shadow-md">
          <div className="border-b border-border/60 px-3 py-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Demo mode
            </div>
            <div className="text-xs text-muted-foreground">
              Switch role to see the app from a different perspective.
            </div>
          </div>
          <ul className="p-1">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = r.value === currentRole;
              return (
                <li key={r.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r.value)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                      active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 text-foreground" />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-1.5 font-medium leading-tight">
                        {r.label}
                        {active ? (
                          <Check className="h-3.5 w-3.5 text-foreground/70" />
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {r.description}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
