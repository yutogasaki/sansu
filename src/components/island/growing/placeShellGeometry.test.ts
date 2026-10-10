import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { walkableCells, key } from '../../../domain/growingIsland/space';
import type { Species, LandmarkKind } from '../../../domain/growingIsland';
import { GardenGeometry } from '../three/garden/geometry';
import { IslandMaterials } from '../three/primitives';
import { makeVillagerActor, disposeActor } from './actors';
import { sceneLayout } from './sceneLayout';
import { buildPlaceShell } from './placeShellGeometry';

function fixture(variant: string) {
    const state = newIsland('shell-v3-render-fixture', 0);
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.nature.hours = 200; state.plots = []; state.landmarks = []; state.unopened = []; state.arrivals = [];
    const goal = placeGoalCatalog.find(goal => goal.id === 'P04')!;
    goal.variants.find(entry => entry.id === variant)!.demo.forEach((entry, i) => {
        const cell = { x: entry.x + 6, z: entry.z + 1 }, id = `shell-${i}`;
        const input = goal.inputs.find(input => input.role === entry.role)!.kind;
        if (input === 'plot:home') state.plots.push({ id, kind: 'home', cell, stage: 4, style: 'plain', growth: 0, plantedAt: 0, builtAt: 6, origin: 'seed', paid: 40 });
        else if (input === 'plot:play') state.plots.push({ id, kind: 'play', cell, stage: 1, growth: 0, plantedAt: 0, builtAt: 6, origin: 'seed', paid: 30 });
        else state.landmarks.push({ id, kind: input.split(':')[1] as LandmarkKind, cell, growth: 6 });
    });
    state.villagers = [];
    const place = derivePlaces(state).find(place => place.ruleId === 'P04')!;
    const layout = sceneLayout(state), g = new GardenGeometry(); buildPlaceShell(g, state, layout, place); g.root.updateMatrixWorld(true);
    return { state, place, layout, g, roof: g.root.getObjectByName('place-translucent-shell')! };
}

function meshes(root: T.Object3D) { const result: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) result.push(object); }); return result; }
function surfaceArea(mesh: T.Mesh) {
    const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()!;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(); let area = 0;
    for (let i = 0; i < index.count; i += 3) area += b.fromBufferAttribute(positions, index.getX(i + 1)).sub(a.fromBufferAttribute(positions, index.getX(i)))
        .cross(c.fromBufferAttribute(positions, index.getX(i + 2)).sub(a)).length() / 2;
    return area;
}

describe('thick pearl shell shared by actual homes', () => {
    it('builds closed 14cm volume with opaque pearl sides and a separate transmitting crest', () => {
        const { roof } = fixture('bay'), panels = meshes(roof).filter(mesh => mesh.name === 'place-shell-pearl-body' || mesh.name === 'place-shell-luminous-crest');
        expect(panels).toHaveLength(3);
        const body = panels.filter(mesh => mesh.name === 'place-shell-pearl-body');
        for (const mesh of panels) {
            const positions = mesh.geometry.getAttribute('position'), half = positions.count / 2, index = mesh.geometry.getIndex()!;
            for (let i = 0; i < half; i++) expect(new T.Vector3().fromBufferAttribute(positions, i).distanceTo(new T.Vector3().fromBufferAttribute(positions, i + half))).toBeCloseTo(.14, 5);
            const edges = new Map<string, number>();
            for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
                const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3), edge = [a, b].sort((a, b) => a - b).join(':');
                edges.set(edge, (edges.get(edge) ?? 0) + 1);
            }
            expect([...edges.values()].every(count => count === 2)).toBe(true);
        }
        expect(body.every(mesh => !(mesh.material as T.MeshPhysicalMaterial).transparent && (mesh.material as T.MeshPhysicalMaterial).transmission === 0)).toBe(true);
        const crest = panels.find(mesh => mesh.name === 'place-shell-luminous-crest')!;
        expect((crest.material as T.MeshPhysicalMaterial).transmission).toBeGreaterThan(0);
        expect(body.reduce((sum, mesh) => sum + surfaceArea(mesh), 0) / panels.reduce((sum, mesh) => sum + surfaceArea(mesh), 0)).toBeGreaterThan(.40);
        expect(meshes(roof).some(mesh => mesh.name === 'place-shell-pearl-mouth' && new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).y > 1)).toBe(true);
    });

    it('keeps every variant sky opening and actual home front door open, without changing derived places or state', () => {
        for (const variant of ['bay', 'lane', 'court']) {
            const { state, place, layout, g, roof } = fixture(variant), before = structuredClone(state), projection = derivePlaces(state);
            const panels = meshes(roof).filter(mesh => mesh.name === 'place-shell-pearl-body' || mesh.name === 'place-shell-luminous-crest');
            const homes = state.plots.filter(home => place.mainIds.includes(home.id));
            const center = homes.reduce((sum, home) => sum.add(layout.point(home.cell!)), new T.Vector3()).multiplyScalar(1 / homes.length);
            const ray = new T.Raycaster(center.clone().add(new T.Vector3(0, 8, 0)), new T.Vector3(0, -1, 0));
            expect(ray.intersectObjects(panels).length > 0).toBe(variant !== 'court');
            for (const home of homes) {
                const p = layout.point(home.cell!), door = new T.Raycaster(p.clone().add(new T.Vector3(0, .30, 1)), new T.Vector3(0, 0, -1), 0, .98);
                expect(door.intersectObject(roof, true)).toHaveLength(0);
            }
            expect(state).toEqual(before); expect(derivePlaces(state)).toEqual(projection);
            g.dispose();
        }
    });

    it('clears the actual tallest ears and hats over open ground, while all low supports stay on blocked owners', () => {
        const m = new IslandMaterials('moon-garden'); let head = 0;
        const species: Species[] = ['rabbit', 'otter', 'fox', 'duck', 'squirrel', 'hedgehog', 'bird', 'girl', 'boy', 'penguin', 'owl', 'frog'];
        for (const kind of species) for (let hat = 0; hat <= 5; hat++) {
            const actor = makeVillagerActor(m, { id: `${kind}-${hat}`, species: kind, trait: 'mellow', home: 'home', arrivedAt: 0,
                variant: { color: 0, accessory: 0, sparkle: false }, outfit: { color: 0, hat } });
            head = Math.max(head, new T.Box3().setFromObject(actor.root).max.y); disposeActor(actor);
        }
        expect(head).toBeGreaterThan(1.16);
        for (const variant of ['bay', 'lane', 'court']) {
            const { state, place, layout, roof } = fixture(variant), open = walkableCells(state);
            const panels = meshes(roof).filter(mesh => mesh.name === 'place-shell-pearl-body' || mesh.name === 'place-shell-luminous-crest');
            for (const cell of place.footprint.filter(cell => open.has(key(cell)))) for (const dx of [-.22, 0, .22]) for (const dz of [-.22, 0, .22]) {
                const floor = layout.point({ x: cell.x + dx, z: cell.z + dz }), ray = new T.Raycaster(floor, new T.Vector3(0, 1, 0));
                for (const hit of ray.intersectObjects(panels)) expect(hit.point.y - floor.y).toBeGreaterThan(head + .10);
            }
            for (const group of roof.getObjectsByProperty('name', 'place-shell-owner-supports')) {
                const cell = state.plots.find(home => home.id === group.userData.ownerId)!.cell!;
                for (const mesh of meshes(group)) {
                    const positions = mesh.geometry.getAttribute('position');
                    for (let i = 0; i < positions.count; i++) {
                        const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
                        if (p.y < layout.point(cell).y + head + .10) {
                            expect(Math.abs(p.x + layout.center - cell.x)).toBeLessThan(.40);
                            expect(Math.abs(p.z + 2 - cell.z)).toBeLessThan(.40);
                        }
                    }
                }
            }
        }
        m.dispose();
    });
});
