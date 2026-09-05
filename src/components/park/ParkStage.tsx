import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { simulateCourse, type PlayBeat } from '../../domain/park/simulation';
import type { PartKind } from '../../domain/park/types';
import { PartShape, ToyDoll } from './PartArt';
import { playParkBell } from '../../utils/audio';
import { BEAT_MS, beatDuration } from './playback';
function MovingDoll({ beat, start, end, reduced, climb }: { beat?: PlayBeat; start: number; end: number; reduced: boolean; climb: boolean }) {
    const [landed, setLanded] = useState(false);
    useEffect(() => {
        if (!beat?.popped) return;
        const timer = window.setTimeout(() => setLanded(true), reduced ? 400 : BEAT_MS * .85);
        return () => window.clearTimeout(timer);
    }, [beat?.popped, reduced]);
    const slide = beat?.action === 'slide';
    const jump = beat?.action === 'jump' ? -145 : beat?.action === 'hop' ? -56 : 0;
    const xs = slide ? [start - 19, start + 5, end + 36] : [start, (start + end) / 2, end - (climb ? 19 : 0)];
    const ys = slide ? [155, 200, 246] : climb ? [246, 215, 155] : [246, 246 + jump, 246];
    return <motion.g data-toy-action={beat?.action ?? 'ready'} data-bubble-popped={Boolean(beat?.popped && landed)}
        initial={false} animate={{ x: reduced ? xs[2] : xs, y: reduced ? ys[2] : ys }}
        transition={{ duration: reduced ? 0 : (beat?.action === 'walk' ? beatDuration(beat) : BEAT_MS) / 1000 * .85, times: [0, .5, 1], ease: 'easeInOut' }}>
        <ToyDoll pink={beat?.pink ?? false} bubble={beat?.bubble ?? false} bubblePink={beat?.bubblePink ?? false} popped={beat?.popped && landed} />
    </motion.g>;
}
export function ParkStage({ layout, beat, preview = false, sound = false }: { layout: (PartKind | null)[]; beat?: PlayBeat; preview?: boolean; sound?: boolean }) {
    const reduced = useReducedMotion();
    const width = 160 + layout.length * 120;
    const x = (position: number) => position < 0 ? 36 : 80 + position * 120;
    const start = beat ? x(beat.from) + (beat.action === 'walk' && layout[beat.from] === 'slide' ? 36 : 0) : 36;
    const end = beat ? x(beat.to) : 36;
    const paths = simulateCourse(layout).filter(b => b.action === 'jump');
    useEffect(() => {
        if (sound && beat?.action === 'bell') return playParkBell();
    }, [sound, beat?.action, beat?.to]);
    return <div className="park-stage">
        <svg viewBox={`0 0 ${width} 320`} role="img" aria-label={beat?.caption ?? 'すべりだいから ゴールへ つながる コース'}>
            <path d={`M0 78Q${width * .2} 11 ${width * .4} 69T${width} 56V320H0Z`} fill="var(--park-mint)" />
            <path d={`M0 245Q${width * .3} 222 ${width * .5} 243T${width} 237V320H0Z`} fill="var(--park-ground)" />
            <path d={`M18 254H${width - 18}`} stroke="var(--park-cream)" strokeWidth="20" strokeLinecap="round" />
            <path d={`M18 254H${width - 18}`} stroke="var(--park-ink)" strokeOpacity=".2" strokeWidth="2" strokeDasharray="2 10" />
            <g transform={`translate(${width - 35},250)`}>
                <path d="M0 0V-70" stroke="var(--park-ink)" strokeWidth="4" />
                <path d="M1-69H26L16-57L26-45H1Z" fill="var(--park-coral)" />
            </g>
            {layout.map((kind, i) => <g key={i} transform={`translate(${x(i)},248)`}>
                {kind ? <PartShape kind={kind} /> : <ellipse rx="36" ry="8" fill="none" stroke="var(--park-ink)" strokeOpacity=".28" strokeWidth="2" strokeDasharray="4 6" />}
                {beat?.action === 'bell' && beat.to === i && <g stroke="var(--park-coral)" strokeWidth="5" fill="none"><path d="M32-89l14-10M38-65h17M-45-81l-12-9" /><circle cy="-60" r="49" strokeWidth="2" /></g>}
            </g>)}
            {(preview || (reduced && beat?.action === 'jump')) && paths.map((path, i) => <path key={i} d={`M${x(path.from)} 205 Q${(x(path.from) + x(path.to)) / 2} 15 ${x(path.to)} 225`} stroke="var(--park-ink)" opacity=".4" strokeDasharray="6 7" strokeWidth="3" fill="none" />)}
            <MovingDoll key={beat ? `${beat.from}:${beat.to}:${beat.action}` : 'ready'} beat={beat} start={start} end={end}
                reduced={Boolean(reduced)} climb={beat?.action === 'walk' && layout[beat.to] === 'slide'} />
        </svg>
        <p className="park-stage-caption" aria-live="polite">{beat?.caption ?? (preview ? 'てんせんは ジャンプの みち' : 'ならべて、うごかしてみよう')}</p>
    </div>;
}
