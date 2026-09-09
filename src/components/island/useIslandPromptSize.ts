import { useLayoutEffect, useRef } from 'react';

/** Enlarge the reading content only; keep the answer controls in their grid. */
export function useIslandPromptSize(contentKey: unknown) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const prompt = ref.current;
        const question = prompt?.closest<HTMLElement>('.park-question');
        if (!prompt || !question) return;
        const landscape = window.matchMedia('(min-width: 900px) and (orientation: landscape)');
        const reset = () => {
            prompt.style.removeProperty('zoom');
            prompt.style.removeProperty('width');
        };
        const fit = () => {
            reset();
            // Choice layouts size their question from content; avoid a sizing loop.
            const choice = prompt.closest('[data-input-type=choice]');
            if ((choice && !landscape.matches) || !question.clientHeight) return;
            const style = getComputedStyle(question);
            const width = question.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
            const height = question.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2;
            if (width <= 0 || height <= 0) return;
            const apply = (scale: number) => {
                prompt.style.zoom = String(scale);
                prompt.style.width = `${width / scale}px`;
            };
            let baseHeight = Infinity;
            const symbolic = prompt.dataset.problemVisual === 'symbolic' && prompt.dataset.problemProse !== 'true';
            const fits = () => prompt.getBoundingClientRect().height <= height
                && prompt.scrollWidth <= prompt.clientWidth + 1
                && question.scrollHeight <= question.clientHeight + 1
                && (!symbolic || prompt.getBoundingClientRect().height <= baseHeight * Number(prompt.style.zoom) + 1);
            apply(1);
            if (!fits()) { reset(); return; }
            baseHeight = prompt.getBoundingClientRect().height;
            let low = 1;
            let high = 2;
            apply(high);
            if (fits()) return;
            // Measure wrapped text and fixed-size diagrams together, without
            // shrinking their original readable size or estimating from text.
            for (let step = 0; step < 7; step++) {
                const scale = (low + high) / 2;
                apply(scale);
                if (fits()) low = scale;
                else high = scale;
            }
            apply(low);
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(question);
        landscape.addEventListener('change', fit);
        let active = true;
        void document.fonts?.ready.then(() => { if (active) fit(); });
        return () => {
            active = false;
            observer.disconnect();
            landscape.removeEventListener('change', fit);
            reset();
        };
    }, [contentKey]);
    return ref;
}
