import { growthStage, type Cell, type LifeState } from '../../../domain/islandLife/model';
import type { PlacementPreview } from './placement';

export type LifeSceneInput = {
    state: LifeState;
    changeKey?: string;
    selected?: string;
    cell?: Cell;
    placement?: PlacementPreview;
};

// The motion projection already advances visits between saved snapshots. A
// periodic clock refresh only needs new geometry when its visible shape changes.
function geometryKey({ state, selected, cell, placement }: LifeSceneInput) {
    const { now, residents, drops, light, days, economy, lastAchievement, heroWaitUntil, roamRound, ...shape } = state;
    void now; void residents; void drops; void light; void days; void economy;
    void lastAchievement; void heroWaitUntil; void roamRound;
    return JSON.stringify({ ...shape, items: state.items.map(item => ({ ...item, growth: growthStage(item) })),
        selected, cell, placement: placement && { ...placement,
            item: { ...placement.item, growth: growthStage(placement.item) },
            isolated: placement.isolated.map(item => ({ ...item, growth: growthStage(item) })) } });
}

export function canReuseLifeScene(previous: LifeSceneInput | undefined, next: LifeSceneInput) {
    if (!previous || !previous.changeKey || previous.changeKey !== next.changeKey) return false;
    if (next.state.now < previous.state.now || next.state.now - previous.state.now > 60_000) return false;
    return geometryKey(previous) === geometryKey(next);
}
