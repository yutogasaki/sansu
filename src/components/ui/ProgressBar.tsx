import React from "react";
import { cn } from "../../utils/cn";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    value: number; // 0 to 100
    max?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    className,
    value,
    max = 100,
    ...props
}) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div
            className={cn("h-4 w-full bg-slate-100 rounded-full overflow-hidden", className)}
            {...props}
        >
            <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};
