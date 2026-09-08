import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { getIslandCosmetics, getIslandCustomization, previewIslandCustomization, reduceIslandCustomization } from './customization';
import { getIslandExpression, ISLAND_EXPRESSION_CATALOG, previewIslandExpression, reduceIslandExpression } from './expression';
import { reduceIslandFurniture } from './furniture';
import { getIslandGrowthTarget, growIslandAfterCompletedSet } from './growth';
import { previewIslandLayout, reduceIslandExperience } from './experience';
import { assertIsland, IslandConflict } from './repository';
import { canonicalIslandRewardGoalAction, getIslandRewardGoal, hasValidIslandRewardGoal, IslandRewardGoalConflict,
    quoteIslandRewardGoal, reduceIslandRewardGoal, sameIslandRewardGoalTarget, type IslandRewardGoalState, type IslandRewardGoalTarget } from './rewardGoal';
import type { IslandRecord } from './types';

const targets: IslandRewardGoalTarget[] = [
    { category: 'customization', itemId: 'starry-house' }, { category: 'furniture', kind: 'telescope' }, { category: 'expression', itemId: 'raincoat' },
];
function funded(): IslandRecord {
    const island = createIsland('child', 1);
    return { ...island, customization: { ...getIslandCustomization(island), points: 100 } };
}
const choose = (island: IslandRecord, target: IslandRewardGoalTarget) => reduceIslandRewardGoal(island, { type: 'choose', target });

describe('one free reward goal across the existing catalogs', () => {
    it('reads old desiredItemId without migrating it, and never materializes a wallet or expression to choose/clear a new goal', () => {
        const old = createIsland('child', 1), before = structuredClone(old);
        expect(getIslandRewardGoal(old)).toBeNull(); expect(reduceIslandRewardGoal(old, { type: 'clear' })).toBe(old);
        const selected = choose(old, targets[1]); expect(selected.customization).toBeUndefined(); expect(selected.expression).toBeUndefined();
        const value = getIslandRewardGoal(selected)!;
        if (value.category === 'furniture') value.kind = 'hammock';
        expect(getIslandRewardGoal(selected)).toEqual(targets[1]);
        expect(reduceIslandRewardGoal(selected, { type: 'clear' })).toEqual(old); expect(old).toEqual(before);
        const legacy = reduceIslandCustomization(old, { type: 'desire', itemId: 'starry' }), saved = structuredClone(legacy);
        expect(getIslandRewardGoal(legacy)).toEqual({ category: 'customization', itemId: 'starry' });
        expect(legacy).toEqual(saved); expect(legacy.rewardGoal).toBeUndefined();
    });
    it('changes every pair of categories while keeping exactly one goal and every non-goal field', () => {
        for (const from of targets) for (const to of targets) {
            const initial = funded(), selected = choose(initial, from), before = structuredClone(selected), next = choose(selected, to);
            expect(getIslandRewardGoal(next)).toEqual(to); expect(() => assertIsland(next)).not.toThrow();
            expect(next.customization!.points).toBe(100); expect(next.items).toEqual(initial.items);
            expect(next.expression).toBeUndefined(); expect(next.growth).toEqual(initial.growth);
            expect(Boolean(next.rewardGoal) && Boolean(next.customization!.desiredItemId)).toBe(false);
            const cleared = reduceIslandRewardGoal(next, { type: 'clear' }); expect(cleared).toEqual(initial);
            expect(selected).toEqual(before);
        }
    });
    it.each(ISLAND_EXPRESSION_CATALOG.filter(item => item.requirement !== null))(
        'allows an unqualified zero-star $itemId goal while retaining its actual acquisition condition', item => {
        const old = createIsland('child', 1), target = { category: 'expression' as const, itemId: item.itemId }, selected = choose(old, target);
        expect(quoteIslandRewardGoal(selected, target)).toMatchObject({ target, price: 0, points: 0, missingStars: 0,
            owned: false, canChoose: true, canAcquire: false, requirement: { id: item.requirement, met: false } });
        expect(getIslandRewardGoal(selected)).toEqual(target); expect(selected.customization).toBeUndefined();
        expect(selected.expression).toBeUndefined(); expect(selected.growth).toEqual(old.growth);
    });
    it('quotes current partial bundle ownership and affordability without new prices or saved credit', () => {
        const initial = funded(), partial = reduceIslandCustomization(initial, { type: 'purchase', itemId: 'starry-house' });
        const before = structuredClone(partial), target = { category: 'customization', itemId: 'starry' } as const;
        expect(quoteIslandRewardGoal(partial, target)).toMatchObject({ listPrice: 60, price: 45, points: 85, missingStars: 0, canChoose: true, canAcquire: true });
        expect(quoteIslandRewardGoal(partial, { category: 'customization', itemId: 'starry-house' })).toMatchObject({ price: 0, owned: true, canChoose: false, canAcquire: false });
        expect(partial).toEqual(before);
        const poor = createIsland('child', 1);
        expect(quoteIslandRewardGoal(poor, { category: 'furniture', kind: 'tea-table' })).toMatchObject({ price: 40, points: 0, missingStars: 40, canChoose: true, canAcquire: false });
    });
    it('preserves targets through preview, equip, unrelated acquisitions and ordinary growth; only acquisition of that target removes it', () => {
        let island = reduceIslandExpression(funded(), { type: 'acquire', itemId: 'star-beret' });
        island = choose(island, { category: 'expression', itemId: 'raincoat' }); const before = structuredClone(island);
        previewIslandExpression(island, { type: 'equip-outfit', residentId: 'rabbit', itemId: 'raincoat' });
        previewIslandCustomization(getIslandCosmetics(island), { type: 'equip', itemId: 'crystal' });
        expect(island).toEqual(before);
        island = reduceIslandExpression(island, { type: 'equip-outfit', residentId: 'rabbit', itemId: 'star-beret' });
        island = reduceIslandFurniture(island, { type: 'acquire-furniture', kind: 'hammock' });
        island = reduceIslandCustomization(island, { type: 'purchase', itemId: 'starry-water' });
        island = growIslandAfterCompletedSet({ ...island, completedSets: island.completedSets + 1 }, getIslandGrowthTarget(island), 3);
        expect(getIslandRewardGoal(island)).toEqual({ category: 'expression', itemId: 'raincoat' });
        const bought = reduceIslandExpression(island, { type: 'acquire', itemId: 'raincoat' });
        expect(bought.rewardGoal).toBeUndefined(); expect(bought.expression!.selection).toEqual(island.expression!.selection);
        expect(bought.growth).toEqual(island.growth); expect(bought.items).toEqual(island.items);
        const furniture = choose(bought, { category: 'furniture', kind: 'telescope' });
        const rich = { ...furniture, customization: { ...furniture.customization!, points: 30 } }; // Wallet-only pure reducer fixture.
        expect(reduceIslandFurniture(rich, { type: 'acquire-furniture', kind: 'telescope' }).rewardGoal).toBeUndefined();
    });
    it('old desire supersedes the new goal while old clear-desire cannot silently clear a goal in another category', () => {
        const selected = choose(funded(), { category: 'furniture', kind: 'hammock' });
        expect(getIslandRewardGoal(reduceIslandCustomization(selected, { type: 'clear-desire' }))).toEqual({ category: 'furniture', kind: 'hammock' });
        const legacy = reduceIslandCustomization(selected, { type: 'desire', itemId: 'candy-complete' });
        expect(legacy.rewardGoal).toBeUndefined(); expect(legacy.customization!.desiredItemId).toBe('candy-complete');
        expect(legacy.customization!.points).toBe(100);
    });
    it('keeps present goals out of all scene-style generations and never restores an older goal on apply', () => {
        for (const target of targets) for (const version of ['none', 'v1', 'v2'] as const) {
            let island = reduceIslandExperience(funded(), { type: 'save-layout', layoutId: 'slot-1', name: 'むかし' }, 5);
            const layout = island.experience!.layouts[0];
            if (version === 'none') delete layout.sceneStyle;
            if (version === 'v1') layout.sceneStyle = { version: 1, residentLooks: { otter: 'cap', rabbit: 'scarf', fox: 'original' }, ambience: 'brook', emblem: 'star' };
            island = choose(island, target); const snapshot = structuredClone(island.experience!.layouts), history = structuredClone(island.growth!.memories);
            const preview = previewIslandLayout(island, 'slot-1'); expect(getIslandRewardGoal(preview)).toEqual(target);
            const applied = reduceIslandExperience(island, { type: 'apply-layout', layoutId: 'slot-1' }, 6);
            expect(getIslandRewardGoal(applied)).toEqual(target); expect(applied.experience!.layouts).toEqual(snapshot);
            expect(applied.growth!.memories).toEqual(history); expect(JSON.stringify(snapshot)).not.toContain('rewardGoal');
            const saved = reduceIslandExperience(applied, { type: 'save-layout', layoutId: 'slot-2', name: 'いま' }, 7);
            expect(saved.experience!.layouts[1].sceneStyle?.version).toBe(2); expect(getIslandRewardGoal(saved)).toEqual(target);
            expect(JSON.stringify(saved.experience!.layouts[1])).not.toContain('rewardGoal');
        }
    });
});

describe('strict reward goal state and canonical intents', () => {
    it('rejects unknown keys, versions, wrong-category IDs and two simultaneous goals without repair', () => {
        const base = funded();
        for (const state of [null, { version: 2, target: targets[1] }, { version: 1, target: targets[1], extra: true },
            { version: 1, target: targets[0] }, { version: 1, target: { category: 'furniture', kind: 'bench' } },
            { version: 1, target: { category: 'expression', itemId: 'breeze' } }, { version: 1, target: { ...targets[1], price: 0 } }]) {
            const damaged = { ...base, rewardGoal: state as IslandRewardGoalState }, before = structuredClone(damaged);
            expect(hasValidIslandRewardGoal(damaged)).toBe(false); expect(() => getIslandRewardGoal(damaged)).toThrow(IslandRewardGoalConflict);
            expect(() => assertIsland(damaged)).toThrow(IslandConflict); expect(damaged).toEqual(before);
        }
        const dual = { ...choose(base, targets[1]), customization: { ...base.customization!, desiredItemId: 'starry' as const } };
        expect(() => assertIsland(dual)).toThrow(IslandConflict); expect(() => reduceIslandRewardGoal(dual, { type: 'clear' })).toThrow(IslandRewardGoalConflict);
    });
    it('cannot select already owned possessions or store them as desired, including derived old theme ownership', () => {
        const expression = reduceIslandExpression(funded(), { type: 'acquire', itemId: 'raincoat' });
        const furniture = reduceIslandFurniture(funded(), { type: 'acquire-furniture', kind: 'telescope' });
        for (const [island, target] of [[expression, targets[2]], [furniture, targets[1]]] as const) {
            expect(() => choose(island, target)).toThrow(IslandRewardGoalConflict);
            expect(() => assertIsland({ ...island, rewardGoal: { version: 1, target } as IslandRewardGoalState })).toThrow(IslandConflict);
        }
        const bundle = reduceIslandCustomization(funded(), { type: 'purchase', itemId: 'starry' });
        expect(() => choose(bundle, targets[0])).toThrow(IslandRewardGoalConflict);
        expect(getIslandExpression(furniture).ownedItemIds).toEqual([]);
    });
    it('canonicalizes field order but rejects extra payload and never aliases a mutable input', () => {
        const input = { target: { kind: 'telescope', category: 'furniture' }, type: 'choose' };
        const action = canonicalIslandRewardGoalAction(input); input.target.kind = 'hammock';
        expect(JSON.stringify(action)).toBe('{"type":"choose","target":{"category":"furniture","kind":"telescope"}}');
        for (const value of [null, { type: 'clear', target: targets[1] }, { type: 'choose', target: targets[1], price: 0 },
            { type: 'choose', target: { category: 'expression', itemId: 'raincoat', residentId: 'fox' } }]) {
            expect(() => canonicalIslandRewardGoalAction(value)).toThrow(IslandRewardGoalConflict);
        }
        expect(sameIslandRewardGoalTarget(null, null)).toBe(true); expect(sameIslandRewardGoalTarget(targets[0], targets[1])).toBe(false);
        expect(sameIslandRewardGoalTarget(targets[1], { category: 'furniture', kind: 'telescope' })).toBe(true);
    });
});
