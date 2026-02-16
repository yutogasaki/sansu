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
                    "inline-flex items-center justify-center rounded-full font-bold transition-all duration-300 active:translate-y-[1px] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/65 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation",
                    // Variants
                    variant === "primary" &&
                    "text-white bg-[linear-gradient(140deg,#0ea5a4_0%,#0891b2_52%,#0284c7_100%)] shadow-[0_14px_24px_-16px_rgba(8,145,178,0.85)] hover:brightness-[1.03] active:shadow-[0_8px_12px_-10px_rgba(8,145,178,0.9)]",
                    variant === "secondary" &&
                    "bg-white/92 text-text-main border border-white/85 hover:bg-white shadow-[0_12px_22px_-18px_rgba(15,23,42,0.62)]",
                    variant === "ghost" &&
                    "bg-transparent text-text-sub hover:bg-white/50",
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
