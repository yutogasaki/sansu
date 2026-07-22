import { useEffect, useRef } from "react";

export const useExploreStageFocus = <T extends HTMLElement>() => {
    const ref = useRef<T>(null);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            ref.current?.focus({ preventScroll: true });
        });

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    return ref;
};
