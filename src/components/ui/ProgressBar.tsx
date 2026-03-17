import React from "react";
import { cn } from "../../utils/cn";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number; // 0 to 100
    max?: number;
    tone?: "primary" | "success" | "warning";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    className,
    value,
    max = 100,
    tone = "primary",
    ...props
}) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const fillClassName = {
        primary: "bg-[linear-gradient(90deg,#2BBAA0,#54CBB5)] shadow-[0_8px_18px_-12px_rgba(43,186,160,0.9)]",
        success: "bg-[linear-gradient(90deg,#34D399,#10B981)] shadow-[0_8px_18px_-12px_rgba(16,185,129,0.85)]",
        warning: "bg-[linear-gradient(90deg,#FBBF24,#F59E0B)] shadow-[0_8px_18px_-12px_rgba(245,158,11,0.85)]",
    }[tone];

    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={Math.min(max, Math.max(0, value))}
            className={cn(
                "app-track h-4 w-full overflow-hidden rounded-full p-0.5",
                className
            )}
            {...props}
        >
            <div
                className={cn("h-full rounded-full transition-all duration-500 ease-out", fillClassName)}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};
