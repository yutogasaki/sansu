import { describe, it, expect } from 'vitest';
import { assertGoalMutation, assertGoalPurchase, assertOrdinaryAnswerWorldPreserved, emptyExpression } from './island-reward-goal-audit.mjs';
const owner = 'qa-owner';
const seed = () => ({ islands: [{ profileId: owner, revision: 2, updatedAt: 1, items: [],
    customization: { points: 35, ownedItemIds: ['moon-garden'], desiredItemId: null, appearance: { version: 1, slots: { bridge: 'legacy-v1:moon-garden:bridge' } } } }],
    islandEvents: [], islandPlans: [{ id: 'reserved', cursor: 0, revision: 0 }], logs: [], islandPhotos: [{ id: 'real-like-photo', image: { sha256: 'protected' } }] });
function saved(before, action, family, type, update, fields = {}) {
    const after = structuredClone(before), island = after.islands[0]; update(island); island.revision++; island.updatedAt = 2;
    after.islandEvents.push({ id: JSON.stringify([family, owner, before.islands[0].revision]), profileId: owner, type, timestamp: 2, action, ...fields }); return after;
}
describe('short goal QA independent exact native oracle', () => {
    it('rejects any world change during the non-final check-free answer, even when a later reload preserves it', () => {
        const before = seed(), island = before.islands[0];
        island.items = [{ id: 'optional-hammock', kind: 'hammock', rotation: 0 }];
        island.rewardGoal = { version: 1, target: { category: 'expression', itemId: 'shell-three-notes' } };
        island.experience = { name: 'kept' }; island.shared = { memories: ['kept'] }; island.workshop = { version: 1, works: ['kept'] };
        const after = structuredClone(before); after.islandPlans[0].cursor++; after.islandPlans[0].revision++;
        expect(() => assertOrdinaryAnswerWorldPreserved(before, after)).not.toThrow();
        for (const corrupt of [value => value.islands[0].items.pop(), value => delete value.islands[0].rewardGoal,
            value => delete value.islands[0].experience, value => delete value.islands[0].shared,
            value => delete value.islands[0].workshop, value => value.islands[0].revision++]) {
            const invalid = structuredClone(after); corrupt(invalid);
            expect(() => assertOrdinaryAnswerWorldPreserved(before, invalid)).toThrow();
        }
    });
    for (const target of [{ category: 'customization', itemId: 'starry-bridge' }, { category: 'furniture', kind: 'hammock' }, { category: 'expression', itemId: 'shell-three-notes' }]) {
        it(`accepts free ${target.category} choice with canonical receipt`, () => {
            const before = seed(), action = { type: 'choose', target };
            const after = saved(before, action, 'island-reward-goal-v1', 'reward_goal_changed', island => {
                if (target.category === 'customization') island.customization.desiredItemId = target.itemId;
                else island.rewardGoal = { version: 1, target };
            });
            expect(() => assertGoalMutation(before, after, owner, action)).not.toThrow();
            for (const corrupt of [value => value.islandPlans[0].cursor++, value => value.islands[0].customization.points--,
                value => value.islandPhotos[0].image.sha256 = 'changed', value => value.islandEvents[0].type = 'customization_changed']) {
                const invalid = structuredClone(after); corrupt(invalid); expect(() => assertGoalMutation(before, invalid, owner, action)).toThrow();
            }
        });
    }
    it('replaces the legacy goal and rejects duplicate two-category storage', () => {
        const before = seed(); before.islands[0].customization.desiredItemId = 'starry-bridge';
        const action = { type: 'choose', target: { category: 'furniture', kind: 'hammock' } };
        const after = saved(before, action, 'island-reward-goal-v1', 'reward_goal_changed', island => { island.customization.desiredItemId = null; island.rewardGoal = { version: 1, target: action.target }; });
        expect(() => assertGoalMutation(before, after, owner, action)).not.toThrow(); after.islands[0].customization.desiredItemId = 'starry-bridge';
        expect(() => assertGoalMutation(before, after, owner, action)).toThrow();
    });
    it('clears exactly the saved goal without charging or resetting previews into storage', () => {
        const before = seed(); before.islands[0].rewardGoal = { version: 1, target: { category: 'furniture', kind: 'hammock' } };
        const action = { type: 'clear' }, after = saved(before, action, 'island-reward-goal-v1', 'reward_goal_changed', island => delete island.rewardGoal);
        expect(() => assertGoalMutation(before, after, owner, action)).not.toThrow();
    });
    it('requires matching bridge purchase to clear legacy desiredItemId', () => {
        const before = seed(); before.islands[0].customization.desiredItemId = 'starry-bridge';
        const after = saved(before, { type: 'purchase', itemId: 'starry-bridge', slot: 'bridge' }, 'island-customization-v1', 'customization_changed', island => {
            island.customization.points -= 5; island.customization.ownedItemIds.push('starry-bridge'); island.customization.appearance.slots.bridge = 'parts-v1:starry:bridge'; island.customization.desiredItemId = null;
        });
        expect(() => assertGoalPurchase(before, after, owner, 'customization', 'bridge')).not.toThrow();
    });
    it('matching furniture purchase clears only its goal and grants an unplaced object', () => {
        const before = seed(); before.islands[0].rewardGoal = { version: 1, target: { category: 'furniture', kind: 'hammock' } };
        const after = saved(before, { type: 'acquire-furniture', kind: 'hammock' }, 'island-furniture-v1', 'furniture_acquired', island => {
            island.customization.points -= 25; island.items.push({ id: 'optional-hammock', kind: 'hammock', rotation: 0 }); delete island.rewardGoal;
        }, { itemId: 'optional-hammock', kind: 'hammock' });
        expect(() => assertGoalPurchase(before, after, owner, 'furniture')).not.toThrow(); after.islands[0].items[0].position = { x: 0, z: 0 };
        expect(() => assertGoalPurchase(before, after, owner, 'furniture')).toThrow();
    });
    it('unrelated album acquisition preserves the goal and never equips automatically', () => {
        const before = seed(); before.islands[0].rewardGoal = { version: 1, target: { category: 'expression', itemId: 'shell-three-notes' } };
        const after = saved(before, { type: 'acquire', itemId: 'leaf-album-cover' }, 'island-expression-v1', 'expression_changed', island => {
            island.customization.points -= 5; island.expression = emptyExpression(); island.expression.ownedItemIds.push('leaf-album-cover');
        });
        expect(() => assertGoalPurchase(before, after, owner, 'expression')).not.toThrow();
        const cleared = structuredClone(after); delete cleared.islands[0].rewardGoal; expect(() => assertGoalPurchase(before, cleared, owner, 'expression')).toThrow();
        after.islands[0].expression.selection.album.cover = 'leaf-album-cover'; expect(() => assertGoalPurchase(before, after, owner, 'expression')).toThrow();
    });
});
