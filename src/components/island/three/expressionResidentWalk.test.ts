import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { ExpressionResidentWalk } from './expressionResidentWalk';
import { ExpressionFootTrails, expressionFootContact } from './expressionFootTrails';
import { createIslandExpressionSelection } from '../../../domain/island/expression';
import { optionalFootprintClearsCircle, optionalFootprintsAreSeparate, optionalResidentFootprint } from './optionalFurnitureNavigation';
import { residentObstacles } from './navigation';
import type { IslandStageItem } from './types';
import { makeFurniture } from './furniture';
import { applyFurnitureGrowth } from './growthVisuals';
const species = ['otter', 'rabbit', 'fox'] as const;

function fixture() {
    const materials = new IslandMaterials(), scene = new THREE.Scene();
    const residents = species.map((id, i) => new IslandResident(id, materials, [[-1, 0, 2], [2.5, 0, 2.5], [6.75, 0, 0]][i] as [number, number, number], () => {}));
    scene.add(...residents.map(resident => resident.group));
    const walk = new ExpressionResidentWalk(residents), trails = new ExpressionFootTrails(residents), selection = createIslandExpressionSelection();
    scene.add(trails.group); species.forEach(id => { selection.residents[id] = { outfit: 'raincoat', pattern: 'river-check', trail: 'leaf-trail' }; });
    residents.forEach(resident => resident.setExpression(selection.residents[resident.species]));
    const items: IslandStageItem[] = [{ id: 'flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0 },
        { id: 'swing', kind: 'swing', position: { x: 6.2, z: 1.15 }, rotation: 0 }];
    const obstacles = [{ x: -.6, z: -.5, radius: .72 }];
    const snapshot = () => residents.map(resident => { const values: unknown[] = []; resident.group.traverse(object => values.push([object.uuid, object.position.toArray(), object.quaternion.toArray(), object.scale.toArray()])); return values; });
    return { materials, residents, walk, trails, selection, items, obstacles, snapshot,
        dispose() { walk.dispose(); trails.dispose(); residents.forEach(resident => resident.disposeAppearance()); disposeGeometry(scene); materials.dispose(); } };
}
describe('explicit expression trial uses the actual feet and a bounded legal walk', () => {
    for (const reduced of [false, true]) for (const id of species) it(`leaves the actual mature default bench before ${id} trial, reduced=${reduced}`, () => {
        const f = fixture(), resident = f.residents.find(value => value.species === id)!;
        f.selection.residents[id] = { outfit: null, pattern: null, trail: 'leaf-trail' };
        resident.setExpression(f.selection.residents[id]);
        // Fixed13 expression-01 native state: actual learning matured this seat,
        // then the expression screen borrowed the still-seated otter at y=.439.
        const bench: IslandStageItem = { id: 'living-bench', kind: 'bench', position: { x: -.1, z: 1 }, rotation: 1.6951513213416582, growthLevel: 3 };
        const items: IslandStageItem[] = [bench, { id: 'starter-flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0, growthLevel: 3 },
            { id: 'starter-lantern', kind: 'lantern', position: { x: -1, z: .25 }, rotation: 0 },
            { id: 'living-fountain', kind: 'fountain', position: { x: 3.4, z: 1.3 }, rotation: 0, growthLevel: 2 },
            { id: 'living-swing', kind: 'swing', position: { x: 6.2, z: 1.15 }, rotation: -1.5172760583355815, growthLevel: 2 }];
        const seat = makeFurniture('bench', f.materials); applyFurnitureGrowth(seat, bench, f.materials);
        seat.position.set(-.1, 0, 1); seat.rotation.y = bench.rotation;
        resident.group.parent!.add(seat);
        const from = resident.group.position.clone();
        expect(resident.visit(bench, 0, true, items, { expansionLevel: 1 }, { points: [from, bench.position!], yaw: bench.rotation })).toBe(true);
        const original = f.snapshot(), action = resident.action, itemId = resident.itemId;
        const input = { request: { id: `seated-${id}`, residentId: id }, items, land: { expansionLevel: 1 as const }, obstacles: [], seat: { item: bench, group: seat } };
        f.walk.set(input); const phases = new Set<string>(); let marks = 0;
        for (let now = 0; now < 6000; now += 25) {
            f.walk.update(now, reduced); const d = f.walk.describe()!; phases.add(d.phase);
            expect(d.phase, JSON.stringify(d)).not.toBe('blocked');
            expect(d.feet!.every(foot => foot.sole[1] >= foot.groundY - .001)).toBe(true);
            if (d.departure) { expect(d.departure.seatId).toBe(bench.id); expect(d.departure.seatUuid).toBe(seat.uuid); expect(d.departure.support.point[1]).toBeCloseTo(.5); }
            f.trails.update(f.selection, new Set(f.walk.walkingResidentId ? [f.walk.walkingResidentId] : []), input.land, now, true, reduced);
            const visible = f.trails.describe().find(value => value.residentId === id)!.marks.filter(mark => mark.visible);
            if (d.phase === 'preparing' || d.phase === 'departing') expect(visible).toHaveLength(0);
            if (d.phase === 'walking' || d.phase === 'settled') {
                expect(d.departure?.landed).toBe(true);
                const hull = optionalResidentFootprint(resident.group);
                for (const circle of residentObstacles(items, '')) expect(optionalFootprintClearsCircle(hull, circle)).toBe(true);
                marks += visible.filter(mark => mark.born === now).length;
            }
        }
        expect([...phases]).toContain('departing'); expect(f.walk.describe()?.phase).toBe('settled'); expect(marks).toBeGreaterThan(0);
        expect(resident.action).toBe(action); expect(resident.itemId).toBe(itemId);
        f.walk.cancel(); f.trails.clear(); expect(f.snapshot()).toEqual(original); f.dispose();
    });
    for (const phase of ['preparing', 'departing', 'walking']) it(`cancellation during ${phase} restores the same seated rig and stops pending departure`, () => {
        const f = fixture(), resident = f.residents[0], bench: IslandStageItem = { id: 'seat', kind: 'bench', position: { x: 0, z: 1 }, rotation: Math.PI * .54, growthLevel: 3 };
        resident.setExpression({ outfit: null, pattern: null, trail: 'leaf-trail' });
        const seat = makeFurniture('bench', f.materials); applyFurnitureGrowth(seat, bench, f.materials); seat.position.set(0, 0, 1); seat.rotation.y = bench.rotation;
        resident.group.parent!.add(seat);
        resident.visit(bench, 0, true, [bench], 1, { points: [{ x: -1, z: 2 }, bench.position!], yaw: bench.rotation });
        const original = f.snapshot(), input = { request: { id: `cancel-${phase}`, residentId: 'otter' as const }, items: [bench], land: { expansionLevel: 1 as const }, obstacles: [], seat: { item: bench, group: seat } };
        f.walk.set(input); let reached = false;
        for (let now = 0; now < 4000; now += 25) {
            f.walk.update(now, false);
            if (f.walk.describe()?.phase === phase) { reached = true; break; }
        }
        expect(reached).toBe(true); f.walk.cancel();
        for (let now = 5000; now <= 10000; now += 100) f.walk.update(now, false);
        expect(f.walk.describe()).toBeUndefined(); expect(f.snapshot()).toEqual(original);
        expect(resident.action).toBe('sit'); expect(resident.itemId).toBe(bench.id);
        f.walk.set(input); expect(f.walk.active).toBe(false); f.dispose();
    });
    for (const reduced of [false, true]) for (const id of species) it(`${id}, reduced=${reduced}: same rig lands and cancels without moving furniture`, () => {
        const f = fixture(), resident = f.residents.find(value => value.species === id)!, originals = f.snapshot(), items = JSON.stringify(f.items);
        const beforeIds = f.trails.describe().flatMap(track => track.marks.map(mark => mark.uuid));
        f.walk.set({ request: { id: `walk-${id}`, residentId: id }, items: f.items, land: { expansionLevel: 1 }, obstacles: f.obstacles });
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100); let matrix: number[] | undefined, marks = 0;
        for (let now = 0; now < 3300; now += 40) {
            f.walk.update(now, reduced);
            const diagnostic = f.walk.describe()!;
            expect(diagnostic.phase).not.toBe('blocked');
            const walking = new Set(f.walk.walkingResidentId ? [f.walk.walkingResidentId] : []);
            f.trails.update(f.selection, walking, { expansionLevel: 1 }, now, true, reduced);
            if (diagnostic.phase !== 'preparing') {
                const hull = optionalResidentFootprint(resident.group);
                for (const circle of [...residentObstacles(f.items, ''), ...f.obstacles]) expect(optionalFootprintClearsCircle(hull, circle)).toBe(true);
                for (const other of f.residents.filter(value => value !== resident)) expect(optionalFootprintsAreSeparate(hull, optionalResidentFootprint(other.group))).toBe(true);
                f.walk.frame(camera, 390 / 295);
                const current = [...camera.matrixWorld.toArray(), ...camera.projectionMatrix.toArray()];
                if (!matrix) matrix = current; else expect(current).toEqual(matrix);
            }
            for (const mark of f.trails.describe().find(track => track.residentId === id)!.marks.filter(mark => mark.visible && mark.born === now)) {
                marks++; expect(new THREE.Vector3(...mark.contact).distanceTo(expressionFootContact(resident, mark.foot))).toBeLessThan(1e-8);
            }
        }
        expect(f.walk.describe()?.phase).toBe('settled'); expect(marks).toBeGreaterThan(0);
        expect(f.trails.describe().flatMap(track => track.marks).some(mark => mark.visible)).toBe(false);
        expect(f.trails.describe().flatMap(track => track.marks.map(mark => mark.uuid))).toEqual(beforeIds);
        expect(JSON.stringify(f.items)).toBe(items); f.walk.cancel(); f.trails.clear(); expect(f.snapshot()).toEqual(originals);
        f.walk.set({ request: { id: `walk-${id}`, residentId: id }, items: f.items, land: { expansionLevel: 1 }, obstacles: f.obstacles });
        expect(f.walk.active).toBe(false); f.dispose();
    });
    it('cancels a pending search before the next candidate and never invents an escape through a covering obstacle', () => {
        const f = fixture(), original = f.snapshot(), input = { request: { id: 'blocked', residentId: 'otter' as const }, items: f.items, land: { expansionLevel: 1 as const },
            obstacles: [{ x: -1, z: 2, radius: 3 }] };
        f.walk.set(input); f.walk.update(0, false); expect(f.walk.describe()?.phase).toBe('preparing');
        f.walk.cancel(); for (let t = 0; t < 10; t++) f.walk.update(t * 100, false);
        expect(f.snapshot()).toEqual(original); expect(f.walk.describe()).toBeUndefined();
        f.walk.set({ ...input, request: { ...input.request, id: 'retry' } });
        for (let t = 0; t < 20; t++) f.walk.update(t * 100, false);
        expect(f.walk.describe()?.phase).toBe('blocked'); expect(f.snapshot()).toEqual(original); f.dispose();
    });
});
