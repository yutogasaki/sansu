import { useEffect, useRef, type RefObject } from 'react';
import type { PokomokoInputCue } from './usePokomokoFeedback';
import './PokomokoLearningEffects.css';

const ease = (n: number) => 1 - (1 - n) ** 3;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
type Point = { x: number; y: number };
const between = (a: Point, b: Point, k: number): Point => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k) });

// Split the same quadratic for both the ink and tile: its visible tip always
// stays under the accepted digit, including while the actual hand is moving.
function curve(from: Point, to: Point, k: number, bend: number) {
    const control = { x: (from.x + to.x) / 2 + bend, y: (from.y + to.y) / 2 - 38 };
    const partialControl = between(from, control, k);
    const tip = between(partialControl, between(control, to, k), k);
    return { tip, path: `M ${from.x} ${from.y} Q ${partialControl.x} ${partialControl.y} ${tip.x} ${tip.y}` };
}

/** Only the accepted digit travels; this overlay never owns input or grading. */
export function PokomokoInputSpark({ cue, root }: { cue?: PokomokoInputCue; root: RefObject<HTMLElement | null> }) {
    const layer = useRef<HTMLSpanElement>(null);
    const tile = useRef<HTMLSpanElement>(null);
    const trail = useRef<SVGPathElement>(null);
    const underlay = useRef<SVGPathElement>(null);
    const keyMarks = useRef<SVGGElement>(null);
    const landingMarks = useRef<SVGGElement>(null);
    useEffect(() => {
        if (!cue || !tile.current || !root.current || !layer.current) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0;
        const hide = () => {
            cancelAnimationFrame(frame);
            if (layer.current) layer.current.style.opacity = '0';
        };
        if (reduced.matches || document.hidden) { hide(); return; }
        layer.current.style.opacity = '0';
        const animate = () => {
            if (!tile.current || !root.current || document.hidden || reduced.matches) { hide(); return; }
            if (root.current.querySelector('.island-answer')?.getAttribute('data-problem-id') !== cue.problemId) { hide(); return; }
            if (layer.current) layer.current.style.opacity = '1';
            const age = Math.max(0, performance.now() - cue.startedAt);
            const panel = root.current.getBoundingClientRect();
            const hand = root.current.querySelector('.pokomoko-hand-anchor')?.getBoundingClientRect();
            const paw = {
                x: hand ? hand.left + hand.width / 2 - panel.left : cue.destinationX,
                y: hand ? hand.top + hand.height / 2 - panel.top : cue.destinationY,
            };
            const first = curve({ x: cue.fromX, y: cue.fromY }, paw, age < 150 ? ease(age / 150) : 1, -32);
            const k = Math.min(1, Math.max(0, (age - 150) / 150)) ** 2;
            const second = curve(paw, { x: cue.x, y: cue.y }, k, 28);
            const tip = age < 150 ? first.tip : second.tip;
            const path = first.path + (age >= 150 ? ` ${second.path}` : '');
            trail.current?.setAttribute('d', path);
            underlay.current?.setAttribute('d', path);
            const fade = age > 300 ? Math.max(0, 1 - (age - 300) / 65) : 1;
            if (trail.current) trail.current.style.opacity = String(fade * .8);
            if (underlay.current) underlay.current.style.opacity = String(fade * .7);
            if (keyMarks.current) keyMarks.current.style.opacity = String(Math.max(0, 1 - age / 150));
            if (landingMarks.current) landingMarks.current.style.opacity = String(age < 270 ? 0 : Math.min(1, (age - 270) / 30) * fade);
            tile.current.style.transform = `translate(${tip.x}px,${tip.y}px) rotate(${Math.sin((age < 150 ? age / 150 : k) * Math.PI) * -10}deg)`;
            tile.current.style.opacity = String(fade);
            if (age < 365) frame = requestAnimationFrame(animate);
            else hide();
        };
        const cancelWhenHidden = () => { if (document.hidden) hide(); };
        const cancelWhenReduced = () => { if (reduced.matches) hide(); };
        document.addEventListener('visibilitychange', cancelWhenHidden);
        reduced.addEventListener('change', cancelWhenReduced);
        frame = requestAnimationFrame(animate);
        return () => {
            hide();
            document.removeEventListener('visibilitychange', cancelWhenHidden);
            reduced.removeEventListener('change', cancelWhenReduced);
        };
    }, [cue, root]);
    if (!cue) return null;
    return <span key={cue.id} ref={layer} className="pokomoko-input-sparks pokomoko-handoff" aria-hidden="true">
        <svg className="pokomoko-handoff-ink" aria-hidden="true">
            <path ref={underlay} className="pokomoko-handoff-underlay" />
            <path ref={trail} className="pokomoko-handoff-trail" />
            <g ref={keyMarks} className="pokomoko-handoff-marks" transform={`translate(${cue.fromX} ${cue.fromY})`}>
                <path d="M -22 -9 l -7 -3 M -14 -22 l -3 -7 M 10 -23 l 3 -7" />
            </g>
            <g ref={landingMarks} className="pokomoko-handoff-marks pokomoko-handoff-landing" transform={`translate(${cue.x} ${cue.y})`}>
                <path d="M -25 -5 l -8 -3 M -24 9 l -8 4 M 25 -5 l 8 -3 M 24 9 l 8 4" />
            </g>
        </svg>
        <span key={cue.id} ref={tile} className="pokomoko-input-flight">{cue.digit}</span>
    </span>;
}
