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
                    "inline-flex items-center justify-center rounded-[14px] font-bold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2BBAA0]/30 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation",
                    variant === "primary" &&
                    "border-0 bg-[linear-gradient(135deg,#2BBAA0,#24A08A)] text-white shadow-[0_6px_20px_rgba(43,186,160,0.4),0_2px_8px_rgba(43,186,160,0.2)] hover:brightness-[1.02]",
                    variant === "secondary" &&
                    "border border-white/40 bg-white/70 text-slate-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-white/80",
                    variant === "ghost" &&
                    "bg-transparent text-slate-500 hover:bg-white/45",
                    variant === "icon" &&
                    "aspect-square rounded-full border-0 bg-[#F0F3F5] p-0 text-slate-700 shadow-sm hover:bg-white",

                    size === "sm" && (variant === "icon" ? "h-10 w-10 text-sm" : "h-10 px-4 text-sm"),
                    size === "md" && (variant === "icon" ? "h-11 w-11 text-sm" : "h-11 px-5 text-sm"),
                    size === "lg" && (variant === "icon" ? "h-12 w-12 text-base" : "h-12 px-6 text-base"),
                    size === "xl" && (variant === "icon" ? "h-12 w-12 text-base" : "h-12 w-full text-base"),

                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = "Button";
