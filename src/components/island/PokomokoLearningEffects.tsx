import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';

export function PokomokoInputSpark({ cue }: { cue?: PokomokoInputCue }) {
    return cue ? <span className="pokomoko-input-sparks" aria-hidden="true">
        <i key={`ring-${cue.id}`} className="pokomoko-input-spark" style={{ left: cue.x, top: cue.y }} />
        <i key={`flight-${cue.id}`} className="pokomoko-input-flight" style={{ left: cue.x, top: cue.y,
            '--flight-x': `${cue.destinationX - cue.x}px`, '--flight-y': `${cue.destinationY - cue.y}px`,
        } as CSSProperties} />
    </span> : null;
}

/** The earned peak reaches the edges of the worksheet, leaving its reading area clear. */
export function PokomokoMilestoneFrame({ burst }: { burst?: PokomokoBurst }) {
    if (!burst || !['ride', 'stamp'].includes(burst.kind)) return null;
    return <span key={burst.id} className="pokomoko-milestone-frame" aria-hidden="true">
        <span className="pokomoko-milestone-halo" />
        {[0, 1].map(side => <span key={side} className="pokomoko-edge-cascade" data-side={side}>
            {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--fall': `${i * 9}%`, '--delay': `${i * 45}ms`,
                '--color': ['#ffd360', '#ef91b0', '#83dbd0', '#b5a1ec'][i % 4], '--angle': `${i * 37}deg` } as CSSProperties} />)}
        </span>)}
    </span>;
}

/** Awarded stars follow the last accepted answer to the catching paw. */
export function PokomokoAnswerFlight({ burst }: { burst?: PokomokoBurst }) {
    const point = burst?.origin;
    if (!burst || !point || burst.kind === 'step') return null;
    return <span key={burst.id} className="pokomoko-answer-flight-layer" aria-hidden="true"><span className="pokomoko-answer-flight"
        style={{ left: point.x, top: point.y, '--flight-x': `${point.destinationX - point.x}px`, '--flight-y': `${point.destinationY - point.y}px` } as CSSProperties}>
        <Star fill="currentColor" />
    </span></span>;
}
