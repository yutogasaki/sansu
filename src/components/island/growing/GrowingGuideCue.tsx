import { achievementCatalog } from '../../../domain/growingIsland/guidance';
import type { AchievementId, GrowingState, StarterStepId } from '../../../domain/growingIsland/types';
import { GrowingGuideArt } from './GrowingGuideArt';
import { GrowingFlowerPrice } from './GrowingFlowerPrice';
import { hasPurchasedFlower } from './growingGuideTargets';
import './growingGuide.css';

export function GrowingGuideCue({ state, cue, notice, selected, onAction, onClose, onBook }: {
    state: GrowingState; cue?: { id: StarterStepId; hint: string; action: string }; notice?: AchievementId[]; selected?: AchievementId;
    onAction: () => void; onClose: () => void; onBook: (memory?: AchievementId) => void;
}) {
    if (notice?.length) {
        const id = notice[0], entry = achievementCatalog.find(item => item.id === id)!;
        return <aside className="growing-guide-cue growing-guide-notice" data-guidance-notice role="status">
            <GrowingGuideArt id={id} evidence={state.guidance?.achievements[id]} />
            <div><span>ほんに おもいでが ふえたよ</span><strong>{entry.title}</strong><button onClick={() => onBook(id)}>できごとを みる</button></div>
            <button className="growing-guide-cue-close" aria-label="できごとの おしらせを とじる" onClick={onClose}>×</button>
        </aside>;
    }
    if (cue) return <aside className="growing-guide-cue" data-guidance-starter={cue.id} role="status">
        <div><span>ぽこもこ</span><strong>{cue.hint}</strong>
            {cue.id === 'S4' && cue.action === 'まなぶ' && !state.guidance?.starter.legacy
                && !hasPurchasedFlower(state)
                && state.unlocked.includes('landmark:flower') && <GrowingFlowerPrice drops={state.drops} />}
            <button onClick={onAction}>{cue.action}</button></div>
        <button className="growing-guide-cue-close" aria-label="しまの ヒントを とじる" onClick={onClose}>×</button>
    </aside>;
    if (!selected || state.guidance?.achievements[selected]) return null;
    const entry = achievementCatalog.find(item => item.id === selected)!;
    return <button className="growing-guide-goal" aria-label={`${entry.title}の ヒント`} onClick={() => onBook()}>
        <GrowingGuideArt id={selected} /><span>{entry.title}</span>
    </button>;
}
