"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";
import { cn } from "@/lib/utils/cn";
import { BrandMark } from "./brand-mark";

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-4">
        <BrandMark className="h-7 w-7" />
        <div className="min-w-0 leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Copilot
          </div>
          <div className="truncate text-sm font-semibold">{orgName}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-px p-2.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 px-4 py-3 text-[10.5px] uppercase tracking-wider text-muted-foreground">
        v0.2 · Compliance Copilot
      </div>
    </aside>
  );
}
