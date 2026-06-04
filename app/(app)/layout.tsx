import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { getActiveOrg, getCurrentProfile } from "@/lib/db/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, active] = await Promise.all([getCurrentProfile(), getActiveOrg()]);

  if (!profile) redirect("/login");

  if (!active) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">You&apos;re signed in, but not in any organization yet.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask an admin to add you to an organization to access the app.
          </p>
          <form action="/api/auth/signout" method="post" className="mt-6">
            <button className="text-sm font-medium text-primary underline-offset-4 hover:underline" type="submit">
              Sign out
            </button>
          </form>
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
