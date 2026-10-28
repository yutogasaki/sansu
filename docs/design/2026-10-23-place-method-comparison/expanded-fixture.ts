import assert from 'node:assert/strict';
import observedJSON from './evidence/49-H-high-placed-state.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent, landQuote } from '../../../src/domain/growingIsland/commands';
import { terrainOwnerSupported, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { landBounds } from '../../../src/domain/growingIsland/space';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import type { Cell, Command, GrowingState, Side } from '../../../src/domain/growingIsland/types';
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const original: GrowingState = { ...newIsland('expanded-comparison-fixture', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))) };
const budget = 10_000;
let state = { ...structuredClone(original), drops: budget };
const commands: { command: Command; accepted: boolean; before?: number; after?: number; price?: number; reason?: string }[] = [];
const apply = (command: Command, price?: number) => {
    const previous = structuredClone(state), cell = command.type === 'terrain-edit' ? command.cell : undefined;
    const key = cell && `${cell.x},${cell.z}`, before = key ? state.terrain!.heights[key] ?? 0 : undefined;
    try {
        const next = applyIntent(state, { id: `expanded-fixture-${commands.length}`, command }, 1000 + commands.length).state;
        validateTerrain(next);
        state = next; commands.push({ command, accepted: true, before, after: key ? state.terrain!.heights[key] ?? 0 : undefined, price });
        return true;
    } catch (error) {
        assert.deepEqual(state, previous, 'Rejected fixture command must not change state');
        commands.push({ command, accepted: false, before, after: before, price, reason: String(error) }); return false;
    }
};
for (const side of ['east', 'west', 'south'] as Side[]) {
    const quote = landQuote(state); assert(quote); assert(quote.sides.includes(side));
    assert(apply({ type: 'expand', side }, quote.price), `Expansion ${side} was rejected`);
}
const inheritedAfterAcquisition = structuredClone(state.terrain!.heights), bounds = landBounds(state);
const wanted = ({ x, z }: Cell) => {
    if (x >= 0 && x <= 2 && (z === 5 || z === 6)) return 3;
    if ((x === -1 || x === 3) && (z === 5 || z === 6) || x >= 0 && x <= 2 && z === 7) return 2;
    if ((x === -2 || x === 4) && (z === 5 || z === 6)) return 1;
    if (x === 8 && z >= 4 && z <= 6) return -1;
    return 0;
};
const desired: { cell: Cell; height: number }[] = [];
for (let z = 0; z < bounds.depth; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
    if (x >= 0 && x <= 5 && z <= 4) continue;
    desired.push({ cell: { x, z }, height: wanted({ x, z }) });
}
// Only new cells are edited. Existing ownership, age, position and old30 inputs
// are never patched to force the visual brief through the command guards.
for (const { cell, height } of desired) {
    const key = `${cell.x},${cell.z}`;
    while ((state.terrain!.heights[key] ?? 0) !== height) {
        const before = state.terrain!.heights[key] ?? 0;
        if (!apply({ type: 'terrain-edit', cell, delta: height > before ? 1 : -1 })) break;
        assert.notEqual(state.terrain!.heights[key] ?? 0, before);
    }
}
for (let z = 0; z <= 4; z++) for (let x = 0; x <= 5; x++) {
    const key = `${x},${z}`; assert.equal(state.terrain!.heights[key] ?? 0, original.terrain!.heights[key] ?? 0);
}
for (const field of ['plots', 'landmarks', 'villagers', 'keepsakes'] as const) assert.deepEqual(state[field], original[field]);
assert.equal(state.drops, budget - 120 - 240 - 480);
validateTerrain(state);
const restored = JSON.parse(JSON.stringify(state)) as GrowingState;
assert.deepEqual(editableIslandWorld(restored)!.definition, editableIslandWorld(state)!.definition);
const unresolved = desired.flatMap(({ cell, height }) => (state.terrain!.heights[`${cell.x},${cell.z}`] ?? 0) === height ? []
    : [{ cell, desired: height, actual: state.terrain!.heights[`${cell.x},${cell.z}`] ?? 0 }]);
console.log(JSON.stringify({ state, status: unresolved.length ? 'PARTIAL_VISUAL_BRIEF' : 'COMPLETE_VISUAL_BRIEF',
    fixture: 'Read-only observed49 merged into newIsland; explicit diagnostic drops=10000; ordinary expand east/west/south through trial seam then ordinary edits only on new cells. Not earned currency or saved player data.',
    originalDrops: original.drops, budget, inheritedAfterAcquisition, commands, unresolved,
    stats: { accepted: commands.filter(c => c.accepted).length, rejected: commands.filter(c => !c.accepted).length,
        old30HeightsUnchanged: true, ownersUnchanged: true, jsonRestore: true },
    owners: [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => owner.cell ? [{ id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell) }] : []),
    places: derivePlaces(state).map(p => ({ id: p.id, family: p.family, stage: p.stage, targets: p.useTargets })),
    limits: ['no DB access or saved-player replacement', 'not a learning/economy proof', 'normal edits may reject parts of visual brief',
        'F+current seam is the builder; A/H projection does not prove those modes replay every command', 'no actor snapshots in this diagnostic build'] }, null, 2));
