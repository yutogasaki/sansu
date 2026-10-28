import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const folder = new URL('./evidence/', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, folder), 'utf8'));
const ui = await read('ui-v3.json'), before = await read('10-v3-before.json'), life = await read('live-v3.json');
const world = record => record.world[0].terrainRevision;
for (const record of Object.values(ui)) for (const key of ['land', 'terrain', 'plots', 'landmarks', 'keepsakes', 'villagers', 'character', 'drops', 'town'])
    assert.deepEqual(record.state[key], before.state[key], key);
for (const [a, b] of [['high', 'undoHigh'], ['high', 'redoHigh'], ['wide', 'undoWide'], ['wide', 'redoWide']]) {
    assert.deepEqual(ui[a].shape.shape, ui[b].shape.shape);
    assert.equal(world(ui[a]), world(ui[b]));
}
assert.equal(ui.restored.shape.shape, null);
assert.equal(world(ui.restored), world(before));
assert.deepEqual([ui.restored.shape.undo, ui.restored.shape.redo], [0, 3]);
assert.notEqual(world(ui.narrow), world(ui.wide));
const afterRedo = life.latest.filter(e => e.observedAt > ui.redoWide.at && e.worldRevision === world(ui.redoWide)
    && e.handlerAccepted && e.renderSucceeded && e.currentPlaceRevisionMatches && e.inFrustum && e.active && e.playActive);
assert.equal(afterRedo.length, 2);
const report = { status: 'PASS_LIMITED_UI', at: new Date().toISOString(), build: 'place-outline-v3',
    viewport: { width: 640, height: 774 }, target: before.url, ownershipAndOriginalTerrainUnchanged: true,
    undoRedoShapeAndWorldExact: true, fullRemovalRestoresOriginalWorld: true,
    afterRedoVisibleUses: afterRedo.map(e => ({ actor: e.receipt.actorId, target: e.receipt.targetId, at: e.observedAt })),
    limitations: ['Memory-only onboarding instance of the real GrowingIsland renderer', 'Existing bench/garden uses, not entry into the new high place',
        'Default centre 5,5 only in UI journey; no arbitrary-location acceptance', 'No normal save, offline, child or full-world acceptance'] };
await writeFile(new URL('ui-check.json', folder), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
