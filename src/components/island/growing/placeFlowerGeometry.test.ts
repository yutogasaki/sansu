import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { key, occupant, walkableCells } from '../../../domain/growingIsland/space';
import { GardenGeometry } from '../three/garden/geometry';
import { sceneLayout } from './sceneLayout';
import { buildPlaceFlowerRoof } from './placeFlowerGeometry';

function fixture(variant: string) {
    const state = newIsland('flower-canopy-v3', 0);
    state.land = { expanded: 'east', extra: ['south'], capes: [], districts: ['east'] };
    state.plots = []; state.landmarks = []; state.unopened = []; state.arrivals = [];
    const goal = placeGoalCatalog.find(goal => goal.id === 'P05')!;
    goal.variants.find(entry => entry.id === variant)!.demo.forEach((entry, i) => {
        const cell = { x: entry.x + 6, z: entry.z + 1 }, kind = goal.inputs.find(input => input.role === entry.role)!.kind;
        state.landmarks.push({ id: `flower-${i}`, kind: kind === 'landmark:flower' ? 'flower' : 'bench', cell,
            growth: kind === 'landmark:flower' ? 6 : 0, color: 'purple' });
    });
    const layout = sceneLayout(state), place = derivePlaces(state).find(place => place.ruleId === 'P05')!;
    const g = new GardenGeometry(); buildPlaceFlowerRoof(g, state, layout, place); g.root.updateMatrixWorld(true);
    return { state, layout, place, g };
}
function meshes(root: T.Object3D) { const result: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) result.push(object); }); return result; }

describe('owned flowers grow a thick shared canopy', () => {
    it('keeps actual ear clearance below curled petals and high supports on hills, with low stems inside their original flower footprints', () => {
        for (const variant of ['arch', 'canopy', 'court']) {
            const { state, layout, place, g } = fixture(variant), roof = g.root.getObjectByName('place-flower-canopy')!;
            expect(place.stage).toBe('grown'); expect(roof).toBeDefined();
            for (const mesh of meshes(roof)) {
                const positions = mesh.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
                    expect(p.y - layout.heightAt({ x: p.x + layout.center, z: p.z + 2 }) - .04).toBeGreaterThan(1.166671391 + .10);
                }
            }
            const open = walkableCells(state);
            for (const cell of place.footprint.filter(cell => open.has(key(cell)))) {
                const ray = new T.Raycaster(layout.point(cell), new T.Vector3(0, 1, 0));
                for (const hit of ray.intersectObject(roof, true)) expect(hit.distance).toBeGreaterThan(1.266671391);
            }
            for (const group of g.root.getObjectsByProperty('name', 'place-owned-flower')) {
                const cell = state.landmarks.find(owner => owner.id === group.userData.ownerId)!.cell!;
                expect(occupant(state, cell)?.id).toBe(group.userData.ownerId);
                for (const mesh of meshes(group)) {
                    const positions = mesh.geometry.getAttribute('position');
                    for (let i = 0; i < positions.count; i++) {
                        const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
                        expect(Math.abs(p.x + layout.center - cell.x)).toBeLessThan(.12);
                        expect(Math.abs(p.z + 2 - cell.z)).toBeLessThan(.12);
                    }
                }
            }
            g.dispose();
        }
    });

    it('preserves plants, colours, derived use targets and soil while tinting only unoccupied ground at four millimetres', () => {
        const { state, layout, place } = fixture('court');
        const empty = place.footprint.find(cell => !occupant(state, cell))!;
        state.plots.push({ id: 'existing-farm', kind: 'farm', cell: empty, stage: 1, growth: 0, plantedAt: 0, origin: 'seed', paid: 30 });
        const before = structuredClone(state), derived = derivePlaces(state), g = new GardenGeometry();
        buildPlaceFlowerRoof(g, state, layout, derived.find(place => place.ruleId === 'P05')!); g.root.updateMatrixWorld(true);
        expect(state).toEqual(before); expect(derivePlaces(state)).toEqual(derived);
        expect(g.root.getObjectsByProperty('name', 'place-curled-flower-petal').every(mesh =>
            (mesh as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>).material.color.equals(new T.Color('#ad9add')))).toBe(true);
        const floor = g.root.getObjectByName('place-flower-garden-inlay') as T.Mesh;
        expect(floor.userData.openCells.some((cell: { x: number; z: number }) => key(cell) === key(empty))).toBe(false);
        const positions = floor.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(positions, i), cell = layout.cellAt(p);
            expect(occupant(state, cell)).toBeUndefined();
            expect(p.y - layout.heightAt({ x: p.x + layout.center, z: p.z + 2 })).toBeCloseTo(.004, 5);
        }
        g.dispose();
    });

    it('young flowers keep their owners without the mature shared roof or new floor', () => {
        const { state, layout } = fixture('court'); state.landmarks.filter(owner => owner.kind === 'flower').forEach(owner => { owner.growth = 0; });
        const place = derivePlaces(state).find(place => place.ruleId === 'P05')!, g = new GardenGeometry();
        buildPlaceFlowerRoof(g, state, layout, place);
        expect(g.root.getObjectByName('place-flower-canopy')).toBeUndefined();
        expect(g.root.getObjectByName('place-flower-garden-inlay')).toBeUndefined();
        expect(g.root.getObjectsByProperty('name', 'place-owned-flower').map(group => group.userData.ownerId).sort()).toEqual([...place.mainIds].sort());
        g.dispose();
    });
});
