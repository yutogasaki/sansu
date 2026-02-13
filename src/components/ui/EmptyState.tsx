import React from "react";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

interface EmptyStateProps {
    /** Main message */
    message: string;
    /** Optional sub-message */
    description?: string;
    /** Action button label */
    actionLabel?: string;
    /** Action button handler */
    onAction?: () => void;
    /** Fill parent container */
    fullScreen?: boolean;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    message,
    description,
    actionLabel,
    onAction,
    fullScreen = false,
    className,
}) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-3 p-6",
                fullScreen && "h-full",
                className
            )}
        >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <div className="w-6 h-1.5 rounded-full bg-slate-300" />
            </div>
            <p className="text-slate-500 font-bold text-center">{message}</p>
            {description && (
                <p className="text-slate-400 text-sm text-center">{description}</p>
            )}
            {actionLabel && onAction && (
                <Button onClick={onAction} size="lg" className="mt-2">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};
