import { useEffect, useRef, type RefObject } from 'react';
import type { PokomokoInputCue } from './usePokomokoFeedback';

const ease = (n: number) => 1 - (1 - n) ** 3;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Only the accepted digit travels; this overlay never owns input or grading. */
export function PokomokoInputSpark({ cue, root }: { cue?: PokomokoInputCue; root: RefObject<HTMLElement | null> }) {
    const tile = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!cue || !tile.current || !root.current) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        if (reduced.matches) return;
        let frame = 0;
        const animate = () => {
            if (!tile.current || !root.current || document.hidden) return;
            if (root.current.querySelector('.island-answer')?.getAttribute('data-problem-id') !== cue.problemId) {
                tile.current.style.opacity = '0'; return;
            }
            const age = performance.now() - cue.startedAt;
            const panel = root.current.getBoundingClientRect();
            const hand = root.current.querySelector('.pokomoko-hand-anchor')?.getBoundingClientRect();
            const px = hand ? hand.left + hand.width / 2 - panel.left : cue.destinationX;
            const py = hand ? hand.top + hand.height / 2 - panel.top : cue.destinationY;
            const k = age < 150 ? ease(Math.min(1, age / 150)) : Math.min(1, (age - 150) / 150) ** 2;
            const x = age < 150 ? mix(cue.fromX, px, k) : mix(px, cue.x, k);
            const y = age < 150 ? mix(cue.fromY, py, k) - Math.sin(k * Math.PI) * 30 : mix(py, cue.y, k) - Math.sin(k * Math.PI) * 24;
            tile.current.style.transform = `translate(${x}px,${y}px) rotate(${Math.sin(k * Math.PI) * -10}deg)`;
            tile.current.style.opacity = age > 300 ? String(Math.max(0, 1 - (age - 300) / 65)) : '1';
            if (age < 365) frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [cue, root]);
    if (!cue) return null;
    return <span className="pokomoko-input-sparks" aria-hidden="true">
        <i key={`ring-${cue.id}`} className="pokomoko-input-spark" style={{ left: cue.x, top: cue.y }} />
        <span key={cue.id} ref={tile} className="pokomoko-input-flight">{cue.digit}</span>
    </span>;
}
