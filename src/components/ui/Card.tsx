import React from "react";
import { cn } from "../../utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "flat";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-[20px]",
                    variant === "default" && "card-surface",
                    variant === "flat" && "glass-light shadow-[var(--shadow-sm)]",
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = "Card";
