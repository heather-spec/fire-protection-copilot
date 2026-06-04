import { redirect } from "next/navigation";

// Middleware handles auth-aware redirects.  This is the bare fallback.
export default function Index() {
  redirect("/login");
}
