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
                "app-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black tracking-[0.08em] text-slate-600",
                variant === "primary" && "border-cyan-100/90 bg-cyan-50/78 text-cyan-700",
                variant === "neutral" && "border-white/85 bg-white/66 text-slate-600",
                variant === "success" && "border-emerald-100/90 bg-emerald-50/78 text-emerald-700",
                variant === "warning" && "border-amber-100/90 bg-amber-50/82 text-amber-700",
                className
            )}
            {...props}
        />
    );
};
