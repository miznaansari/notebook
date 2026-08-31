import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "purple"
    | "outline";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-[#F3F4F6] text-[#111827]",
    primary: "bg-[#DBEAFE] text-[#1D4ED8]",
    secondary: "bg-[#E5E7EB] text-[#374151]",
    success: "bg-[#D1FAE5] text-[#065F46]",
    warning: "bg-[#FEF3C7] text-[#92400E]",
    danger: "bg-[#FEE2E2] text-[#991B1B]",
    purple: "bg-[#F3E8FF] text-[#6B21A8]",
    outline: "border-2 border-[#111827] text-[#111827] bg-transparent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
