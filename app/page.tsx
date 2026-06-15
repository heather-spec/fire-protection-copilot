import { redirect } from "next/navigation";

// DEMO MODE — no login. Land straight on the dashboard.
export default function Index() {
  redirect("/dashboard");
}
