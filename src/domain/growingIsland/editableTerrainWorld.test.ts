import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from './island';
import { editableIslandWorld, editableTerrainSegmentSupported, terrainRevision } from './editableTerrainWorld';
import { compileWorldDefinition } from './worldDefinition';
import { legacyIslandWorld } from './legacyWorldDefinition';
import { sceneLayout } from '../../components/island/growing/sceneLayout';
import { buildEditableGround } from '../../components/island/growing/editableGround';

const island = (heights: Record<string, number>) => Object.assign(newIsland('terrain-geometry', 0), {
    terrain: { version: 1 as const, heights, undo: [], redo: [] },
});

describe('saved editable terrain geometry', () => {
    it('does not change the pre-edit renderer and retains acquired anchors through a carved shore', () => {
        const before = newIsland('terrain-geometry', 0);
        expect(editableIslandWorld(before)).toBeUndefined();
        const state = island({ '0,3': -4, '0,4': -4 });
        const world = editableIslandWorld(state)!, legacy = legacyIslandWorld(before, true);
        expect(world.owns({ x: 0, z: 4 })).toBe(true);
        expect(world.floorAt({ x: 0, z: 4 })).toBeUndefined();
        for (let x = -.9; x <= 0; x += .1) expect(world.floorAt({ x, z: 4 })).toBeUndefined();
        expect(world.anchorAt({ x: 0, z: 4 })).toEqual(legacy.anchorAt({ x: 0, z: 4 }));
        expect(world.floorAt({ x: 3, z: 2 })!.point).toEqual(legacy.floorAt({ x: 3, z: 2 })!.point);
        expect(world.neighbors({ x: 0, z: 4 }, 'walk')).toEqual([]);
        expect(world.neighbors({ x: 0, z: 4 }, 'join')).toEqual([]);
        expect(world.neighbors({ x: 0, z: 4 }, 'water')).toEqual([]);
    });
    it('retains the acquired bridge and its walk grants when editing elsewhere', () => {
        const state = island({ '0,3': -4 }); state.bridge = { x: 2 };
        const world = editableIslandWorld(state)!;
        expect(world.neighbors({ x: 2, z: 4 }, 'walk')).toContainEqual({ x: 2, z: 5 });
        expect(world.neighbors({ x: 2, z: 5 }, 'walk')).toContainEqual({ x: 2, z: 6 });
        expect(editableTerrainSegmentSupported(world, { x: 2, z: 4 }, { x: 2, z: 5 })).toBe(true);
    });
    it('uses the actual curved mesh for height, inverse hits and dry support at non-grid positions', () => {
        const state = island({ '0,3': -4, '0,4': -4, '4,3': 2, '5,3': 2 });
        const layout = sceneLayout(state, true), world = layout.world, drawn = buildEditableGround(layout);
        expect(layout.editable).toBe(true); expect(layout.authored).toBe(false); expect(layout.actorVisualScale).toBe(1);
        drawn.root.updateMatrixWorld(true);
        for (let z = .13; z < 4.5; z += .37) for (let x = -.3; x < 5.4; x += .41) {
            const sample = world.floorAt({ x, z }); if (!sample) continue;
            const origin = new T.Vector3(sample.point.x - layout.center, 10, sample.point.z - 2);
            const actual = new T.Raycaster(origin, new T.Vector3(0, -1, 0)).intersectObject(drawn.floor)[0];
            expect(actual).toBeDefined(); expect(actual.point.y).toBeCloseTo(sample.point.y, 5);
            expect(world.logicalAt(sample.point)?.x).toBeCloseTo(x, 6);
            expect(layout.heightAt({ x, z })).toBeCloseTo(sample.point.y, 8);
        }
        drawn.dispose();
    });
    it('closes steep edges, restores identical triangles on undo, and ignores undo receipt changes in the geometry identity', () => {
        const state = island({ '4,3': 12 }), world = editableIslandWorld(state)!;
        expect(world.neighbors({ x: 4, z: 3 }, 'walk')).toEqual([]);
        const same = structuredClone(state); same.terrain.heights = { '1,1': 0, '4,3': 12 };
        expect(terrainRevision(same)).toBe(terrainRevision(state)); expect(editableIslandWorld(same)).toBe(world);
        const lowered = island({ '4,3': 1 }); expect(editableIslandWorld(lowered)!.neighbors({ x: 4, z: 3 }, 'walk').length).toBeGreaterThan(0);
        expect(editableIslandWorld(structuredClone(state))!.definition).toEqual(world.definition);
    });
});


describe('editable terrain body corridor', () => {
    const corridor = (halfWidth: number, rise = 0) => compileWorldDefinition({ version: 1, id: 'corridor', edges: [], districts: [{
        id: 'corridor', templateId: 'corridor', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors: [{ id: 'ground', kind: 'ground', color: '#a4cb87', vertices: [
            { cell: { x: 0, z: -halfWidth }, point: { x: 0, y: 0, z: -halfWidth } },
            { cell: { x: 0, z: halfWidth }, point: { x: 0, y: 0, z: halfWidth } },
            { cell: { x: 2, z: -halfWidth }, point: { x: 2, y: rise, z: -halfWidth } },
            { cell: { x: 2, z: halfWidth }, point: { x: 2, y: rise, z: halfWidth } },
        ], indices: [0, 1, 2, 2, 1, 3] }], sites: [], ports: [],
    }] });
    it('requires body width through a neck and rejects a shore crossing and an excessive slope', () => {
        const from = { x: .2, z: 0 }, to = { x: 1.8, z: 0 };
        expect(editableTerrainSegmentSupported(corridor(.3), from, to)).toBe(true);
        expect(editableTerrainSegmentSupported(corridor(.1), from, to)).toBe(false);
        expect(editableTerrainSegmentSupported(corridor(.3), from, { x: 2.1, z: 0 })).toBe(false);
        expect(editableTerrainSegmentSupported(corridor(.3, 2), from, to)).toBe(false);
        expect(editableTerrainSegmentSupported(corridor(.3, 1), from, to)).toBe(true);
    });
});
