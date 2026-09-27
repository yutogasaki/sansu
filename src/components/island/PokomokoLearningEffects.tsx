import type { CSSProperties } from 'react';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';

/** One bounded burst, replaced rather than queued when answers arrive quickly. */
export function PokomokoLearningBurst({ burst }: { burst?: PokomokoBurst }) {
    if (!burst) return null;
    const peak = ['jump', 'ride', 'stamp', 'section'].includes(burst.kind);
    const count = peak ? 28 : burst.kind === 'step' ? 6 : 10;
    return <span key={burst.id} className="pokomoko-burst" data-burst={burst.kind} aria-hidden="true">
        <i className="pokomoko-burst-ring" /><i className="pokomoko-burst-ring pokomoko-burst-ring--echo" />
        {Array.from({ length: count }, (_, index) => {
            const angle = (index / count) * Math.PI * 2 + burst.variant * .8;
            const radius = peak ? 110 + (index % 4) * 17 : burst.kind === 'step' ? 36 : 54 + (index % 3) * 15;
            return <i key={index} className="pokomoko-confetti" data-shape={index % 3 === 0 ? 'star' : index % 3 === 1 ? 'patch' : 'dot'}
                style={{ '--x': `${Math.cos(angle) * radius}px`, '--y': `${Math.sin(angle) * radius * .55 - 18}px`,
                    '--turn': `${(index % 2 ? 1 : -1) * (90 + index * 19)}deg`, '--delay': `${index % 4 * 22}ms`,
                    '--color': `var(--pokomoko-party-${index % 4})`, '--size': `${index % 3 === 0 ? 15 : 7 + index % 4}px`,
                } as CSSProperties} />;
        })}
    </span>;
}

export function PokomokoInputSpark({ cue }: { cue?: PokomokoInputCue }) {
    return cue ? <span className="pokomoko-input-sparks" aria-hidden="true"><i key={cue.id} className="pokomoko-input-spark"
        style={{ left: cue.x, top: cue.y }} /></span> : null;
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
