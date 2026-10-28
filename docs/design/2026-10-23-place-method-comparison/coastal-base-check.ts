import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { HOUSE_CELLS, landBounds } from '../../../src/domain/growingIsland/space';
import { landscapePoint } from '../../../src/domain/growingIsland/landscape';
import { worldFloorGeometry } from '../../../src/components/island/growing/worldFloorGeometry';
import type { GrowingState, Command } from '../../../src/domain/growingIsland/types';
import { createCoastalBaseField, COASTAL_BASE_REVISION } from './coastal-base-field';

declare const COASTAL_BASE_MODE: 'A' | 'G';
const mode = COASTAL_BASE_MODE;
let sequence = 0;
const apply = (state: GrowingState, command: Command) => applyIntent(state, { id: `g-${++sequence}`, command }, 1000).state;
const fixture = (name: string, heights: Record<string, number>, expanded = false) => {
    const state = newIsland(name, 0); if (expanded) { state.land.expanded = 'east'; state.land.extra = ['west', 'south']; }
    state.terrain = { version: 1, heights, undo: [], redo: [] }; return state;
};
const recordedInput = JSON.parse(readFileSync('docs/design/2026-10-23-place-method-comparison/evidence/18-terrace-input-state.json', 'utf8')) as Pick<GrowingState, 'land' | 'terrain' | 'plots' | 'landmarks' | 'keepsakes'>;
const recorded = { ...newIsland('recorded-UI-input', 0), land: recordedInput.land, terrain: recordedInput.terrain, plots: recordedInput.plots, landmarks: recordedInput.landmarks, keepsakes: recordedInput.keepsakes };
const runs = [];
for (const [name, state] of [['zero', fixture('zero', {})], ['expanded', fixture('expanded', {}, true)], ['negative-west-opening', fixture('negative-west-opening', { '0,3': -4, '0,4': -4 })],
    ['positive-corner', fixture('positive-corner', { '5,0': 3 })], ['mixed-coast', fixture('mixed-coast', { '0,3': -4, '5,0': 3, '5,2': -4 })], ['recorded-UI-input', recorded]] as const) {
    const before = JSON.stringify(state), started = performance.now(), world = editableIslandWorld(state)!;
    const compileMs = performance.now() - started, bounds = landBounds(state);
    const unowned = structuredClone(state); unowned.landmarks = []; unowned.plots = []; unowned.keepsakes = [];
    assert.equal(editableIslandWorld(unowned), world);
    const reordered = structuredClone(state); reordered.terrain!.heights = Object.fromEntries(Object.entries(state.terrain!.heights).reverse());
    assert.equal(editableIslandWorld(reordered), world); assert.equal(JSON.stringify(state), before);
    const owners = [...state.landmarks, ...state.plots, ...state.keepsakes].filter(owner => owner.cell).map(owner => ({ id: owner.id, cell: owner.cell!, supported: terrainOwnerSupported(state, owner.cell!) }));
    // Compare only originally legal owners with A in the runner; raw negative
    // fixtures can intentionally be illegal even in A, and are labelled as such.
    const pinSamples = [];
    for (const cell of [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }]) for (const dx of [-.46, -.23, 0, .23, .46]) for (const dz of [-.46, -.23, 0, .23, .46])
        pinSamples.push(world.floorAt({ x: cell.x + dx, z: cell.z + dz })?.point.y ?? null);
    const centers = world.sites.filter(site => site.placement).map(site => ({ cell: site.cell, height: world.floorAt(site.cell)?.point.y ?? null, supported: terrainOwnerSupported(state, site.cell) }));
    const surfaceSamples = [];
    for (let z = -10; z <= (bounds.depth + 1) * 10; z++) for (let x = (bounds.minX - 1) * 10; x <= (bounds.maxX + 1) * 10; x++) {
        const cell = { x: x / 10, z: z / 10 }; surfaceSamples.push({ ...cell, height: world.floorAt(cell)?.point.y ?? null });
    }
    if (state.terrain!.heights['0,3'] === -4) for (let x = -1; x <= 0; x += .05)
        assert.equal(world.floorAt({ x, z: 3 }), undefined, 'Negative shore input must remain open to the sea');
    const geometry = worldFloorGeometry(world), material = new T.MeshBasicMaterial({ side: T.DoubleSide }), mesh = new T.Mesh(geometry, material);
    mesh.updateMatrixWorld(true); const ray = new T.Raycaster(); let rayError = 0, rayProbes = 0;
    for (let z = 0; z <= 8; z++) for (let x = -1; x <= 12; x++) {
        const cell = { x: x / 2 + .013, z: z / 2 + .017 }, physical = landscapePoint(cell), floor = world.floorAt(cell);
        ray.set(new T.Vector3(physical.x, 10, physical.z), new T.Vector3(0, -1, 0)); const hit = ray.intersectObject(mesh)[0];
        assert.equal(Boolean(hit), Boolean(floor)); if (hit && floor) { rayError = Math.max(rayError, Math.abs(hit.point.y - floor.point.y)); rayProbes++; }
    }
    assert(rayError < .002); geometry.dispose(); material.dispose(); let walkEdges = 0;
    for (const site of world.walkSites) for (const neighbor of world.neighbors(site.cell, 'walk')) {
        assert(editableTerrainSegmentSupported(world, site.cell, neighbor)); walkEdges++;
    }
    const geometryHash = createHash('sha256').update(JSON.stringify(world.definition.districts)).digest('hex');
    const walkGraphHash = createHash('sha256').update(JSON.stringify(world.definition.edges)).digest('hex');
    runs.push({ name, bounds, compileMs, geometryHash, walkGraphHash, owners, centers, pinSamples, surfaceSamples, rayError, rayProbes, walkEdges });
}
// Pure base depends on land/position alone, and supports independent positive
// or negative offset interpolation (F can replace this term without changing G).
const pureState = fixture('pure-base', {}), bounds = landBounds(pureState);
const options = { minX: bounds.minX - .5, maxX: bounds.maxX + .5, minZ: -.5, maxZ: bounds.depth - .5, seaLevel: -.4 };
const pure = createCoastalBaseField(pureState, () => 0, options), different = structuredClone(pureState);
different.terrain!.heights = { '0,3': 12, '5,0': -4 }; different.landmarks = [];
const changedInputs = createCoastalBaseField(different, () => 0, options);
let pureProbes = 0;
for (let z = -10; z <= 50; z++) for (let x = -10; x <= 60; x++) {
    const cell = { x: x / 10, z: z / 10 }; assert.equal(pure.heightAt(cell), changedInputs.heightAt(cell)); assert(pure.heightAt(cell) <= 0); pureProbes++;
}
// Normal edit -> undo -> redo with real initial owned objects. Evaluate both
// common dry points and lost/gained dry points; a newly wet point on raise fails.
const transitions = [];
for (const cell of [{ x: 0, z: 3 }, { x: 5, z: 0 }]) {
    let state = fixture('command-series', {});
    for (const delta of [-1, -1, -1, -1, ...Array<number>(16).fill(1)]) {
        const previous = editableIslandWorld(state)!; let next: GrowingState;
        try { next = apply(state, { type: 'terrain-edit', cell, delta: delta as -1 | 1 }); }
        catch (error) { transitions.push({ cell, delta, accepted: false, error: String(error) }); break; }
        const after = editableIslandWorld(next)!; let maxRise = 0, maxDrop = 0, dryLost = 0, dryGained = 0;
        for (let z = 0; z <= 40; z++) for (let x = 0; x <= 50; x++) {
            const at = { x: x / 10, z: z / 10 }, a = previous.floorAt(at)?.point.y, b = after.floorAt(at)?.point.y;
            if (a !== undefined && b === undefined) dryLost++; if (a === undefined && b !== undefined) dryGained++;
            if (a !== undefined && b !== undefined) { maxRise = Math.max(maxRise, b - a); maxDrop = Math.max(maxDrop, a - b); }
        }
        assert(delta > 0 ? dryLost === 0 && maxDrop < 1e-7 && maxRise <= .180000001 : dryGained === 0 && maxRise < 1e-7 && maxDrop <= .180000001);
        assert(next.landmarks.every(owner => !owner.cell || terrainOwnerSupported(next, owner.cell)));
        const undone = apply(next, { type: 'terrain-undo' }), redone = apply(undone, { type: 'terrain-redo' });
        assert.deepEqual(editableIslandWorld(undone)!.definition, previous.definition);
        assert.deepEqual(editableIslandWorld(redone)!.definition, after.definition);
        transitions.push({ cell, delta, accepted: true, center: after.floorAt(cell)?.point.y ?? null, maxRise, maxDrop, dryLost, dryGained }); state = next;
    }
}
console.log(JSON.stringify({ mode, revision: mode === 'G' ? COASTAL_BASE_REVISION : 'shared-foundation-A', at: new Date().toISOString(), pureProbes, baseProof: pure.proof, runs, transitions }));
