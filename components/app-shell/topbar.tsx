import { MobileNav } from "./mobile-nav";
import { RoleSwitcher } from "./role-switcher";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/db/types";

export function Topbar({
  orgName,
  userName: _userName,
  userEmail: _userEmail,
  role,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  role: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <div className="flex items-center gap-3">
        <MobileNav orgName={orgName} />
        <div className="hidden items-center gap-2 text-[13px] lg:flex">
          <span className="font-medium">{orgName}</span>
          <Badge variant="outline" className="ml-0.5">Demo</Badge>
        </div>
      </div>
      <RoleSwitcher currentRole={role as UserRole} />
    </header>
  );
}
