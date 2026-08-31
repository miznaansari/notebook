import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "emerald" | "amber";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 select-none outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";

    const variantStyles = {
      primary: "bg-[#3B82F6] hover:bg-[#2563EB] text-white hover:scale-105 active:scale-95",
      secondary: "bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] hover:scale-105 active:scale-95",
      outline: "border-4 border-[#3B82F6] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white hover:scale-105 active:scale-95",
      ghost: "bg-transparent hover:bg-[#F3F4F6] text-[#111827] hover:scale-105 active:scale-95",
      danger: "bg-[#EF4444] hover:bg-[#DC2626] text-white hover:scale-105 active:scale-95",
      emerald: "bg-[#10B981] hover:bg-[#059669] text-white hover:scale-105 active:scale-95",
      amber: "bg-[#F59E0B] hover:bg-[#D97706] text-white hover:scale-105 active:scale-95",
    };

    const sizeStyles = {
      sm: "h-9 px-3 text-xs uppercase tracking-wider",
      md: "h-11 px-5 text-sm",
      lg: "h-14 px-8 text-base",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
