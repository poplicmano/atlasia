import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em]",
  {
    variants: {
      variant: {
        default: "border-surface-border bg-surface-muted text-ink-muted",
        outline: "border-surface-border bg-transparent text-ink-muted",
        accent: "border-accent-border bg-accent-soft text-[#d9a0aa]",
        success: "border-emerald-900/70 bg-emerald-950/40 text-emerald-300",
        warning: "border-amber-900/70 bg-amber-950/40 text-amber-300",
        danger: "border-red-900/70 bg-red-950/40 text-red-300"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
