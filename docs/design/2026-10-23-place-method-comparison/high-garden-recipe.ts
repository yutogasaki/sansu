import assert from 'node:assert/strict';
import * as T from 'three';
import observedJSON from './evidence/42-H-redone-state.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { GrowingLife } from '../../../src/components/island/growing/growingLife';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';

type Observed = Pick<GrowingState, 'land' | 'terrain' | 'plots' | 'landmarks' | 'villagers' | 'keepsakes' | 'placeProgress' | 'town' | 'drops' | 'character'>;
const observed = observedJSON as unknown as Observed;
// This is a read-only UI evidence fixture. It does not write to any database or
// claim that the following commands have been executed by a person in the UI.
let state: GrowingState = { ...newIsland('observed-input-42-high-terrace', 1000),
    ...structuredClone(Object.fromEntries(Object.keys(observed).filter(key =>
        ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'].includes(key))
        .map(key => [key, observed[key as keyof Observed]]))) };
const initial = structuredClone(state), commands: Command[] = [];
const supportedPlots = () => state.plots.map(plot => ({ id: plot.id, cell: plot.cell, supported: !plot.cell || terrainOwnerSupported(state, plot.cell) }));
const initialPlots = supportedPlots();
let failure = '';
const apply = (command: Command) => {
    state = applyIntent(state, { id: `observed-F-${commands.length + 1}`, command }, 1000 + commands.length).state;
    commands.push(command);
    assert(supportedPlots().every(plot => plot.supported), 'An existing plot lost its physical support');
};
try {
    assert(initialPlots.every(plot => plot.supported), 'The observed input already has an unsupported plot');
    apply({ type: 'store', id: 'starter-flower' });
    apply({ type: 'store', id: 'starter-bench' });
    // A coherent high garden, its approaches, and a shallow opposite cove.
    // All mutations below go through the ordinary domain command guard.
    const targets = [
        [5, 0, 1], [5, 1, -1], [5, 2, -1],
        [0, 3, 2], [1, 2, 1], [2, 2, 2], [3, 2, 1], [3, 3, 2], [3, 4, 2],
        [1, 3, 3], [2, 3, 3], [1, 4, 3], [2, 4, 3],
    ];
    for (const [x, z, height] of targets) {
        const key = `${x},${z}`;
        while ((state.terrain?.heights[key] ?? 0) !== height) {
            const before = state.terrain?.heights[key] ?? 0;
            apply({ type: 'terrain-edit', cell: { x, z }, delta: height > before ? 1 : -1 });
            assert.notEqual(state.terrain?.heights[key] ?? 0, before, `Command rejected at ${key} toward ${height}`);
        }
    }
    const finalTerrain = structuredClone(state.terrain);
    apply({ type: 'terrain-undo' }); apply({ type: 'terrain-redo' });
    assert.deepEqual(state.terrain, finalTerrain);
    apply({ type: 'unstore', id: 'starter-flower', cell: { x: 2, z: 3 } });
    apply({ type: 'unstore', id: 'starter-bench', cell: { x: 2, z: 4 } });
} catch (error) { failure = error instanceof Error ? error.message : String(error); }
const world = editableIslandWorld(state)!, place = derivePlaces(state).find(place => place.ruleId === 'P05' && place.useTargets.some(target => target.kind === 'garden'));
const actors = [];
if (!failure && place) for (const actorId of ['pokomoko', 'v2']) {
    const materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state, true), layer = buildObjectLayer(materials, state, layout);
    const life = new GrowingLife(materials, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
    let arrivalAt: number | null = null, receiptAt: number | null = null, climb = 0, steps = 0, recorded = false;
    try {
        life.sync(state, layout, layer); life.tick(0, 0, true, false);
        const start = life.positionOf(actorId); assert(start, 'The observed resident must exist in the real life controller');
        const startY = start.y;
        let previous = layout.logicalAt(start);
        const target = place.useTargets.find(target => target.kind === 'garden')!;
        const accepted = life.visitPlace(actorId, place.id, 0, 'garden');
        if (accepted) for (let now = 20; now <= 40_000; now += 20) {
            life.tick(now, 20, true, false); life.tick(now, 0, true, false); steps++;
            const position = life.positionOf(actorId)!, current = layout.logicalAt(position);
            assert(editableTerrainSegmentSupported(world, previous, current), 'An actor crossed unsupported floor');
            previous = current;
            if (Math.hypot(current.x - target.cell.x, current.z - target.cell.z) < 1e-6 && arrivalAt === null) arrivalAt = now;
            const receipt = life.takePlaceUses().find(receipt => receipt.actorId === actorId && receipt.placeId === place.id);
            if (receipt) {
                receiptAt = now; climb = position.y - startY;
                // Domain acknowledgement only; expectedRevision=0 is not a
                // repository transaction or a claim about persisted DB state.
                apply({ type: 'place-used', profileId: 'observed-input-42-high-terrace', expectedRevision: 0, ...receipt });
                recorded = state.placeProgress?.useHistory?.some(fact => fact.actorId === actorId && fact.targetId === receipt.targetId && fact.revision === receipt.revision) ?? false;
                assert(recorded); break;
            }
        }
        if (receiptAt !== null) assert(arrivalAt !== null && receiptAt - arrivalAt >= 700, 'A receipt must follow real arrival and use');
        actors.push({ actorId, accepted, arrivalAt, receiptAt, climb, steps, recorded });
    } finally { life.dispose(); layer.dispose(); materials.dispose(); }
}
const restored: GrowingState = JSON.parse(JSON.stringify(state));
assert.deepEqual(editableIslandWorld(restored)!.definition, world.definition);
assert.deepEqual(derivePlaces(restored), derivePlaces(state));
assert.deepEqual(restored.placeProgress, state.placeProgress);
assert.deepEqual(state.plots, initial.plots); assert.deepEqual(state.villagers, initial.villagers); assert.deepEqual(state.land, initial.land);

const owners = (input: GrowingState) => input.landmarks.map(item => { const copy = { ...item }; delete copy.cell; return copy; });
assert.deepEqual(owners(state), owners(initial));
console.log(JSON.stringify({ status: !failure && actors.length === 2 && actors.every(actor => actor.receiptAt !== null) ? 'PASS' : 'FAIL',
    fixture: 'read-only evidence/42-H-redone-state.json merged into newIsland; normal store/edit/unstore commands; diagnostic only',
    failure, initialPlots, finalPlots: supportedPlots(), commands, heights: state.terrain!.heights,
    owners: state.landmarks, actors, serializationRestored: true,
    outsideScope: ['UI input', 'WebGL and actual appearance', 'DB save transaction', 'live actor editing safety snapshots', 'bench seating receipt'] }, null, 2));
