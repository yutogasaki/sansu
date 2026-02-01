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
                    "rounded-3xl bg-white",
                    variant === "default" && "shadow-sm border border-slate-100",
                    variant === "flat" && "border-2 border-slate-100",
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = "Card";
