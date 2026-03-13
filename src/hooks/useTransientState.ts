import { useCallback, useEffect, useRef, useState } from "react";

export const useTransientState = <T,>(durationMs: number) => {
    const [value, setValue] = useState<T | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const showValue = useCallback((nextValue: T) => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
        }

        setValue(nextValue);
        timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            setValue(null);
        }, durationMs);
    }, [durationMs]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return [value, showValue] as const;
};
