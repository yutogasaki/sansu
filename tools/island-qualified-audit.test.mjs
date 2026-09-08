import assert from 'node:assert/strict';
import { test } from 'vitest';
import { assertDiscoveryDelta, assertSettingsSoundDelta, assertWorkshopDelta, emptyWorkshop, orderEvents } from './island-qualified-audit.mjs';

const owner = 'child-1';
const initial = () => ({ islands: [{ profileId: owner, revision: 9, updatedAt: 10,
    growth: { discoveries: [] }, workshop: emptyWorkshop(owner), customization: { points: 30 } }],
islandEvents: [], profiles: [{ id: owner, soundEnabled: true }],
appData: [{ id: 'app', profiles: { [owner]: { id: owner, soundEnabled: true } } }],
logs: [{ id: 'answer', independent: false }], islandPhotoBlobs: [{ id: 'photo', sha256: 'original' }] });
const action = { type: 'brush', specimenId: 'driftwood', section: 0 };
function brushed(before) {
    const after = structuredClone(before);
    Object.assign(after.islands[0], { revision: 10, updatedAt: 20 }); after.islands[0].workshop.specimens.driftwood.cleanedMask = 1;
    after.islandEvents.push({ id: `island-workshop:v1:operation:${JSON.stringify([owner, 9])}`, profileId: owner,
        type: 'workshop_changed', timestamp: 20, action }); return after;
}
test('accepts the one brush gesture and exact native receipt', () => {
    const before = initial(); assert.equal(assertWorkshopDelta(before, brushed(before), owner, [action]).length, 1);
});
for (const [name, corrupt] of Object.entries({
    'other specimen': after => { after.islands[0].workshop.specimens.seaglass.cleanedMask = 1; },
    shelf: after => { after.islands[0].workshop.shelves['shelf-1'] = 'driftwood'; },
    'saved works': after => { after.islands[0].workshop.works['work-1'] = { name: 'unrelated' }; },
    'draft history': after => { after.islands[0].workshop.draftCheckpoint.draft.undo.push({}); },
    'learning evidence': after => { after.logs[0].independent = true; },
    'photo bytes': after => { after.islandPhotoBlobs[0].sha256 = 'changed'; },
    'other action with same type': after => { after.islandEvents[0].action = { ...action, section: 1 }; },
    'receipt revision': after => { after.islandEvents[0].id = `island-workshop:v1:operation:${JSON.stringify([owner, 8])}`; },
})) test(`rejects hidden corruption: ${name}`, () => {
    const before = initial(), after = brushed(before); corrupt(after);
    assert.throws(() => assertWorkshopDelta(before, after, owner, [action]));
});
test('sound setting requires both representations with every unrelated field held', () => {
    const before = initial(), after = structuredClone(before); after.profiles[0].soundEnabled = false;
    assert.throws(() => assertSettingsSoundDelta(before, after, owner, false));
    after.appData[0].profiles[owner].soundEnabled = false; assertSettingsSoundDelta(before, after, owner, false);
    after.logs[0].independent = true; assert.throws(() => assertSettingsSoundDelta(before, after, owner, false));
});
test('discovery is an exact additive receipt, not a general permission to change the island', () => {
    const before = initial(), after = structuredClone(before);
    after.islands[0].growth.discoveries.push({ id: 'leaf-bird', itemId: 'tree-1', discoveredAt: 40 });
    Object.assign(after.islands[0], { revision: 10, updatedAt: 40 });
    after.islandEvents.push({ id: JSON.stringify(['island-discovery-v1', owner, 'leaf-bird']), profileId: owner,
        type: 'discovery_observed', timestamp: 40, itemId: 'tree-1', discoveryId: 'leaf-bird' });
    assert.equal(assertDiscoveryDelta(before, after, owner).length, 1);
    after.islands[0].customization.points++; assert.throws(() => assertDiscoveryDelta(before, after, owner));
});
test('string key order follows IDB code units even where locale ordering differs', () => {
    assert.deepEqual(orderEvents(['a', '_', 'Z', '-'].map(id => ({ id }))).map(value => value.id), ['-', 'Z', '_', 'a']);
});
