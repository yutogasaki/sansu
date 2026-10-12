import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';
import { inletWorldDefinition } from '../../../domain/growingIsland/worldDefinition.fixture';
import { sceneLayout } from './sceneLayout';
import { buildAuthoredGrowingGround } from './native/authoredGrowingGround';
import { frameCamera, initialView } from './growingCamera';

function growingBoundsFixture() {
    const definition = inletWorldDefinition(), source = definition.districts[0];
    const base = compileWorldDefinition(definition);
    const growth = { ...source, id: 'derived-growing-cape', templateId: 'growing-cape', logicalOrigin: { x: 12, z: 5 },
        worldOrigin: { x: 12, y: 2, z: 5 }, floors: source.floors.filter(floor => floor.kind === 'ground'), sites: [], ports: [] };
    const grown = compileWorldDefinition({ ...definition, revision: 'grown-cape', districts: [...definition.districts, growth] });
    return { base, grown, state: newIsland('growth-frame', 0) };
}

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
    it.each([true, false])('keeps arrival world positions when a district adds connection ports (original port: %s)', explicitPort => {
        const definition = inletWorldDefinition(), source = definition.districts[0];
        const original = { ...source, logicalOrigin: { x: 2, z: 1 }, worldOrigin: { x: 4, y: .7, z: -3 }, ports: explicitPort ? source.ports : [] };
        const added = { ...source, id: 'added-shore', logicalOrigin: { x: 20, z: -8 }, worldOrigin: { x: 30, y: 1.1, z: 6 }, turn: 2 as const };
        const beforeWorld = compileWorldDefinition({ ...definition, districts: [original] });
        const afterWorld = compileWorldDefinition({ ...definition, districts: [original, added] });
        const state = newIsland('stable-arrival', 0), before = sceneLayout(state, false, beforeWorld), after = sceneLayout(state, false, afterWorld);
        const worldPoint = (layout: typeof before, point: T.Vector3) => point.clone().add(new T.Vector3(layout.center, 0, 2));
        const approach = beforeWorld.sites.find(site => site.ref.siteId === (explicitPort ? 'b' : 'a'))!.point;
        const expectedRoot = new T.Vector3(approach.x + .22, approach.y - .02, approach.z + .75);
        expect(worldPoint(before, before.pierRoot).distanceTo(expectedRoot)).toBeLessThan(1e-9);
        expect(after.center).not.toBe(before.center);
        expect(afterWorld.definition.districts[1].ports.length).toBeGreaterThan(0);
        for (const anchor of ['pierRoot', 'pierEnd', 'dock', 'far', 'farther'] as const) {
            expect(worldPoint(after, after[anchor]).distanceTo(worldPoint(before, before[anchor])), anchor).toBeLessThan(1e-9);
        }
    });
    it('reuses immutable floor answers across builders without sharing their mutable output', () => {
        const world = compileWorldDefinition(inletWorldDefinition()), floorAt = vi.fn(world.floorAt);
        const layout = sceneLayout(newIsland('floor-reuse', 0), false, { ...world, floorAt });
        const cell = { x: .17, z: .23 }, expected = world.floorAt(cell)!.point;
        floorAt.mockClear();
        const first = layout.point(cell, 0), projected = layout.projected(cell);
        expect(layout.heightAt(cell)).toBe(expected.y);
        expect(first.toArray()).toEqual([expected.x - layout.center, expected.y, expected.z - 2]);
        expect(projected).toEqual({ x: expected.x, z: expected.z });
        first.set(99, 99, 99); projected.x = 99;
        expect(layout.point(cell, .2).toArray()).toEqual([expected.x - layout.center, expected.y + .2, expected.z - 2]);
        expect(layout.projected(cell)).toEqual({ x: expected.x, z: expected.z });
        expect(floorAt).toHaveBeenCalledTimes(1);
        const missing = { x: 1, z: 1 };
        expect(world.floorAt(missing)).toBeUndefined();
        layout.point(missing); layout.heightAt(missing); layout.projected(missing);
        expect(floorAt).toHaveBeenCalledTimes(2);
        expect(Number.isNaN(layout.cellAt(layout.point(missing)).x)).toBe(true);
    });
    it('keeps original floor projection, owner/ghost positions and hit coordinates through growth preview, commit and cancel', () => {
        const { base, grown, state } = growingBoundsFixture();
        const original = sceneLayout(state, true, base, undefined, base);
        const preview = sceneLayout(state, true, grown, undefined, base, { options: { water: false, cove: false }, revision: 'preview' });
        const committed = sceneLayout(state, true, grown, undefined, base, { options: { water: false, cove: false }, revision: 'committed' });
        const cancelled = sceneLayout(state, true, base, undefined, base);
        expect(grown.bounds.max.x).toBeGreaterThan(base.bounds.max.x);
        expect(preview.width).toBe(grown.bounds.max.x - grown.bounds.min.x);
        expect(preview.maxHeight).toBe(grown.bounds.max.y);
        for (const layout of [preview, committed, cancelled]) {
            expect(layout.center).toBe(original.center);
            for (const site of base.sites) {
                const originalPoint = original.point(site.cell, 0);
                expect(layout.point(site.cell, 0)).toEqual(originalPoint);
                expect(layout.projected(site.cell)).toEqual(original.projected(site.cell));
                expect(layout.cellAt(originalPoint)).toEqual(site.cell);
                expect(layout.logicalAt(originalPoint)).toEqual(site.cell);
                expect(layout.floorPoint({ ...site.cell, y: site.point.y + 1 })).toEqual(original.floorPoint({ ...site.cell, y: site.point.y + 1 }));
            }
            expect(layout.pierRoot).toEqual(original.pierRoot);
            expect(layout.dock).toEqual(original.dock);
        }
        // A genuinely different acquisition may establish a new scene origin.
        expect(sceneLayout(state, true, grown, undefined, grown).center).not.toBe(original.center);
    });
    it('fits the actual grown ground in wide and narrow cameras even when its render origin stays with the base', () => {
        const { base, grown, state } = growingBoundsFixture();
        const layout = sceneLayout(state, true, grown, undefined, base), ground = buildAuthoredGrowingGround(layout);
        layout.nativeArt = true; layout.cameraObjects = () => [ground.root];
        try {
            for (const aspect of [1440 / 1000, 390 / 844]) for (const azimuth of [0, Math.PI / 2]) {
                const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 100);
                frameCamera(camera, layout, { ...initialView(), azimuth }, aspect); camera.updateMatrixWorld();
                for (const floor of grown.floors) for (const vertex of floor.vertices) {
                    const p = new T.Vector3(vertex.point.x - layout.center, vertex.point.y, vertex.point.z - 2).project(camera);
                    expect(Math.abs(p.x)).toBeLessThanOrEqual(.90001); expect(Math.abs(p.y)).toBeLessThanOrEqual(.90001);
                    expect(p.z).toBeGreaterThan(-1); expect(p.z).toBeLessThan(1);
                }
            }
        } finally { ground.dispose(); }
    });
});
