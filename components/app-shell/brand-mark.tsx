import { cn } from "@/lib/utils/cn";

// A custom mark — a soft "shield + spark" that reads as fire-protection
// without leaning on the generic flame icon. Drawn in SVG so it scales,
// inverts cleanly, and feels designed rather than picked from a library.
export function BrandMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const fill = inverted ? "hsl(var(--primary-foreground))" : "hsl(var(--brand))";
  const stroke = inverted ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))";
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("inline-block", className)}
      aria-hidden
    >
      {/* shield silhouette */}
      <path
        d="M16 2.5 L27.5 6 V15.5 C27.5 22.5 22.5 27.5 16 29.5 C9.5 27.5 4.5 22.5 4.5 15.5 V6 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* inner spark — a stylized ember mark */}
      <path
        d="M16 9 C18 12 19 14 18.5 16 C18 18 16 19 16 22 C16 19 14 18 13.5 16 C13 14 14 12 16 9 Z"
        fill={fill}
      />
    </svg>
  );
}
