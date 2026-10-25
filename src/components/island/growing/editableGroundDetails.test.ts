import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { buildGardenGround } from '../three/garden/garden';
import { curveGroundGeometry } from './curvedGeometry';
import { editableGroundDecorationKey, editableGroundDetailSupported } from './editableGroundDetails';
import { sceneLayout } from './sceneLayout';

function meshData(root: T.Object3D) {
    return root.children.filter((o): o is T.Mesh => o instanceof T.Mesh).map(o => ({
        positions: [...o.geometry.getAttribute('position').array], indices: [...o.geometry.getIndex()!.array],
    }));
}
const dispose = (ground: ReturnType<typeof buildGardenGround>) => {
    ground.root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); }); ground.dispose();
};

describe('editable ground vegetation support', () => {
    it('keeps the default decoration geometry unchanged when every root is supported', () => {
        const state = newIsland('detail-baseline', 0), layout = sceneLayout(state, true);
        const input = { bounds: layout.bounds, moisture: () => 0, shelterTree: false, heightAt: layout.heightAt };
        const before = buildGardenGround(input, layout.point), after = buildGardenGround({ ...input, supportsDetail: () => true }, layout.point);
        expect(meshData(after.root.getObjectByName('garden-ground-details')!)).toEqual(meshData(before.root.getObjectByName('garden-ground-details')!));
        dispose(before); dispose(after);
    });
    it('retains most existing scenery after one shore edit and removes entire unsupported flower clusters', () => {
        const state = newIsland('detail-shore', 0);
        state.terrain = { version: 1, heights: { '0,3': -4, '0,4': -4 }, undo: [], redo: [] };
        const layout = sceneLayout(state, true), accepted: { x: number; z: number }[] = [], rejected: { x: number; z: number }[] = [];
        const ground = buildGardenGround({ bounds: layout.bounds, moisture: () => 0, shelterTree: false, heightAt: layout.heightAt,
            supportsDetail: (cell, radius) => { const supported = editableGroundDetailSupported(layout, cell, radius); (supported ? accepted : rejected).push(cell); return supported; } }, layout.point);
        const details = ground.root.getObjectByName('garden-ground-details')!;
        expect(accepted.length).toBeGreaterThan(80); expect(rejected.length).toBeGreaterThan(0); expect(details.visible).toBe(true);
        expect(details.children.length).toBeGreaterThan(0);
        for (const root of accepted) expect(layout.world.floorAt(root)).toBeDefined();
        curveGroundGeometry(details, layout);
        // Nothing from a removed cluster remains at the centre of the actual water cut.
        const water = layout.projected({ x: 0, z: 3 });
        details.updateMatrixWorld(true);
        const ray = new T.Raycaster(new T.Vector3(water.x - layout.center, 5, water.z - 2), new T.Vector3(0, -1, 0));
        expect(ray.intersectObject(details, true)).toEqual([]);
        dispose(ground);
    });
    it('grounds doorway stones on a raised patch and suppresses all pieces when roots are removed', () => {
        const state = newIsland('detail-raised', 0);
        state.terrain = { version: 1, heights: { '2,3': 2, '3,3': 2, '2,4': 2, '3,4': 2 }, undo: [], redo: [] };
        const layout = sceneLayout(state, true), input = { bounds: layout.bounds, moisture: () => 0, shelterTree: false, heightAt: layout.heightAt };
        const raised = buildGardenGround({ ...input, supportsDetail: () => true }, layout.point);
        const absent = buildGardenGround({ ...input, supportsDetail: () => false }, layout.point);
        expect(absent.root.getObjectByName('garden-ground-details')!.children).toHaveLength(0);
        const details = raised.root.getObjectByName('garden-ground-details')!; curveGroundGeometry(details, layout); details.updateMatrixWorld(true);
        const cell = { x: 2 + Math.sin(4 * .75) * .20, z: 1 + .40 + 4 * .35 }, floor = layout.point(cell, 0);
        const hit = new T.Raycaster(floor.clone().add(new T.Vector3(0, 3, 0)), new T.Vector3(0, -1, 0)).intersectObject(details, true)[0];
        expect(hit).toBeDefined(); expect(hit.point.y - floor.y).toBeCloseTo(.063, 2);
        dispose(raised); dispose(absent);
    });
    it('clears only overlapping roots after an owner moves and restores them when that owner is stored', () => {
        const state = newIsland('detail-owner', 0);
        state.plots = []; state.landmarks = []; state.keepsakes = [];
        state.terrain = { version: 1, heights: {}, undo: [], redo: [] };
        const layout = sceneLayout(state, true), emptyKey = editableGroundDecorationKey(state);
        const roots: { cell: { x: number; z: number }; radius: number }[] = [];
        const baseline = buildGardenGround({ bounds: layout.bounds, moisture: () => 0, shelterTree: false, heightAt: layout.heightAt,
            supportsDetail: (cell, radius) => { roots.push({ cell, radius }); return editableGroundDetailSupported(layout, cell, radius, state); } }, layout.point);
        const originallySupported = roots.filter(root => editableGroundDetailSupported(layout, root.cell, root.radius, state));
        state.plots.push({ id: 'moved-home', kind: 'home', cell: { x: 0, z: 1 }, stage: 1, plantedAt: 0, growth: 0, origin: 'seed', paid: 0 });
        const movedKey = editableGroundDecorationKey(state); expect(movedKey).not.toBe(emptyKey);
        const removed = originallySupported.filter(root => !editableGroundDetailSupported(layout, root.cell, root.radius, state));
        expect(removed.length).toBeGreaterThan(0);
        expect(removed.length).toBeLessThan(originallySupported.length / 3);
        for (const root of removed) {
            expect(Math.abs(root.cell.x)).toBeLessThan(.46 + root.radius);
            expect(Math.abs(root.cell.z - 1)).toBeLessThan(.46 + root.radius);
        }
        state.plots[0].cell = undefined;
        expect(editableGroundDecorationKey(state)).toBe(emptyKey);
        for (const root of originallySupported) expect(editableGroundDetailSupported(layout, root.cell, root.radius, state)).toBe(true);
        const restored = buildGardenGround({ bounds: layout.bounds, moisture: () => 0, shelterTree: false, heightAt: layout.heightAt,
            supportsDetail: (cell, radius) => editableGroundDetailSupported(layout, cell, radius, state) }, layout.point);
        expect(meshData(restored.root.getObjectByName('garden-ground-details')!)).toEqual(meshData(baseline.root.getObjectByName('garden-ground-details')!));
        dispose(baseline); dispose(restored);
    });

});
