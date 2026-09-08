import assert from 'node:assert/strict';

export const goalOf = island => island.rewardGoal?.target
    ?? (island.customization.desiredItemId ? { category: 'customization', itemId: island.customization.desiredItemId } : null);
export const emptyExpression = () => ({ version: 1, ownedItemIds: [], selection: { version: 1,
    residents: Object.fromEntries(['otter', 'rabbit', 'fox'].map(id => [id, { outfit: null, pattern: null, trail: null }])),
    soundscape: null, environment: { period: null, season: null }, album: { cover: null, stamp: null }, flagTrim: null } });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** This short path answers one non-final slot with no pending independent checks.
 * Compare the whole world, including optional and future extensions. */
export function assertOrdinaryAnswerWorldPreserved(before, after) {
    assert(before.islands.length > 0);
    assert.deepEqual(after.islands, before.islands, 'The ordinary answer must preserve every saved island field and every owner');
}
function clearGoal(island) { delete island.rewardGoal; if (island.customization.desiredItemId) island.customization.desiredItemId = null; }
function delta(before, after, owner, action, family, type, update, receiptFields = {}) {
    const expected = structuredClone(before), old = before.islands.find(island => island.profileId === owner);
    const island = expected.islands.find(island => island.profileId === owner), actual = after.islands.find(island => island.profileId === owner);
    assert(old && actual && island); assert(Number.isFinite(actual.updatedAt)); assert(actual.updatedAt >= old.updatedAt);
    update(island); island.revision++; island.updatedAt = actual.updatedAt;
    const receipt = { id: JSON.stringify([family, owner, old.revision]), profileId: owner, type,
        timestamp: actual.updatedAt, action, ...receiptFields };
    expected.islandEvents.push(receipt); expected.islandEvents.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    assert.deepEqual(after, expected, 'Exact native delta: goal/receipt only, or the selected acquisition; every other store and field remains identical');
    return receipt;
}
/** Independent finite oracle: no application reducers or persistence functions are imported. */
export function assertGoalMutation(before, after, owner, action) {
    assert(['choose', 'clear'].includes(action.type));
    return delta(before, after, owner, action, 'island-reward-goal-v1', 'reward_goal_changed', island => {
        clearGoal(island);
        if (action.type === 'choose') {
            if (action.target.category === 'customization') island.customization.desiredItemId = action.target.itemId;
            else island.rewardGoal = { version: 1, target: structuredClone(action.target) };
        }
    });
}
export function assertGoalPurchase(before, after, owner, category, slot) {
    if (category === 'customization') return delta(before, after, owner,
        { type: 'purchase', itemId: 'starry-bridge', ...(slot ? { slot } : {}) }, 'island-customization-v1', 'customization_changed', island => {
            assert(island.customization.points >= 5); assert(!island.customization.ownedItemIds.includes('starry-bridge'));
            island.customization.points -= 5; island.customization.ownedItemIds.push('starry-bridge');
            island.customization.appearance ??= { version: 1, slots: Object.fromEntries(['sky', 'ground', 'shore', 'path', 'water', 'houseBody', 'houseRoof', 'houseWindows', 'tree', 'flower', 'mushroom', 'bridge'].map(slot => [slot, `legacy-v1:${island.customization.themeId}:${slot}`])) };
            island.customization.appearance.slots.bridge = 'parts-v1:starry:bridge';
            if (same(goalOf(island), { category, itemId: 'starry-bridge' })) clearGoal(island);
        });
    if (category === 'furniture') return delta(before, after, owner,
        { type: 'acquire-furniture', kind: 'hammock' }, 'island-furniture-v1', 'furniture_acquired', island => {
            assert(island.customization.points >= 25); assert(!island.items.some(item => item.id === 'optional-hammock'));
            island.customization.points -= 25; island.items.push({ id: 'optional-hammock', kind: 'hammock', rotation: 0 });
            if (same(goalOf(island), { category, kind: 'hammock' })) clearGoal(island);
        }, { itemId: 'optional-hammock', kind: 'hammock' });
    assert.equal(category, 'expression');
    return delta(before, after, owner, { type: 'acquire', itemId: 'leaf-album-cover' }, 'island-expression-v1', 'expression_changed', island => {
        island.expression ??= emptyExpression(); assert(island.customization.points >= 5);
        assert.deepEqual(island.expression.ownedItemIds, [], 'This short path acquires only the album cover');
        island.customization.points -= 5; island.expression.ownedItemIds.push('leaf-album-cover');
        if (same(goalOf(island), { category, itemId: 'leaf-album-cover' })) clearGoal(island);
    });
}
