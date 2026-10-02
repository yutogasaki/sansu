import React from "react";
import { cn } from "../../utils/cn";
import { Button } from "./Button";
import { BookOpen } from 'lucide-react';

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
                "app-empty flex flex-col items-center justify-center gap-3 p-6",
                fullScreen && "h-full",
                className
            )}
        >
            <div className="app-empty-symbol w-12 h-12 flex items-center justify-center" aria-hidden="true">
                <BookOpen size={30} strokeWidth={1.5} />
            </div>
            <p className="text-pokomoko-muted font-bold text-center">{message}</p>
            {description && (
                <p className="text-pokomoko-muted text-sm text-center">{description}</p>
            )}
            {actionLabel && onAction && (
                <Button onClick={onAction} size="lg" className="mt-2">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};
