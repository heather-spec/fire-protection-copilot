import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Restrained badges: subtle tinted backgrounds, slight border for definition,
// uppercase micro-letters so they read as data labels, not stickers.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider leading-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-foreground/15 bg-foreground/[0.04] text-foreground",
        secondary:
          "border-border bg-muted text-muted-foreground",
        outline:
          "border-border bg-transparent text-muted-foreground",
        success:
          "border-success/30 bg-success/10 text-success",
        warning:
          "border-warning/30 bg-warning/10 text-warning",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive",
        brand:
          "border-brand/30 bg-brand/10 text-brand",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// A status indicator that's even more minimal — just a dot + label.
export function StatusDot({
  tone = "neutral",
  label,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "destructive" | "brand";
  label: string;
  className?: string;
}) {
  const dot = {
    neutral: "bg-muted-foreground",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    brand: "bg-brand",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-foreground", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}
