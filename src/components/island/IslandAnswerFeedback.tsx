import { Circle, Sprout, X } from 'lucide-react';
import type { IslandLearningFeedback } from './learningFeedback';
import pokomoko from '../../../docs/design/2026-09-19-life-startup-stills/source/pokomoko-original.png';
import { PokomokoLearningBurst } from './PokomokoLearningEffects';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';
import './PokomokoLearningFeedback.css';

/** Keep the same space for every result; input remains available during the short pop. */
export function IslandAnswerFeedback({ feedback, burst, inputCue }: { feedback?: IslandLearningFeedback; burst?: PokomokoBurst; inputCue?: PokomokoInputCue }) {
    const result = feedback?.text ? feedback : undefined;
    const Icon = result?.kind === 'retry' ? X : result?.kind === 'supported' ? Sprout : Circle;
    return <div className="island-workbench-message pokomoko-learning-feedback" data-feedback-candidate="pokomoko-learning-party-v1" data-pose={burst?.kind ?? (inputCue ? 'input' : 'ready')}>
        <span className="pokomoko-learning-actor" aria-hidden="true">
            <PokomokoLearningBurst burst={burst} />
            <span className="pokomoko-learning-shadow" />
            <img key={burst?.id ?? (inputCue ? `input-${inputCue.id}` : 'ready')} src={pokomoko} width="138" height="160" alt="" draggable="false" />
        </span>
        <div className="pokomoko-learning-caption" role="status" aria-live="polite" aria-atomic="true">
        {result ? <div key={result.id} className="island-answer-result" data-result={result.kind}>
            <span className="island-answer-result__symbol" aria-hidden="true"><Icon size={26} strokeWidth={3} />
                {result.kind === 'correct' && <span className="island-answer-result__rays"><i /><i /><i /><i /></span>}
            </span>
            <p>{result.text}</p>
        </div> : <span className="pokomoko-learning-ready" aria-hidden="true">ぽこもこと いっしょ</span>}
        </div>
    </div>;
}
