import { formatDistanceToNowStrict, format, isValid } from "date-fns";

export function formatDate(value: string | Date | null | undefined, fmt = "MMM d, yyyy") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return isValid(d) ? format(d, fmt) : "—";
}

export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!isValid(d)) return "—";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

export function titleCase(s: string) {
  return s
    .split(/[_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
