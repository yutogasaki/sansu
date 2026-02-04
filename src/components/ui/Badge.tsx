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
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold",
                variant === "primary" && "bg-primary/10 text-primary",
                variant === "neutral" && "bg-slate-100 text-slate-600",
                variant === "success" && "bg-green-100 text-green-700",
                variant === "warning" && "bg-orange-100 text-orange-700",
                className
            )}
            {...props}
        />
    );
};
