import React from "react";
import { cn } from "../../utils/cn";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "primary" | "neutral" | "success" | "warning";
}

export const Badge: React.FC<BadgeProps> = ({
    className,
    variant = "neutral",
    ...props
}) => {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
                variant === "primary" && "border-teal-100 bg-teal-50/90 text-teal-700",
                variant === "neutral" && "border-white/80 bg-white/72 text-slate-600",
                variant === "success" && "border-emerald-100 bg-emerald-50/92 text-emerald-700",
                variant === "warning" && "border-amber-100 bg-amber-50/92 text-amber-700",
                className
            )}
            {...props}
        />
    );
};
