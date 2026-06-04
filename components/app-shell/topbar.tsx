import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  orgName,
  userName,
  userEmail,
  role,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  role: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <div className="flex items-center gap-3">
        <MobileNav orgName={orgName} />
        <div className="hidden items-center gap-2 lg:flex">
          <span className="text-sm font-medium">{orgName}</span>
          <Badge variant="secondary">{role}</Badge>
        </div>
      </div>
      <UserMenu name={userName} email={userEmail} role={role} />
    </header>
  );
}
