import React from "react";
import { cn } from "../../utils/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "icon";
    size?: "sm" | "md" | "lg" | "xl";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-2xl font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none touch-manipulation active:scale-95",
                    // Variants
                    variant === "primary" &&
                    "bg-yellow-200 text-yellow-900 hover:bg-yellow-300 shadow-sm border border-yellow-300/50",
                    variant === "secondary" &&
                    "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm",
                    variant === "ghost" &&
                    "bg-transparent text-slate-500 hover:bg-slate-100",
                    variant === "icon" &&
                    "p-2 rounded-full hover:bg-slate-100 text-slate-500",

                    // Sizes
                    size === "sm" && "h-10 px-4 text-sm",
                    size === "md" && "h-12 px-6 text-base",
                    size === "lg" && "h-14 px-8 text-lg",
                    size === "xl" && "h-20 text-2xl w-full", // For big options

                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = "Button";
