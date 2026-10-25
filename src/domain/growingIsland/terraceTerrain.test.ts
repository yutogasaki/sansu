import { afterEach, describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from './island';
import { TERRAIN_STEP, editableIslandWorld, editableTerrainSegmentSupported, terracePlanOf } from './editableTerrainWorld';
import { applyTerrainCommand, terrainOwnerSupported } from './terrainEditing';
import { setTerrainForm } from './terraceTerrain';
import { landBounds, landCells } from './space';
import { sceneLayout } from '../../components/island/growing/sceneLayout';
import { buildEditableGround } from '../../components/island/growing/editableGround';

const island = (heights: Record<string, number>) => Object.assign(newIsland('terrace-form', 0), {
    terrain: { version: 1 as const, heights, undo: [], redo: [] },
});
/** Something standing on the terrace gives it a reason for a stair. */
const holding = <S extends ReturnType<typeof island>>(state: S, ...cells: { x: number; z: number }[]): S => ({
    ...state, keepsakes: [...state.keepsakes, ...cells.map((cell, i) => ({ id: `held-${i}`, unitId: `held-${i}`, cell }))],
});
afterEach(() => setTerrainForm('continuous'));

describe('DEV terrace form over the same saved heights', () => {
    const plateau = () => {
        const b = landBounds(newIsland('terrace-form', 0)), x = b.maxX - 1;
        return { cells: [[x, 2], [x + 1, 2], [x, 3], [x + 1, 3]], beside: { x: x - 1, z: 3 }, x };
    };
    it('keeps flat tops up to a two-step cliff, so an owner next to it stays supported', () => {
        setTerrainForm('terrace');
        const { cells, beside, x } = plateau(), state = island(Object.fromEntries(cells.map(([a, b]) => [`${a},${b}`, 2])));
        const world = editableIslandWorld(state)!;
        expect(world.floorAt({ x: x + .3, z: 2.4 })!.point.y).toBeCloseTo(TERRAIN_STEP * 2, 6);
        expect(world.floorAt({ x: x - .54, z: 3 })!.point.y).toBeCloseTo(0, 6);
        expect(terrainOwnerSupported(state, beside)).toBe(true);
    });
    it('joins cells one step apart with a walkable grassy bank that keeps every footing', () => {
        setTerrainForm('terrace');
        const { cells, x } = plateau(), state = holding(island({ ...Object.fromEntries(cells.map(([a, b]) => [`${a},${b}`, 1])), '1,3': 1 }), { x: x + 1, z: 2 });
        const world = editableIslandWorld(state)!;
        expect(terracePlanOf(world)!.stairs).toEqual([]);
        for (const [a, b] of cells) for (const from of [{ x: a - 1, z: b }, { x: a, z: b + 1 }]) {
            if (cells.some(([c, d]) => c === from.x && d === from.z) || !world.floorAt(from)) continue;
            expect(editableTerrainSegmentSupported(world, from, { x: a, z: b })).toBe(true);
        }
        expect(landCells(state).filter(cell => !terrainOwnerSupported(state, cell))).toEqual([]);
    });
    it('gives an empty terrace no stair, and an occupied one exactly one', () => {
        setTerrainForm('terrace');
        const { cells, x } = plateau(), heights = Object.fromEntries(cells.map(([a, b]) => [`${a},${b}`, 2]));
        expect(terracePlanOf(editableIslandWorld(island(heights))!)!.stairs).toEqual([]);
        expect(terracePlanOf(editableIslandWorld(holding(island(heights), { x: x + 1, z: 2 }))!)!.stairs).toHaveLength(1);
    });
    it('blocks walking up a cliff and reaches the terrace only by a ruled stair ramp', () => {
        setTerrainForm('terrace');
        const { cells, x } = plateau(), state = holding(island(Object.fromEntries(cells.map(([a, b]) => [`${a},${b}`, 2]))), { x: x + 1, z: 2 });
        const world = editableIslandWorld(state)!, plan = terracePlanOf(world)!;
        expect(plan.stairs).toHaveLength(1);
        const { upper, lower } = plan.stairs[0];
        expect(editableTerrainSegmentSupported(world, lower, upper)).toBe(true);
        const cliff = cells.flatMap(([a, b]) => [{ x: a - 1, z: b }, { x: a, z: b - 1 }, { x: a, z: b + 1 }].map(from => ({ from, to: { x: a, z: b } })))
            .filter(({ from }) => !cells.some(([a, b]) => a === from.x && b === from.z) && !(from.x === lower.x && from.z === lower.z));
        expect(cliff.length).toBeGreaterThan(0);
        for (const { from, to } of cliff) expect(editableTerrainSegmentSupported(world, from, to)).toBe(false);
        expect(world.neighbors(upper, 'walk').length).toBeGreaterThan(0);
    });
    it('moves the stair off a landing that an owner takes, keeping the terrace reachable', () => {
        setTerrainForm('terrace');
        const { cells, x } = plateau(), state = holding(island(Object.fromEntries(cells.map(([a, b]) => [`${a},${b}`, 2]))), { x: x + 1, z: 2 });
        const first = terracePlanOf(editableIslandWorld(state)!)!.stairs[0];
        const owned = structuredClone(state);
        owned.keepsakes = [...owned.keepsakes, { id: 'landing-owner', unitId: 'landing-owner', cell: { ...first.upper } }];
        const moved = terracePlanOf(editableIslandWorld(owned)!)!.stairs;
        expect(moved).toHaveLength(1);
        expect(moved[0].upper).not.toEqual(first.upper);
        expect(editableTerrainSegmentSupported(editableIslandWorld(owned)!, moved[0].lower, moved[0].upper)).toBe(true);
    });
    it('keeps a stair on the edge nearest the home when something elsewhere moves', () => {
        setTerrainForm('terrace');
        const state = holding(island({ '1,4': 2, '2,4': 2 }), { x: 1, z: 4 });
        const before = terracePlanOf(editableIslandWorld(state)!)!.stairs;
        const after = terracePlanOf(editableIslandWorld(holding(state, { x: 4, z: 1 }))!)!.stairs;
        expect(after).toEqual(before);
        expect(after).toEqual([{ upper: { x: 2, z: 4 }, lower: { x: 2, z: 3 } }]);
    });
    it('draws stacked plates while the hidden floor still carries hits, and leaves the default form untouched', () => {
        const { cells, x } = plateau(), heights = Object.fromEntries(cells.map(([a, b]) => [`${a},${b}`, 2]));
        const continuous = editableIslandWorld(island(heights))!;
        expect(terracePlanOf(continuous)).toBeUndefined();
        setTerrainForm('terrace');
        const layout = sceneLayout(holding(island(heights), { x: x + 1, z: 2 }), true), drawn = buildEditableGround(layout);
        expect(drawn.root.getObjectByName('terrace-plates')).toBeDefined();
        expect(drawn.root.getObjectByName('terrace-stairs')).toBeDefined();
        expect(drawn.floor.material.visible).toBe(false);
        drawn.dispose();
        setTerrainForm('continuous');
        expect(editableIslandWorld(island(heights))!.definition).toEqual(continuous.definition);
    });
    it('keeps base hills as walkable slopes on a widened island, and lays the visible terrace on that floor', () => {
        setTerrainForm('terrace');
        const land = { expanded: 'east' as const, extra: ['west', 'south'] as ('west' | 'south')[], capes: [] };
        const state = Object.assign(island({ '7,3': 1, '7,4': 1, '8,3': 1 }), { land });
        const world = editableIslandWorld(state)!, plan = terracePlanOf(world)!;
        // Every cell can hold an owner: a stair's foot does too, because the stair moves aside.
        expect(landCells(state).filter(cell => !terrainOwnerSupported(state, cell))).toEqual([]);
        expect(plan.stairs.length).toBeLessThanOrEqual(1);
        const layout = sceneLayout(state, true), drawn = buildEditableGround(layout), plates = drawn.root.getObjectByName('terrace-plates')!;
        drawn.root.updateMatrixWorld(true);
        let checked = 0;
        for (let z = .2; z < 7.6; z += .45) for (let x = -2.7; x < 8.6; x += .45) {
            const fx = x - Math.round(x), fz = z - Math.round(z);
            if (Math.abs(fx) > .3 || Math.abs(fz) > .3) continue; // away from cliffs and rounded corners
            if (plan.stairs.some(s => s.lower.x === Math.round(x) && s.lower.z === Math.round(z))) continue; // treads carry the ramp
            const sampleAt = world.floorAt({ x, z }); if (!sampleAt) continue;
            const ray = new T.Raycaster(new T.Vector3(sampleAt.point.x - layout.center, 20, sampleAt.point.z - 2), new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(plates)[0];
            if (!hit) continue;
            expect(Math.abs(hit.point.y - sampleAt.point.y)).toBeLessThan(.03);
            checked++;
        }
        expect(checked).toBeGreaterThan(60);
        drawn.dispose();
    });
    it('never strands something the child placed: no edit or placement out of walking reach', () => {
        setTerrainForm('terrace');
        const pad = { x: 4, z: 3 };
        const state = holding(island({ '4,3': 2 }), pad);
        expect(terracePlanOf(editableIslandWorld(state)!)!.stranded).toBe(0);
        // A third step would leave the pad beyond any stair.
        expect(() => applyTerrainCommand(structuredClone(state), { type: 'terrain-edit', cell: pad, delta: 1 })).toThrow('のぼれない');
        // An empty pad three steps up cannot take an owner either.
        const high = island({ '4,3': 3 });
        expect(terrainOwnerSupported(high, pad)).toBe(false);
        expect(terrainOwnerSupported(island({ '4,3': 2 }), pad)).toBe(true);
    });
});
