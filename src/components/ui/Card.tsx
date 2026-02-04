import React from "react";
import { cn } from "../../utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "flat";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-[2rem] bg-surface",
                    variant === "default" && "shadow-sm border border-slate-50/50",
                    variant === "flat" && "border border-slate-100 bg-transparent",
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = "Card";
