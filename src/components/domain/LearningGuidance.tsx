import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { LearningGuidanceHost } from './learningGuidanceHost';
import { createPortal } from 'react-dom';

export function LearningGuidance({ children }: { children: ReactNode }) {
    const host = useContext(LearningGuidanceHost);
    const bubble = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const element = bubble.current;
        if (!host || !element) return;
        const reflow = () => {
            const space = parseFloat(getComputedStyle(host).getPropertyValue('--guidance-space'));
            host.dataset.expanded = String(element.getBoundingClientRect().height > space + 1);
        };
        const observer = new ResizeObserver(reflow);
        observer.observe(element); reflow();
        return () => { observer.disconnect(); delete host.dataset.expanded; };
    }, [host]);
    const text = <div className="written-guidance" aria-live="polite" aria-atomic="true">{children}</div>;
    return host ? createPortal(<div ref={bubble} className="island-learning-bubble">
        <svg className="island-learning-bubble-outline" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M40 4C20 4 15 13 15 30Q12 37 3 40Q10 47 17 44C18 66 27 76 49 76H165C188 76 196 64 196 42V33C196 12 186 4 165 4Z" />
        </svg>
        {text}
    </div>, host) : text;
}
