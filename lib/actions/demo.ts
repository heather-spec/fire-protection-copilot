"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROLE_COOKIE } from "@/lib/demo/identity";
import type { UserRole } from "@/lib/db/types";

const VALID: UserRole[] = ["admin", "reviewer", "technician"];

export async function setDemoRoleAction(formData: FormData): Promise<void> {
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!VALID.includes(role)) return;
  cookies().set(ROLE_COOKIE, role, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  revalidatePath("/", "layout");
}
