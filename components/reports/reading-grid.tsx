// Reading grids: flow tests (pump or hydrant) and water tests (riser/dry-pipe).
// A "grid" is one or more rows where each row has multiple labeled numeric
// readings. We render the schema's reading fields in a table whose values come
// from the work_record_readings table (Agent B's new table).

import type { InspectionFormField, WorkRecordReading } from "@/lib/db/types";

interface ReadingGridProps {
  fields: InspectionFormField[];
  readings: WorkRecordReading[];
  // For multi-row grids (e.g., fire pump flow test: churn / 100% / 150%),
  // pass a `rows` array so we render one column per row label.
  rows?: Array<{ key: string; label: string }>;
  caption?: string;
}

function findReading(
  readings: WorkRecordReading[],
  fieldName: string,
  rowKey?: string,
): WorkRecordReading | undefined {
  // Multi-row tables encode the row into the field name (e.g. "churn.psi",
  // "rated_flow.gpm", "overload.rpm"). When a rowKey is supplied, we look for
  // a reading whose field_name starts with that prefix and ends with the
  // field's tail. Falls back to plain match.
  if (rowKey != null) {
    const composite = `${rowKey}.${fieldName}`;
    const hit = readings.find((r) => r.field_name === composite);
    if (hit) return hit;
  }
  return readings.find((r) => r.field_name === fieldName);
}

function formatReading(r: WorkRecordReading | undefined): string {
  if (!r) return "";
  if (r.value_numeric != null) {
    return r.unit ? `${r.value_numeric} ${r.unit}` : String(r.value_numeric);
  }
  return r.value_text ?? "";
}

export function ReadingGrid({ fields, readings, rows, caption }: ReadingGridProps) {
  // Single-line layout: each field rendered as its own labeled box.
  if (!rows || rows.length === 0) {
    return (
      <div className="space-y-1">
        {caption ? (
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{caption}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {fields.map((field) => {
            const r = findReading(readings, field.name);
            return (
              <div key={field.name} className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wide text-slate-500">
                  {field.label}
                </span>
                <span className="mt-0.5 min-h-[1.1rem] rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-slate-900">
                  {formatReading(r) || <span className="text-slate-400">—</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Multi-row grid (e.g., flow test): rows on the y axis, fields on the x axis.
  return (
    <div className="space-y-1">
      {caption ? (
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{caption}</div>
      ) : null}
      <table className="w-full table-fixed border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
            <th className="border border-slate-300 px-2 py-1 text-left">Run</th>
            {fields.map((f) => (
              <th key={f.name} className="border border-slate-300 px-2 py-1 text-left">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border border-slate-300 bg-slate-50 px-2 py-1 font-medium">
                {row.label}
              </td>
              {fields.map((f) => {
                const r = findReading(readings, f.name, row.key);
                return (
                  <td
                    key={f.name}
                    className="border border-slate-300 bg-sky-50/40 px-2 py-1 text-slate-900"
                  >
                    {formatReading(r) || <span className="text-slate-400">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
