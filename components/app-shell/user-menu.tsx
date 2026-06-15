"use client";

import { useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2.5 text-[13px] transition-colors hover:bg-muted"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-[11px] font-semibold text-background">
          {initials || <UserIcon className="h-3.5 w-3.5" />}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block leading-tight">{name}</span>
          <span className="block text-[10.5px] uppercase tracking-wider leading-tight text-muted-foreground">
            {role}
          </span>
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-md border bg-card shadow-md">
          <div className="px-3 py-2.5 text-sm">
            <div className="font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
            <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {role}
            </div>
          </div>
          <div className="border-t border-border/60" />
          <form action="/api/auth/signout" method="post" className="p-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
