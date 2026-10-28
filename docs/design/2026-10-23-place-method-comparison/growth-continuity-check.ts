import assert from 'node:assert/strict';
import * as T from 'three';
import observedJSON from './evidence/33-F2-used-state.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent, canPlace, landQuote } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { landBounds, reachableFromHome, key } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState, Side } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { GrowingLife } from '../../../src/components/island/growing/growingLife';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';

declare const GROWTH_DIAGNOSTIC_MODE: 'A' | 'F';
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const fixture: GrowingState = { ...newIsland('growth-continuity-33', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))), drops: 10_000 };
const rights = (state: GrowingState) => ({ plots: state.plots.map(plot => ({ id: plot.id, kind: plot.kind, cell: plot.cell, growth: plot.growth, stage: plot.stage })),
    landmarks: state.landmarks, villagers: state.villagers, keepsakes: state.keepsakes });
const owners = (state: GrowingState) => {
    const world = editableIslandWorld(state)!, original = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true);
    return [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => {
        if (!owner.cell) return [];
        const centerY = world.floorAt(owner.cell)?.point.y, oldCenter = original.floorAt(owner.cell)?.point.y;
        let maxAdditionalTilt = 0, wetProbes = 0;
        let worstPoint: Cell | undefined;
        for (const x of [-.46, -.23, 0, .23, .46]) for (const z of [-.46, -.23, 0, .23, .46]) {
            const cell = { x: owner.cell.x + x, z: owner.cell.z + z }, y = world.floorAt(cell)?.point.y, old = original.floorAt(cell)?.point.y;
            if (y === undefined || centerY === undefined || old === undefined || oldCenter === undefined) { wetProbes++; continue; }
            const tilt = Math.abs((y - centerY) - (old - oldCenter));
            if (tilt > maxAdditionalTilt) { maxAdditionalTilt = tilt; worstPoint = cell; }
        }
        return [{ id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell),
            canPlaceAgain: canPlace(state, owner.cell, owner.id), centerY: centerY ?? null, maxAdditionalTilt, worstPoint, wetProbes }];
    });
};

function actualVisit(state: GrowingState, actorId: string, next?: GrowingState) {
    const places = derivePlaces(state), place = places.find(place => place.ruleId === 'P05' && place.useTargets.some(target => target.kind === 'garden'));
    const result = { actorId, placeId: place?.id ?? null, accepted: false, arrivalAt: null as number | null,
        receiptAt: null as number | null, climbed: 0, unsupportedSteps: 0,
        transition: undefined as undefined | { beforeCell: Cell; afterCell: Cell; logicalDisplacement: number; yChange: number; floorChange: number | null; remainsOnFloor: boolean; transitionSafe: boolean } };
    if (!place) return result;
    const world = editableIslandWorld(state)!, materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state, true), layer = buildObjectLayer(materials, state, layout);
    const life = new GrowingLife(materials, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
    let nextLayer: ReturnType<typeof buildObjectLayer> | undefined;
    try {
        life.sync(state, layout, layer); life.tick(0, 0, true, false);
        const start = life.positionOf(actorId); if (!start) return result;
        const startY = start.y, target = place.useTargets.find(target => target.kind === 'garden')!;
        let previous = layout.logicalAt(start), time = 0;
        result.accepted = life.visitPlace(actorId, place.id, 0, 'garden');
        if (result.accepted) for (time = 20; time <= 40_000; time += 20) {
            life.tick(time, 20, true, false); life.tick(time, 0, true, false);
            const position = life.positionOf(actorId)!, at = layout.logicalAt(position);
            if (!editableTerrainSegmentSupported(world, previous, at)) result.unsupportedSteps++;
            previous = at;
            if (Math.hypot(at.x - target.cell.x, at.z - target.cell.z) < 1e-6 && result.arrivalAt === null) result.arrivalAt = time;
            const receipt = life.takePlaceUses().find(receipt => receipt.actorId === actorId && receipt.placeId === place.id);
            if (receipt) { result.receiptAt = time; result.climbed = position.y - startY; break; }
        }
        if (result.receiptAt !== null) assert(result.arrivalAt !== null && result.receiptAt - result.arrivalAt >= 700);
        if (next && result.receiptAt !== null) {
            const beforePosition = life.positionOf(actorId)!.clone(), beforeCell = layout.logicalAt(beforePosition);
            const nextLayout = sceneLayout(next, true), nextWorld = editableIslandWorld(next)!;
            const transitionSafe = life.terrainTransitionSafe(next);
            nextLayer = buildObjectLayer(materials, next, nextLayout);
            life.sync(next, nextLayout, nextLayer); life.tick(time, 0, true, false);
            const afterPosition = life.positionOf(actorId)!, afterCell = nextLayout.logicalAt(afterPosition);
            const beforeFloor = world.floorAt(beforeCell)?.point.y, afterFloor = nextWorld.floorAt(afterCell)?.point.y;
            result.transition = { beforeCell, afterCell, logicalDisplacement: Math.hypot(beforeCell.x - afterCell.x, beforeCell.z - afterCell.z),
                yChange: afterPosition.y - beforePosition.y, floorChange: beforeFloor === undefined || afterFloor === undefined ? null : afterFloor - beforeFloor,
                remainsOnFloor: afterFloor !== undefined && Math.abs(afterPosition.y - afterFloor) < .05, transitionSafe };
        }
        return result;
    } finally { life.dispose(); nextLayer?.dispose(); layer.dispose(); materials.dispose(); }
}

function delta(before: GrowingState, after: GrowingState) {
    const a = editableIslandWorld(before)!, b = editableIslandWorld(after)!, bounds = landBounds(before);
    let changed = 0, lostDry = 0, becameDry = 0, maxRise = 0, maxDrop = 0;
    let maxRiseAt: Cell | undefined, maxDropAt: Cell | undefined;
    const examples: { cell: Cell; before: number | null; after: number | null }[] = [];
    const lostDryExamples: { cell: Cell; before: number }[] = [];
    for (let z = -5; z <= (bounds.depth - 1) * 10 + 5; z++) for (let x = bounds.minX * 10 - 5; x <= bounds.maxX * 10 + 5; x++) {
        const cell = { x: x / 10, z: z / 10 }, y0 = a.floorAt(cell)?.point.y, y1 = b.floorAt(cell)?.point.y;
        if (y0 === undefined && y1 !== undefined) becameDry++;
        if (y0 !== undefined && y1 === undefined) { lostDry++; if (lostDryExamples.length < 8) lostDryExamples.push({ cell, before: y0 }); }
        if (y0 !== undefined && y1 !== undefined) {
            if (y1 - y0 > maxRise) { maxRise = y1 - y0; maxRiseAt = cell; }
            if (y0 - y1 > maxDrop) { maxDrop = y0 - y1; maxDropAt = cell; }
        }
        if (y0 === undefined && y1 === undefined || y0 !== undefined && y1 !== undefined && Math.abs(y1 - y0) < .02) continue;
        changed++; if (examples.length < 8) examples.push({ cell, before: y0 ?? null, after: y1 ?? null });
    }
    const initialCenters = [];
    for (let z = 0; z <= 4; z++) for (let x = 0; x <= 5; x++) {
        const cell = { x, z }, y0 = a.floorAt(cell)?.point.y, y1 = b.floorAt(cell)?.point.y;
        if (y0 === undefined && y1 === undefined || y0 !== undefined && y1 !== undefined && Math.abs(y1 - y0) < 1e-7) continue;
        initialCenters.push({ cell, saved: before.terrain!.heights[key(cell)] ?? 0, before: y0 ?? null, after: y1 ?? null });
    }
    const beforeReach = reachableFromHome(before, undefined, a), afterReach = reachableFromHome(after, undefined, b);
    const lostReachable = [...beforeReach].filter(cell => !afterReach.has(cell));
    return { sampledPreviousBounds: bounds, changedMoreThan2cm: changed, lostDry, lostDryExamples, becameDry, maxRise, maxDrop, maxRiseAt, maxDropAt, examples, initialCenters,
        lostReachableCount: lostReachable.length, lostReachableExamples: lostReachable.slice(0, 12),
        pierBefore: { x: bounds.maxX - 1, z: bounds.depth - 1 },
        pierAfter: { x: landBounds(after).maxX - 1, z: landBounds(after).depth - 1 } };
}

const describe = (state: GrowingState) => ({ bounds: landBounds(state), owners: owners(state),
    places: derivePlaces(state).map(place => ({ id: place.id, ruleId: place.ruleId, revision: place.revision,
        targets: place.useTargets.map(target => ({ id: target.id, kind: target.kind, cell: target.cell })) })),
    visits: ['pokomoko', 'v2'].map(actor => actualVisit(state, actor)) });
const initial = describe(fixture), branches = [];
for (const order of [['west', 'east', 'south'], ['east', 'west', 'south']] as Side[][]) {
    let state = structuredClone(fixture); const steps = [];
    for (const [index, side] of order.entries()) {
        const quote = landQuote(state); assert(quote); assert(quote.sides.includes(side));
        const before = state;
        state = applyIntent(state, { id: `growth-${order[0]}-${index}`, command: { type: 'expand', side } }, 1000 + index).state;
        assert.equal(state.drops, before.drops - quote.price);
        assert.deepEqual(state.terrain, before.terrain, 'Expansion must retain saved heights and undo/redo');
        assert.deepEqual(rights(state), rights(before), 'Expansion must not change existing owner identities/placements');
        assert.deepEqual(state.placeProgress?.useHistory, before.placeProgress?.useHistory);
        const restored: GrowingState = JSON.parse(JSON.stringify(state));
        assert.deepEqual(editableIslandWorld(restored)!.definition, editableIslandWorld(state)!.definition);
        const beforeOwners = owners(before), after = describe(state);
        steps.push({ side, cost: quote.price, delta: delta(before, state), ...after,
            newlyUnsupported: after.owners.filter(owner => !owner.supported && beforeOwners.find(old => old.id === owner.id)?.supported),
            liveGardenTransition: ['pokomoko', 'v2'].map(actor => actualVisit(before, actor, state)),
            savedTerrainUnchanged: true, serializationRestored: true });
    }
    branches.push({ order, steps });
}
console.log(JSON.stringify({ mode: GROWTH_DIAGNOSTIC_MODE, status: 'DIAGNOSTIC',
    fixture: 'input33 read-only UI snapshot; drops=10000 is an explicit economy fixture; each acquisition uses ordinary expand; no UI purchase proof',
    initial, branches, outsideScope: ['real UI acquisition', 'learning/economy eligibility', 'DB transaction', 'offscreen actor positions'] }, null, 2));
