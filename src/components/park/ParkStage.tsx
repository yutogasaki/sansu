import { useReducedMotion } from 'framer-motion';
import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { simulateCourse, type PlayBeat } from '../../domain/park/simulation';
import type { PartKind } from '../../domain/park/types';
import { ParkSprite, PARK_ART_CANDIDATE } from './PartArt';
import { playParkBell } from '../../utils/audio';
import { BEAT_MS, beatDuration } from './playback';
import { threeParkRequested, supportsThreePark } from './three/config';
import { depth, project, sampleParkBeat, slotX } from './sceneGeometry';

const THREE_WIDTH = 730;
const viewWidth = (length: number) => THREE_WIDTH + Math.max(0, length - 3) * 1.5 * Math.cos(25 * Math.PI / 180) * 120;

function AnimatedScene({ layout, beat, reduced, preview }: { layout: (PartKind | null)[]; beat?: PlayBeat; reduced: boolean; preview: boolean }) {
    const [progress, setProgress] = useState(0);
    const duration = beat ? (beat.action === 'walk' ? beatDuration(beat) : BEAT_MS) : 0;
    useEffect(() => {
        if (!duration) return;
        const start = performance.now();
        let frame = 0;
        const tick = () => {
            const t = Math.min(1, (performance.now() - start) / duration);
            setProgress(t);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [duration]);
    const state = sampleParkBeat(layout, beat, progress);
    const movement = reduced ? sampleParkBeat(layout, beat, 1) : state;
    const point = project(movement.point), ground = project({ ...movement.point, z: 0 });
    const layers: { id: string; depth: number; node: ReactNode }[] = [];
    for (const [i, kind] of layout.entries()) {
        if (!kind) continue;
        const world = { x: i * 1.5, y: 0, z: 0 }, p = project(world);
        const compressed = !reduced && kind === 'trampoline' && (beat?.action === 'jump' || beat?.action === 'hop')
            && ((beat.from === i && progress < .12) || (beat.to === i && progress >= .85 && progress < 1));
        layers.push({ id: `${i}-back`, depth: depth(world) - .2, node: <ParkSprite name={compressed ? 'trampoline-compressed' : `${kind}-back`} x={p.x} y={p.y} /> });
        if (kind === 'slide' || kind === 'bubble' || kind === 'paint') {
            layers.push({ id: `${i}-front`, depth: depth(world) + .23, node: <ParkSprite name={`${kind}-front`} x={p.x} y={p.y} /> });
        }
    }
    const actorDepth = depth(movement.point);
    if (state.bubble) layers.push({ id: 'bubble-back', depth: actorDepth - .01, node: <ParkSprite name="bubble-fx-back" x={point.x} y={point.y} /> });
    layers.push({ id: 'actor', depth: actorDepth, node: <g data-toy-action={beat?.action ?? 'ready'} data-bubble-popped={state.popped}
        data-world-x={movement.point.x} data-world-z={movement.point.z} data-bubble-visible={state.bubble} data-pose={movement.pose} data-progress={progress}>
        <ParkSprite name={`actor-${state.pink ? 'pink' : 'violet'}-${movement.pose}`} x={point.x} y={point.y} />
    </g> });
    if (state.bubble) layers.push({ id: 'bubble-front', depth: actorDepth + .01, node: <g className={state.bubblePink ? 'park-pink-bubble' : undefined}>
        <ParkSprite name="bubble-fx-front" x={point.x} y={point.y} />
    </g> });
    const paths = simulateCourse(layout).filter(b => b.action === 'jump');
    return <>
        <ParkSprite name={`base-${layout.length}`} />
        {layout.map((kind, i) => {
            const p = project({ x: i * 1.5, y: 0, z: 0 });
            return kind ? <ParkSprite key={i} name={`${kind}-shadow`} x={p.x} y={p.y} />
                : <ellipse key={i} cx={p.x} cy={p.y} rx="37" ry="12" fill="none" stroke="#65795e" strokeOpacity=".4" strokeWidth="2" strokeDasharray="3 7" />;
        })}
        <ellipse cx={ground.x} cy={ground.y} rx={20 + movement.point.z * 3} ry="5" fill="#506245" opacity={.22 / (1 + movement.point.z)} />
        {[...layers].sort((a, b) => a.depth - b.depth).map(layer => <g key={layer.id}>{layer.node}</g>)}
        {beat?.action === 'bell' && progress > .35 && <g transform={`translate(${project({ x: slotX(beat.to, layout.length), y: .3, z: .86 }).x},${project({ x: slotX(beat.to, layout.length), y: .3, z: .86 }).y})`} stroke="#c19636" strokeWidth="3" fill="none">
            <path d="M-25-6l-10-9M25-6l10-9M-28 8h-12M28 8h12" />
        </g>}
        {state.popped && <g transform={`translate(${point.x},${point.y - 62})`} fill="none" stroke={state.bubblePink ? '#e4a1b4' : '#86bcbc'} strokeWidth="2.5" opacity=".9">
            <path d="M-61-14l-10-4M63-18l10-5M-28-57l-4-10M33-55l5-9M-27 56l-5 9M36 49l7 8" />
            <circle cx="-48" cy="-42" r="5" /><circle cx="56" cy="33" r="4" />
        </g>}
        {(preview || reduced) && paths.map((path, i) => {
            const samples = Array.from({ length: 33 }, (_, j) => project(sampleParkBeat(layout, path, .12 + j / 32 * .73).point));
            return <path key={i} d={samples.map((p, j) => `${j ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} stroke="#58736c" opacity=".4" strokeDasharray="4 9" strokeWidth="2" fill="none" />;
        })}
    </>;
}

function LegacyParkStage({ layout, beat, preview = false, sound = false }: { layout: (PartKind | null)[]; beat?: PlayBeat; preview?: boolean; sound?: boolean }) {
    const reduced = Boolean(useReducedMotion());
    const viewport = useRef<HTMLDivElement>(null);
    const width = viewWidth(layout.length);
    useEffect(() => {
        if (sound && beat?.action === 'bell') return playParkBell();
    }, [sound, beat?.action, beat?.to]);
    useEffect(() => {
        const element = viewport.current;
        if (!element || !beat || layout.length <= 3) return;
        const destination = project({ x: slotX(beat.to, layout.length), y: 0, z: 0 });
        const scale = element.clientWidth / THREE_WIDTH;
        // Bring the landing place into view at takeoff, preserving the actor's scale.
        element.scrollTo({ left: (destination.x + 185) * scale - element.clientWidth * .72, behavior: reduced ? 'instant' : 'smooth' });
    }, [beat?.to, beat?.action, beat, layout.length, reduced]);
    return <div className="park-stage" data-art-candidate={PARK_ART_CANDIDATE}>
        <div className="park-stage-viewport" ref={viewport}>
            <svg viewBox={`-185 -505 ${width} ${615 + Math.max(0, layout.length - 3) * 20}`} style={{ width: `${width / THREE_WIDTH * 100}%` }} role="img" aria-label={beat?.caption ?? 'すべりだいから ゴールへ つながる コース'}>
                <AnimatedScene key={beat ? `${beat.from}:${beat.to}:${beat.action}` : `ready:${layout.join(',')}`} layout={layout} beat={beat} reduced={reduced} preview={preview} />
            </svg>
        </div>
        {layout.length > 3 && <div className="park-pan-controls" aria-label="コースの みる ばしょ">
            <button onClick={() => viewport.current?.scrollBy({ left: -220, behavior: reduced ? 'instant' : 'smooth' })} aria-label="ひだりを みる">←</button>
            <span>よこへ うごかして みよう</span>
            <button onClick={() => viewport.current?.scrollBy({ left: 220, behavior: reduced ? 'instant' : 'smooth' })} aria-label="みぎを みる">→</button>
        </div>}
        <p className="park-stage-caption" aria-live="polite">{beat?.caption ?? (preview ? 'てんせんは ジャンプの みち' : 'ならべて、うごかしてみよう')}</p>
    </div>;
}


const ThreeParkStage = lazy(() => import('./three/ThreeParkStage'));
type StageProps = Parameters<typeof LegacyParkStage>[0];
class StageBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function ParkStage(props: StageProps) {
    const [failed, setFailed] = useState(false);
    const fail = useCallback(() => setFailed(true), []);
    const fallback = <LegacyParkStage {...props} />;
    if (!threeParkRequested() || !supportsThreePark(props.layout) || failed) return fallback;
    return <StageBoundary fallback={fallback}>
        <Suspense fallback={fallback}><ThreeParkStage layout={props.layout} beat={props.beat} compact={props.preview} onFailure={fail} /></Suspense>
    </StageBoundary>;
}
