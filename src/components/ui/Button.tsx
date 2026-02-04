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
                    "inline-flex items-center justify-center rounded-full font-bold transition-transform active:scale-95 focus:outline-none disabled:opacity-50 disabled:pointer-events-none touch-manipulation",
                    // Variants
                    variant === "primary" &&
                    "bg-[#483D8B] text-white hover:opacity-90 shadow-[0_4px_0_0_rgba(72,61,139,0.4)] active:shadow-none translate-y-0 active:translate-y-[2px]",
                    variant === "secondary" &&
                    "bg-white text-text-main border-2 border-slate-100 hover:bg-slate-50 shadow-sm",
                    variant === "ghost" &&
                    "bg-transparent text-text-sub hover:bg-slate-100",
                    variant === "icon" &&
                    "p-2 rounded-full hover:bg-slate-100 text-text-sub",

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
