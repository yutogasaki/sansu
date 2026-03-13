import { useCallback, useEffect, useRef } from "react";

export const useTimeoutScheduler = () => {
    const timeoutIdsRef = useRef<number[]>([]);

    const clearScheduledTimeouts = useCallback(() => {
        timeoutIdsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
        timeoutIdsRef.current = [];
    }, []);

    const scheduleTimeout = useCallback((callback: () => void, delayMs: number) => {
        const timeoutId = window.setTimeout(() => {
            timeoutIdsRef.current = timeoutIdsRef.current.filter(id => id !== timeoutId);
            callback();
        }, delayMs);

        timeoutIdsRef.current.push(timeoutId);
        return timeoutId;
    }, []);

    useEffect(() => clearScheduledTimeouts, [clearScheduledTimeouts]);

    return {
        scheduleTimeout,
        clearScheduledTimeouts,
    };
};
