import React from "react";
import { cn } from "../../utils/cn";

interface SpinnerProps {
    /** Message below the spinner */
    message?: string;
    /** Fill the parent container and center */
    fullScreen?: boolean;
    className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
    message = "じゅんびちゅう...",
    fullScreen = false,
    className,
}) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-4",
                fullScreen && "h-full",
                className
            )}
        >
            <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
            </div>
            {message && (
                <p className="text-slate-400 text-sm font-bold">{message}</p>
            )}
        </div>
    );
};
