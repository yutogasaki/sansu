import { Sprout } from 'lucide-react';
import { LIFE_RULES, vigor, type LifeState } from '../../../domain/islandLife/model';

export function LifeResourceIcon({ kind }: { kind: 'drops' | 'light' }) {
    return <svg className={`life-resource-icon life-resource-icon--${kind}`} viewBox="0 0 36 40" width="30" height="34" aria-hidden="true">
        {kind === 'drops' ? <>
            <path className="life-resource-shape" d="M18 3C15 10 5 18 5 25a13 13 0 0 0 26 0C31 18 21 10 18 3Z" />
            <path className="life-resource-shine" d="M13 17c-3 4-4 6-4 9" />
        </> : <>
            <path className="life-resource-shape" d="m18 3 5 11 10 6-10 6-5 11-5-11L3 20l10-6Z" />
            <path className="life-resource-shine" d="m17 11-3 7-5 3" />
        </>}
    </svg>;
}

export function LifeResources({ state }: { state: LifeState }) {
    return <div className="life-wallet life-resources" role="group" aria-label="しずくと ひかりの のこり">
        <span className="life-wallet-item life-wallet-item--drops" data-life-resource="drops" title="まなぶと ふえるよ。つくる・ひろげるに つかうよ。">
            <LifeResourceIcon kind="drops" /><span>しずく</span><strong>{state.drops}</strong>
        </span>
        <span className="life-wallet-item life-wallet-item--light" data-life-resource="light" title="いろを そろえる ぶんまで、みんなが たのしむと ふえるよ">
            <LifeResourceIcon kind="light" /><span>ひかり</span><strong>{state.light}</strong>
        </span>
    </div>;
}

export function LifeGrowthSummary({ state, goal }: { state: LifeState; goal: number }) {
    return <div className="life-growth-summary">
        <div className="life-growth-heading" data-life-resource="growth"><Sprout size={22} aria-hidden="true" /><span>しまの そだち</span><strong>{vigor(state) === 1 ? 'すくすく' : 'ゆっくり そだつ'}</strong></div>
        <div className="life-growth-day"><span>きょうの いぶき</span><b>{goal} <small>/ {LIFE_RULES.dailyGoal}</small></b></div>
        <div className="life-growth-steps" aria-hidden="true">{Array.from({ length: LIFE_RULES.dailyGoal }, (_, i) => <i key={i} data-filled={i < goal} />)}</div>
        <p className="life-goal">{goal === LIFE_RULES.dailyGoal ? 'きょうの いぶきが みちたよ' : 'といたぶんは のこるよ'}</p>
    </div>;
}

export function LifeResourceGuide() {
    return <div className="life-resource-guide">
        <div><LifeResourceIcon kind="drops" /><p><b>まなぶと しずく</b><span>つくる・ひろげるに つかうよ。</span></p></div>
        <div><LifeResourceIcon kind="light" /><p><b>みんなが あそぶと ひかり</b><span>2つの いろを そろえるのに つかうよ。</span></p></div>
    </div>;
}
