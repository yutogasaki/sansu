import { Check, Circle } from 'lucide-react';
import type { LearningProgressView } from '../../domain/learning/progressView';
import { ProgressBar } from '../ui/ProgressBar';

/** Separate admission conditions, never a synthetic overall completion percentage. */
export function FinishPreparation({ view }: { view: LearningProgressView }) {
    if (view.stage === 'complete') return null;
    return <div className="progress-preparation space-y-3" aria-label="しあげまでの準備">
        <h4 className="text-sm font-bold">{view.stage === 'ready' ? 'しあげの じゅんびが できたよ' : 'しあげまでの じゅんび'}</h4>
        <ul className="space-y-3">{view.conditions.map((condition, index) => <li key={condition.label} className="space-y-1">
            <div className="flex items-start gap-2 text-xs">
                {condition.met ? <Check size={16} className="shrink-0" aria-label="確認できた" /> : <Circle size={16} className="shrink-0" aria-label="確認中" />}
                <div className="min-w-0 flex-1">
                    <p className="font-bold">{condition.label}</p>
                    <p className="mt-1 text-pokomoko-muted">{condition.detail}</p>
                </div>
            </div>
            {condition.target !== undefined && condition.target > 0 && <ProgressBar className="h-2" aria-label={condition.label} value={condition.count ?? 0} max={condition.target} />}
            {index === 0 && !condition.met && <p className="text-xs text-pokomoko-muted">まず あと{Math.max(0, (condition.target ?? 20) - (condition.count ?? 0))}問の きろくを あつめよう</p>}
        </li>)}</ul>
        <p className="text-xs text-pokomoko-muted">{view.subject === 'math' ? 'それぞれの 型で、ちがう 問題を 3問ずつ ひとりで できたら 確認できるよ。' : 'このレベルの ことばの 70%以上を、ひとりで できたら 確認できるよ。'}<br />じゅんびが そろうと ちょうせんできるよ。</p>
    </div>;
}
