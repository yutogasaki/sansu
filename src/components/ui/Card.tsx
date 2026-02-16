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
                    "rounded-[2rem]",
                    variant === "default" && "app-glass",
                    variant === "flat" && "border border-[var(--app-border-soft)] bg-white/36 backdrop-blur-sm",
                    className
                )}
                {...props}
            />
        );
    }
);

Card.displayName = "Card";
