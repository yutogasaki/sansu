import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { PokomokoBurst } from './usePokomokoFeedback';
import { learningActorFrames } from './learningActor/frame';
import './PokomokoFullscreenCelebration.css';

const colors = ['#ff79b9', '#1967ff', '#ffda43', '#55dfbf', '#aa8cf3'];
const duration = 1450;
const spread = (n: number) => ((n * 73 + 19) % 101) / 100;

/** Viewport presentation only. It has no input, timer, reward or storage authority. */
export function PokomokoFullscreenCelebration({ burst, root, level }: {
    burst?: PokomokoBurst; root: RefObject<HTMLElement | null>; level: number;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const ordinary = burst?.kind === 'answer';
    const peak = Boolean(burst && ['jump', 'ride', 'stamp', 'section'].includes(burst.kind));
    const big = burst?.kind === 'ride' || burst?.kind === 'stamp';
    const eligible = ordinary || peak;
    useEffect(() => {
        const surface = canvas.current, panel = root.current;
        if (!surface || !panel || !burst || !eligible) return;
        const context = surface.getContext('2d');
        if (!context) return;
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0, stopped = false;
        const actor = panel.querySelector('.pokomoko-learning-actor');
        const origin = actor?.getBoundingClientRect();
        const card = panel.querySelector('.park-question')?.getBoundingClientRect();
        const width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
        surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
        const cx = origin ? origin.left + origin.width / 2 : width / 2;
        const cy = origin ? origin.top + origin.height * .64 : height * .25;
        const count = big ? 88 : peak ? 48 : 10 + level * 6;
        const start = performance.now();
        const clear = () => {
            stopped = true; cancelAnimationFrame(frame);
            context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, surface.width, surface.height);
            surface.dataset.running = 'false';
        };
        const star = (x: number, y: number, radius: number, color: string, angle: number) => {
            context.save(); context.translate(x, y); context.rotate(angle); context.beginPath();
            for (let j = 0; j < 10; j++) {
                const r = j % 2 ? radius * .45 : radius, a = j * Math.PI / 5 - Math.PI / 2;
                context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            context.closePath(); context.fillStyle = color; context.fill();
            context.strokeStyle = '#111746'; context.lineWidth = 1.5; context.stroke(); context.restore();
        };
        const draw = (now: number) => {
            if (stopped || document.hidden || motion.matches) { clear(); return; }
            const t = Math.min(1, (now - start) / (ordinary ? 650 : burst.kind === 'section' ? 1150 : duration));
            context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
            surface.dataset.running = String(t < 1);
            const fade = Math.min(1, t * 12) * Math.min(1, (1 - t) * 4);
            const travel = 1 - (1 - t) ** 3;
            // A broad color wave expands beyond the worksheet, while its center
            // stays transparent. No white flash or movement of the input targets.
            if (peak) {
                context.globalAlpha = fade * .26;
                context.strokeStyle = big ? '#ffce36' : '#ff79b9';
                context.lineWidth = big ? 24 : 12;
                context.beginPath(); context.ellipse(cx, cy, Math.max(1, width * .85 * travel), Math.max(1, height * .9 * travel), 0, 0, Math.PI * 2); context.stroke();
            }
            context.globalAlpha = fade;
            for (let i = 0; i < count; i++) {
                const a = i * 2.39996;
                const reachX = (ordinary ? 100 : width * .75) * (.35 + spread(i) * .65);
                const reachY = (ordinary ? 90 : height * .85) * (.3 + spread(i + 7) * .7);
                const x = cx + Math.cos(a) * reachX * travel;
                const y = cy + Math.sin(a) * reachY * travel + t * t * height * (ordinary ? .06 : .25);
                const size = (peak ? 7 : 4) + spread(i + 3) * 6;
                if (i % 4 === 0) star(x, y, size, '#ffda43', a + t * 4);
                else {
                    context.save(); context.translate(x, y); context.rotate(a + t * 5);
                    context.fillStyle = colors[i % colors.length];
                    context.fillRect(-size / 2, -size / 3, size, Math.max(2, size * .7 * Math.abs(Math.cos(t * 9 + i))));
                    context.restore();
                }
            }
            if (big) {
                // Long ribbons come from both viewport edges, not the small stage.
                for (let i = 0; i < 6; i++) {
                    const left = i % 2 === 0, edge = left ? -30 : width + 30;
                    const end = edge + (left ? 1 : -1) * width * .82 * travel;
                    const y = height * (.12 + Math.floor(i / 2) * .25);
                    context.strokeStyle = '#111746'; context.lineWidth = 9; context.lineCap = 'round';
                    context.beginPath(); context.moveTo(edge, y + height * .3 * t);
                    context.quadraticCurveTo((edge + end) / 2, y - 110 * Math.sin(t * Math.PI), end, y + Math.sin(t * 5 + i) * 75);
                    context.stroke(); context.strokeStyle = colors[i % 5]; context.lineWidth = 6; context.stroke();
                }
                // Same rendered pose and saved outfit, copied at the render boundary.
                const sprite = actor && learningActorFrames.get(actor);
                if (sprite?.width) for (let i = 0; i < 6; i++) {
                    const left = i % 2 === 0;
                    const size = Math.min(112, width * .24);
                    const x = left ? width * (.06 + spread(i) * .1) : width * (.84 + spread(i) * .08);
                    const y = height * (.05 + i * .135) - Math.sin(t * Math.PI) * 60 + t * t * 80;
                    context.save(); context.translate(x, y); context.rotate(Math.sin(t * 6 + i) * .35);
                    context.drawImage(sprite, -size / 2, -size / 2, size, size * sprite.height / sprite.width);
                    context.restore();
                }
            }
            // The flower lives by the card's edge so it does not replace its numerals.
            if (peak && card) {
                const radius = Math.min(52, card.width * .13) * Math.min(1, t * 5);
                const x = card.right - radius * .45, y = card.top + radius * .6;
                context.save(); context.translate(x, y); context.rotate(-t * .5);
                for (let band = 0; band < 2; band++) {
                    context.beginPath();
                    for (let j = 0; j <= 120; j++) {
                        const a = j / 120 * Math.PI * 2, r = radius * (band ? .58 : 1 + .12 * Math.sin(a * 10));
                        context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                    context.strokeStyle = band ? '#ff79b9' : '#ffcb35'; context.lineWidth = 5; context.stroke();
                }
                context.restore();
            }
            context.globalAlpha = 1;
            if (t < 1) frame = requestAnimationFrame(draw); else clear();
        };
        const stop = () => { if (document.hidden || motion.matches) clear(); };
        document.addEventListener('visibilitychange', stop); motion.addEventListener('change', stop);
        window.addEventListener('resize', clear);
        frame = requestAnimationFrame(draw);
        return () => { clear(); document.removeEventListener('visibilitychange', stop); motion.removeEventListener('change', stop); window.removeEventListener('resize', clear); };
    }, [burst, eligible, ordinary, peak, big, root, level]);
    if (!eligible || typeof document === 'undefined') return null;
    return createPortal(<div className="pokomoko-screen-celebration" data-screen-burst={burst?.kind} aria-hidden="true">
        <canvas ref={canvas} />
        {burst?.kind === 'section' && <div key={burst.id} className="pokomoko-last-banner">ひかりを とどけた！</div>}
    </div>, document.body);
}
