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
            aria-live="polite"
        >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full app-glass shadow-[0_18px_32px_-22px_rgba(15,23,42,0.34)]">
                <div className="absolute inset-[5px] rounded-full border-[3px] border-white/60" />
                <div className="absolute inset-[5px] rounded-full border-[3px] border-transparent border-r-cyan-300/40 border-t-cyan-600 animate-spin" />
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.35)]" />
            </div>
            {message && (
                <p className="app-pill px-3 py-1 text-sm font-bold text-slate-500">{message}</p>
            )}
        </div>
    );
};
