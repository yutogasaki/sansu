import { Check, Circle } from 'lucide-react';
import type { LearningProgressView } from '../../domain/learning/progressView';

/** Independent counts; these are never combined into an admission percentage. */
export function FinishPreparation({ view, compact = false }: { view: LearningProgressView; compact?: boolean }) {
    if (view.stage === 'complete') return null;
    if (compact) return <dl className="progress-counts" aria-label="しあげの準備状況">
        {view.conditions.slice(0, 3).map((condition, index) => <div key={condition.label}>
            <dt>{['れんしゅう', 'ひとりで', view.subject === 'math' ? '型' : 'ことば'][index]}</dt>
            <dd>{condition.summary}<span className="sr-only"> · {condition.label} · {condition.met ? '確認できた' : '確認中'}</span></dd>
        </div>)}
    </dl>;
    return <div className="progress-preparation" aria-label="しあげまでの準備">
        <h4 className="font-bold">しあげに ちょうせんする 条件</h4>
        <ul>{view.conditions.map(condition => <li key={condition.label}>
            {condition.met ? <Check size={18} aria-label="確認できた" /> : <Circle size={18} aria-label="確認中" />}
            <div><p className="font-bold">{condition.label}</p><p className="text-pokomoko-muted">{condition.detail}</p></div>
        </li>)}</ul>
        <p className="text-pokomoko-muted">{view.subject === 'math' ? '型ごとに、ちがう 問題を3問ずつ ひとりで とくよ。' : 'このレベルの ことばの70%以上を、ひとりで とくよ。'}</p>
    </div>;
}
