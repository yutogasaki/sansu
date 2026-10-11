import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';
import { inletWorldDefinition } from '../../../domain/growingIsland/worldDefinition.fixture';
import { sceneLayout } from './sceneLayout';

describe('authored layout uses actual floor and planting rights', () => {
    it('maps feet, hit inversion and authored gallery heights without legacy terrain or projection', () => {
        const world = compileWorldDefinition(inletWorldDefinition()), state = newIsland('authored-floor', 0), before = structuredClone(state);
        const layout = sceneLayout(state, true, world);
        expect(layout.authored).toBe(true); expect(layout.curved).toBe(false); expect(layout.world).toBe(world);
        for (const site of world.sites) {
            const p = layout.point(site.cell, 0);
            expect(p.x + layout.center).toBeCloseTo(site.point.x, 9);
            expect(p.y).toBeCloseTo(site.point.y, 9); expect(p.z + 2).toBeCloseTo(site.point.z, 9);
            expect(layout.cellAt(p)).toEqual(site.cell); expect(layout.logicalAt(p)).toEqual(site.cell);
            expect(layout.logicalAt({ x: p.x, z: p.z })).toEqual(site.cell);
            const gallery = layout.floorPoint({ ...site.cell, y: site.point.y + 1.4 });
            expect(gallery.y - p.y).toBeCloseTo(1.4, 9); expect(gallery.x).toBe(p.x); expect(gallery.z).toBe(p.z);
        }
        expect(state).toEqual(before);
    });
    it('does not snap water, absent floor or a raised non-floor hit to a neighboring site', () => {
        const world = compileWorldDefinition(inletWorldDefinition()), layout = sceneLayout(newIsland('inlet-hit', 0), true, world);
        for (const p of [new T.Vector3(1.45 - layout.center, -.2, 1.1 - 2), new T.Vector3(-1.2 - layout.center, 0, -2), layout.point({ x: 0, z: 0 }, .5)]) {
            const cell = layout.cellAt(p); expect(Number.isFinite(cell.x)).toBe(false); expect(world.owns(cell)).toBe(false);
        }
    });
});
