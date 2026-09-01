import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, label, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            "w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-[#111827] text-sm placeholder:text-gray-400 font-medium transition-all duration-200 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[#EF4444] focus:border-[#EF4444]",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs font-semibold text-[#EF4444]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
