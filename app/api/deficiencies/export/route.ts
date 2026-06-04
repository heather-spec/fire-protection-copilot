import { NextResponse } from "next/server";
import { getActiveOrg, listDeficiencies } from "@/lib/db/queries";
import { audit } from "@/lib/db/audit";

const HEADERS = [
  "id",
  "title",
  "site",
  "severity",
  "priority",
  "status",
  "code_reference",
  "discovered_on",
  "due_date",
  "resolved_on",
  "assigned_to",
  "description",
  "recommended_action",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const active = await getActiveOrg();
  if (!active) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await listDeficiencies(active.org.id, 5000);

  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.title,
        r.site?.name ?? "",
        r.severity,
        r.priority,
        r.status,
        r.code_reference ?? "",
        r.discovered_on,
        r.due_date ?? "",
        r.resolved_on ?? "",
        r.assignee?.full_name ?? "",
        r.description ?? "",
        r.recommended_action ?? "",
      ].map(csvEscape).join(","),
    );
  }

  await audit({
    orgId: active.org.id,
    action: "export",
    targetTable: "deficiencies",
    payload: { count: rows.length, format: "csv" },
  });

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="deficiencies-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
