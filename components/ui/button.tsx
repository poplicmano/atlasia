"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        accent: "bg-accent text-white shadow-soft hover:bg-accent-hover active:translate-y-px",
        default: "bg-ink text-background hover:bg-white active:translate-y-px",
        secondary: "border border-surface-border bg-surface-raised text-ink hover:border-ink-subtle hover:bg-surface-muted",
        outline: "border border-surface-border bg-transparent text-ink-muted hover:border-accent-border hover:bg-accent-soft hover:text-ink",
        ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
        danger: "border border-red-900/70 bg-red-950/40 text-red-200 hover:bg-red-950/70",
        link: "text-[#cf8b95] underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-9 w-9 p-0"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
