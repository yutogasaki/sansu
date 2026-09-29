import React, { useEffect, useState } from "react";
import { cn } from "../../utils/cn";
import { IslandToyIcon } from '../island/IslandToyIcon';
import './Spinner.css';

interface SpinnerProps {
    /** Message below the spinner */
    message?: string;
    /** Fill the parent container and center */
    fullScreen?: boolean;
    className?: string;
    overlay?: boolean;
    destination?: 'island' | 'house' | 'learning' | 'records';
}

export const Spinner: React.FC<SpinnerProps> = ({
    message = "じゅんびちゅう...",
    fullScreen = false,
    className,
    overlay = false,
    destination = 'island',
}) => {
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setSlow(true), 8000);
        return () => window.clearTimeout(timer);
    }, []);
    return (
        <div
            className={cn('app-loading', fullScreen && 'app-loading--full', overlay && 'app-loading--overlay', className)}
            role="status" aria-live="polite" data-loading-state="pending" data-loading-candidate="poko-loading-v1"
        >
            <div className="app-loading__badge" aria-hidden="true">
                <IslandToyIcon kind={destination === 'house' ? 'house' : destination === 'records' ? 'album' : destination === 'learning' ? 'find' : 'island'} size={54} />
                <span className="app-loading__orbit" />
            </div>
            {message && <p className="app-loading__message">{message}</p>}
            {slow && <p className="app-loading__slow">すこし じかんが かかっているよ</p>}
        </div>
    );
};
