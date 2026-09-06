import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { PartKind } from '../../../domain/park/types';
import type { PlayBeat } from '../../../domain/park/simulation';
import { THREE_PARK_CANDIDATE } from './config';
import { sampleToy, threeBeatDuration } from './choreography';
import { createToyScene } from './scene';

type Runtime = ReturnType<typeof createToyScene>;
export default function ThreeParkStage({ layout, beat, compact = false, onFailure }: {
    layout: (PartKind | null)[]; beat?: PlayBeat; compact?: boolean; onFailure: () => void;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const runtime = useRef<Runtime | null>(null);
    const playback = useRef({ beat, start: 0 });
    const repaint = useRef<() => void>(() => {});
    const reduced = Boolean(useReducedMotion());
    const layoutKey = JSON.stringify(layout);
    const beatKey = beat ? `${beat.from}:${beat.to}:${beat.action}` : 'ready';
    useEffect(() => {
        const element = canvas.current;
        if (!element) return;
        let scene: Runtime | undefined, raf = 0, disposed = false, inView = true;
        const course: (PartKind | null)[] = JSON.parse(layoutKey);
        const fail = () => { if (!disposed) { cancelAnimationFrame(raf); onFailure(); } };
        const contextLost = (event: Event) => { event.preventDefault(); fail(); };
        element.addEventListener('webglcontextlost', contextLost);
        try {
            scene = createToyScene(element, course); runtime.current = scene;
        } catch { fail(); }
        const draw = () => {
            if (!scene || disposed || document.hidden || !inView) return;
            const current = playback.current;
            const progress = !current.beat ? 0 : reduced ? 1 : Math.min(1, (performance.now() - current.start) / threeBeatDuration(current.beat));
            const frame = sampleToy(course, current.beat, progress);
            try {
                const info = scene.draw(frame);
                // Semantic state and measurable render counters; no gameplay writes or callbacks.
                Object.assign(element.dataset, { toyAction: current.beat?.action ?? 'ready', pose: frame.pose, progress: String(progress),
                    worldX: String(frame.point.x), worldY: String(frame.point.y), bubbleVisible: String(frame.bubble),
                    bubblePopped: String(Boolean(current.beat?.popped && progress >= .76)),
                    frames: String(info.frames), actorPixels: String(info.actorPixels),
                    renderInfo: import.meta.env.DEV ? JSON.stringify(info) : '',
                });
            } catch { fail(); return; }
            if (current.beat && progress < 1 && !reduced) raf = requestAnimationFrame(draw);
        };
        const requestDraw = () => { cancelAnimationFrame(raf); draw(); };
        repaint.current = requestDraw;
        const resize = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            if (width && height && scene && !disposed) { scene.resize(width, height, compact); requestDraw(); }
        });
        const visibility = () => requestDraw();
        const intersection = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; requestDraw(); });
        resize.observe(element); intersection.observe(element);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            disposed = true; cancelAnimationFrame(raf); repaint.current = () => {};
            resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibility);
            element.removeEventListener('webglcontextlost', contextLost);
            scene?.dispose(); runtime.current = null;
        };
    }, [layoutKey, reduced, onFailure, compact]);
    useEffect(() => {
        playback.current = { beat, start: performance.now() };
        repaint.current();
        // Simulation beats are recreated by React; only a semantic boundary restarts acting.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [beatKey, layoutKey]);
    return <div className="park-stage park-three-stage" data-art-candidate={THREE_PARK_CANDIDATE} data-renderer="three">
        <canvas ref={canvas} className="park-three-canvas" role="img" aria-label={beat?.caption ?? 'すべりだいと トランポリン。ならべて あそべる ちいさな ゆうえんち'} />
        <p className="park-stage-caption" aria-live="polite">{beat?.caption ?? 'ならべて、うごかしてみよう'}</p>
    </div>;
}
