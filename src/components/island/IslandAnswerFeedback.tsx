import { Circle, Sprout, X } from 'lucide-react';
import type { IslandLearningFeedback } from './learningFeedback';

/** Keep the same space for every result; input remains available during the short pop. */
export function IslandAnswerFeedback({ feedback }: { feedback?: IslandLearningFeedback }) {
    const result = feedback?.text ? feedback : undefined;
    const Icon = result?.kind === 'retry' ? X : result?.kind === 'supported' ? Sprout : Circle;
    return <div className="island-workbench-message" role="status" aria-live="polite" aria-atomic="true">
        {result && <div key={result.id} className="island-answer-result" data-result={result.kind}>
            <span className="island-answer-result__symbol" aria-hidden="true"><Icon size={26} strokeWidth={3} /></span>
            <p>{result.text}</p>
        </div>}
    </div>;
}
