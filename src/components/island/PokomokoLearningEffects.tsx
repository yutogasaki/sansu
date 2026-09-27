import type { CSSProperties } from 'react';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';

/** One bounded burst, replaced rather than queued when answers arrive quickly. */
export function PokomokoLearningBurst({ burst }: { burst?: PokomokoBurst }) {
    if (!burst) return null;
    const count = burst.kind === 'section' ? 28 : burst.kind === 'step' ? 6 : 18;
    return <span key={burst.id} className="pokomoko-burst" data-burst={burst.kind} aria-hidden="true">
        <i className="pokomoko-burst-ring" /><i className="pokomoko-burst-ring pokomoko-burst-ring--echo" />
        {Array.from({ length: count }, (_, index) => {
            const angle = (index / count) * Math.PI * 2;
            const radius = burst.kind === 'section' ? 130 + (index % 4) * 20 : burst.kind === 'step' ? 46 : 78 + (index % 3) * 22;
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
