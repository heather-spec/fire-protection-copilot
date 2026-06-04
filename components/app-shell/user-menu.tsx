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
        className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm transition-colors hover:bg-muted"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials || <UserIcon className="h-4 w-4" />}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block leading-tight">{name}</span>
          <span className="block text-xs leading-tight text-muted-foreground">{role}</span>
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-md border bg-card p-2 shadow-lg">
          <div className="px-2 py-1.5 text-sm">
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted-foreground truncate">{email}</div>
            <div className="mt-1 text-xs">
              Role: <span className="font-medium">{role}</span>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <form action="/api/auth/signout" method="post">
            <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
