import { ArrowRight, Heart, PackageOpen, Shirt, Sparkles } from 'lucide-react';
import { getIslandRewardGoal, quoteIslandRewardGoal, sameIslandRewardGoalTarget,
    type IslandRewardGoalAction, type IslandRewardGoalTarget } from '../../domain/island/rewardGoal';
import type { IslandRecord } from '../../domain/island/types';
import './IslandRewardGoal.css';

export interface IslandRewardGoalControls {
    action: (action: IslandRewardGoalAction) => Promise<boolean>;
    pending?: IslandRewardGoalAction; error?: string; retry?: () => Promise<boolean>;
}

export function IslandRewardGoalFeedback({ controls, disabled }: { controls?: IslandRewardGoalControls; disabled: boolean }) {
    if (!controls?.error) return null;
    return <div className="island-error" role="alert" data-reward-goal-error><p>{controls.error}</p>
        {controls.retry && <button className="island-secondary" disabled={disabled} data-reward-goal-action="retry"
            onClick={() => { void controls.retry?.(); }}>ほしいものの きろくを たしかめる</button>}</div>;
}

export function IslandRewardGoalChoice({ island, target, disabled, controls }: {
    island: IslandRecord; target: IslandRewardGoalTarget; disabled: boolean; controls: IslandRewardGoalControls;
}) {
    if (!quoteIslandRewardGoal(island, target).canChoose) return null;
    const selected = sameIslandRewardGoalTarget(getIslandRewardGoal(island), target);
    return <button className="island-secondary island-reward-goal-choice" disabled={disabled || Boolean(controls.pending)}
        aria-pressed={selected} data-reward-goal-action={selected ? 'clear' : 'choose'} data-reward-goal-category={target.category}
        data-reward-goal-item={target.category === 'furniture' ? target.kind : target.itemId}
        data-customization-action={target.category === 'customization' ? selected ? 'clear-desire' : 'desire' : undefined}
        onClick={() => { void controls.action(selected ? { type: 'clear' } : { type: 'choose', target }); }}>
        <Heart size={17} fill={selected ? 'currentColor' : 'none'} aria-hidden="true" />{selected ? 'ほしいを やめる' : 'これが ほしい'}
    </button>;
}

/** No empty progress card; qualification and affordability remain separate. */
export function IslandRewardGoal({ island, disabled, onOpen }: {
    island: IslandRecord; disabled: boolean; onOpen: (target: IslandRewardGoalTarget) => void;
}) {
    const target = getIslandRewardGoal(island); if (!target) return null;
    const quote = quoteIslandRewardGoal(island, target);
    const Icon = target.category === 'furniture' ? PackageOpen : target.category === 'expression' ? Shirt : Sparkles;
    const status = quote.requirement && !quote.requirement.met ? quote.requirement.label
        : quote.missingStars ? `あと ${quote.missingStars} ほし` : target.category === 'customization' ? 'こうかん できるよ' : 'もらえるよ';
    return <button className="island-reward-goal" disabled={disabled} onClick={() => onOpen(target)}
        data-testid="island-customization-goal" data-reward-goal-category={target.category}
        data-reward-goal-item={target.category === 'furniture' ? target.kind : target.itemId}>
        <Icon size={23} aria-hidden="true" /><span><strong>{quote.name}</strong><small>{status}</small>
            <small>{quote.price} ほし・もっている ほし {quote.points}{quote.requirement?.met ? '・みつけた しるしが あるよ' : ''}</small>
        </span><ArrowRight size={16} aria-hidden="true" />
    </button>;
}
