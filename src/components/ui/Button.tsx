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
                    "inline-flex items-center justify-center rounded-full font-bold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation",
                    // Variants
                    variant === "primary" &&
                    "text-white bg-gradient-to-b from-teal-500 to-cyan-600 shadow-[0_10px_20px_-10px_rgba(8,145,178,0.55)] hover:from-teal-500 hover:to-cyan-500 active:shadow-[0_4px_10px_-8px_rgba(8,145,178,0.65)]",
                    variant === "secondary" &&
                    "bg-white/90 text-text-main border border-white/80 hover:bg-white shadow-[0_8px_16px_-12px_rgba(15,23,42,0.35)]",
                    variant === "ghost" &&
                    "bg-transparent text-text-sub hover:bg-slate-100/70",
                    variant === "icon" &&
                    "p-2 rounded-full hover:bg-white/75 text-text-sub",

                    // Sizes
                    size === "sm" && "h-10 px-4 text-sm",
                    size === "md" && "h-12 px-6 text-base",
                    size === "lg" && "h-14 px-8 text-lg",
                    size === "xl" && "h-16 text-xl w-full", // For big options

                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = "Button";
