import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { getActiveOrg, getCurrentProfile } from "@/lib/db/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // DEMO MODE — getCurrentProfile + getActiveOrg always succeed via lib/demo/identity.ts
  const [profile, active] = await Promise.all([getCurrentProfile(), getActiveOrg()]);
  if (!profile || !active) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Demo data not ready.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The demo profile or organization couldn&apos;t be loaded. Make sure
            the database seed has been applied and that <code>hnianouris@gmail.com</code>
            has a profile row.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar orgName={active.org.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          orgName={active.org.name}
          userName={profile.full_name ?? profile.email}
          userEmail={profile.email}
          role={active.role}
        />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
