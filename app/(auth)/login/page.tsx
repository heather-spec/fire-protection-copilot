import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your work email and password.
        </p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/signup">
          Create one
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Demo logins after seeding: admin@sentinel.demo · reviewer@sentinel.demo · tech1@sentinel.demo
        <br />
        Password: <code>DemoPass123!</code>
      </p>
    </div>
  );
}
