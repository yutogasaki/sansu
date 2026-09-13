import type { LandSide, LifeAction, LifeLandReceipt, LifeState } from './model';
export type LandState = Pick<LifeState, 'expanded' | 'extraLand'>;
/** The original first expansion remains the source of existing land rights. */
export function landBounds(state: LandState) {
    const owned = [state.expanded, ...(state.extraLand ?? [])];
    return { minX: owned.includes('west') ? -3 : 0, maxX: owned.includes('east') ? 8 : 5,
        depth: owned.includes('south') ? 8 : 5 };
}
export function landQuote(state: LandState): { step: number; sides: LandSide[]; price: number } | undefined {
    if (!state.expanded) return { step: 1, sides: ['west', 'east'], price: 12 };
    if (!state.extraLand?.length) return { step: 2, sides: [state.expanded === 'west' ? 'east' : 'west'], price: 24 };
    if (state.extraLand.length === 1) return { step: 3, sides: ['south'], price: 48 };
}
export function expandedLand(state: LandState, side: LandSide): LandState {
    if (!state.expanded && side !== 'south') return { expanded: side };
    return { expanded: state.expanded, extraLand: [...(state.extraLand ?? []), side] };
}
export function landReceipt(state: LandState, action: LifeAction): LifeLandReceipt {
    const quote = landQuote(state);
    if (action.command.type !== 'expand' || !quote?.sides.includes(action.command.side)) throw new Error('ひろげる ばしょを もういちど えらんでね。');
    return { rules: 'land-12-24-48-v1', step: quote.step, side: action.command.side,
        actualPaidDrops: quote.price, actionId: action.id, committedAt: action.at };
}
export function applyLandExpansion(state: LifeState, action: LifeAction) {
    if (action.command.type !== 'expand') throw new Error('Expansion required');
    const receipt = action.landReceipt;
    if (receipt) {
        const expected = landReceipt(state, action);
        if (receipt.rules !== expected.rules || receipt.step !== expected.step || receipt.side !== expected.side
            || receipt.actualPaidDrops !== expected.actualPaidDrops || receipt.actionId !== expected.actionId
            || receipt.committedAt !== expected.committedAt) throw new Error('土地の購入記録を確認できません。');
        if (state.drops < receipt.actualPaidDrops) throw new Error('しずくが もうすこし いるよ。');
        Object.assign(state, expandedLand(state, receipt.side)); state.drops -= receipt.actualPaidDrops;
    } else {
        // Unreceipted actions always retain the historical one-step contract.
        if (state.expanded) throw new Error('この しまは ここまで ひろがったよ。');
        if (action.command.side === 'south' || !['east', 'west'].includes(action.command.side) || state.drops < 12) throw new Error('しずくが もうすこし いるよ。');
        state.expanded = action.command.side; state.drops -= 12;
    }
}
