import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  colorTint?: "white" | "gray" | "blue" | "emerald" | "amber" | "rose" | "purple";
  interactive?: boolean;
}

export function Card({
  className,
  colorTint = "white",
  interactive = false,
  children,
  ...props
}: CardProps) {
  const tintStyles = {
    white: "bg-white",
    gray: "bg-[#F3F4F6]",
    blue: "bg-[#EFF6FF]",
    emerald: "bg-[#ECFDF5]",
    amber: "bg-[#FFFBEB]",
    rose: "bg-[#FFF1F2]",
    purple: "bg-[#FAF5FF]",
  };

  return (
    <div
      className={cn(
        "rounded-lg p-6 transition-all duration-200",
        tintStyles[colorTint],
        interactive && "cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-bold text-gray-900 tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-gray-500", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}
