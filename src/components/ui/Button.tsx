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
                    `app-button app-button--${variant}`,
                    "inline-flex items-center justify-center rounded-[14px] font-bold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pokomoko-blue)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation",
                    variant === "primary" &&
                    "border border-[var(--pokomoko-blue-deep)] bg-[var(--pokomoko-blue)] text-white shadow-[0_3px_0_var(--pokomoko-blue-deep)] hover:brightness-[1.02]",
                    variant === "secondary" &&
                    "border border-[var(--pokomoko-edge)] bg-[var(--pokomoko-paper)] text-[var(--pokomoko-ink)] hover:bg-[var(--pokomoko-canvas)]",
                    variant === "ghost" &&
                    "bg-transparent text-[var(--pokomoko-muted)] hover:bg-[var(--pokomoko-canvas)]",
                    variant === "icon" &&
                    "aspect-square rounded-full border border-[var(--pokomoko-edge)] bg-[var(--pokomoko-paper)] p-0 text-[var(--pokomoko-ink)] hover:bg-[var(--pokomoko-canvas)]",

                    size === "sm" && (variant === "icon"
                        ? "h-11 w-11 min-h-11 min-w-11 text-sm"
                        : "min-h-11 px-4 text-sm"),
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
