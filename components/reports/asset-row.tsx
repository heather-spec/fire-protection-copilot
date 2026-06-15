// Renders one asset row (fire pump, jockey pump, backflow device, hydrant,
// sprinkler system, control valve, etc.). The schema's asset fields share a
// `group` value; the caller filters by `group` + `asset_role` and passes the
// matching Asset row plus the relevant InspectionFormFields.

import type { Asset, InspectionFormField } from "@/lib/db/types";

interface AssetRowProps {
  fields: InspectionFormField[];
  asset?: Asset | null;
  // Some asset rows (e.g., one row in the Control Valves table) want a compact
  // single-line layout instead of a labeled grid.
  layout?: "grid" | "inline";
  label?: string; // e.g., "Main pump" / "Jockey pump"
}

// Pull a value from the asset for a given schema field. We look at first-class
// columns first, then asset.metadata using either the field's `name` or `label`.
function resolveAssetValue(
  field: InspectionFormField,
  asset: Asset | null | undefined,
): string {
  if (!asset) return "";
  const md = (asset.metadata ?? {}) as Record<string, unknown>;
  const lower = field.name.toLowerCase();

  if (lower.includes("manufacturer") || lower === "device") {
    return asset.manufacturer ?? (md[field.name] as string) ?? "";
  }
  if (lower.includes("model")) {
    return asset.model ?? (md[field.name] as string) ?? "";
  }
  if (lower.includes("serial")) {
    return asset.serial_number ?? (md[field.name] as string) ?? "";
  }
  if (lower.includes("identifier") || lower === "asset_name") {
    return asset.identifier ?? "";
  }
  const fromMd = md[field.name] ?? md[field.label];
  return typeof fromMd === "string" ? fromMd : "";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-0.5 min-h-[1.1rem] rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-slate-900">
        {value || <span className="text-slate-400">—</span>}
      </span>
    </div>
  );
}

export function AssetRow({ fields, asset, layout = "grid", label }: AssetRowProps) {
  if (layout === "inline") {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 py-1 text-xs last:border-b-0">
        {label ? (
          <span className="min-w-[7rem] text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {label}
          </span>
        ) : null}
        {fields.map((f) => (
          <span key={f.name} className="flex items-center gap-1">
            <span className="text-[10px] uppercase text-slate-500">{f.label}:</span>
            <span className="rounded border border-sky-200 bg-sky-50 px-1 text-[11px]">
              {resolveAssetValue(f, asset) || "—"}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label ? (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          {label}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} value={resolveAssetValue(f, asset)} />
        ))}
      </div>
    </div>
  );
}
