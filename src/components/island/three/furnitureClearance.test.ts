import { describe, expect, it } from 'vitest';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import { planFurnitureClearance, type FurnitureClearancePlan, type FurnitureClearanceResident } from './furnitureClearance';
import { residentGroundIsSafe, residentObstacles, residentPointIsClear, type GroundPoint } from './navigation';
import type { IslandStageItem } from './types';

const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const item = (id: string, kind: IslandStageItem['kind'], x: number, z: number): IslandStageItem => ({ id, kind, position: { x, z }, rotation: 0 });
const resident = (x: number, z: number, extra: Partial<FurnitureClearanceResident> = {}): FurnitureClearanceResident =>
    ({ position: { x, z }, visible: true, ...extra });

function inspect(plan: FurnitureClearancePlan, items: IslandStageItem[], actors: FurnitureClearanceResident[], completedSets = 6) {
    const positions = actors.map(actor => ({ ...actor.position }));
    for (const { index, route } of plan.moves) {
        const origin = positions[index]; expect(route.points[0]).toEqual(origin);
        const departed = new Set(items.filter(item => item.position && distance(origin, item.position) <= ISLAND_ITEMS[item.kind].radius + .42 + 1e-8).map(item => item.id));
        const obstacles = residentObstacles(items.filter(item => !departed.has(item.id)), '');
        const occupied = positions.filter((_, other) => other !== index && actors[other].visible);
        const exited = new Set<string>();
        for (let i = 1; i < route.points.length; i++) {
            const a = route.points[i - 1], b = route.points[i];
            for (let step = 0; step <= 100; step++) {
                const point = { x: a.x + (b.x - a.x) * step / 100, z: a.z + (b.z - a.z) * step / 100 };
                expect(residentPointIsClear(point, completedSets >= 2, obstacles), JSON.stringify(point)).toBe(true);
                for (const other of occupied) expect(distance(point, other)).toBeGreaterThanOrEqual(.84 - 1e-8);
                for (const furnishing of items.filter(item => departed.has(item.id))) {
                    const d = distance(point, furnishing.position!);
                    expect(d).toBeGreaterThanOrEqual(distance(origin, furnishing.position!) - 1e-8);
                    if (exited.has(furnishing.id)) expect(d).toBeGreaterThanOrEqual(ISLAND_ITEMS[furnishing.kind].radius + .42 - 1e-8);
                    if (d >= ISLAND_ITEMS[furnishing.kind].radius + .42) exited.add(furnishing.id);
                }
            }
        }
        const end = route.points.at(-1)!;
        expect(end.x * 4).toBeCloseTo(Math.round(end.x * 4)); expect(end.z * 4).toBeCloseTo(Math.round(end.z * 4));
        for (const furnishing of items.filter(item => item.position)) expect(distance(end, furnishing.position!)).toBeGreaterThanOrEqual(ISLAND_ITEMS[furnishing.kind].radius + .42 + .25 - 1e-8);
        positions[index] = { ...end };
    }
    return positions;
}

describe('saved furniture gives standing residents room to step aside', () => {
    it.each(['star', 'bubble'] as const)('clears the actual %s fox overlap without moving either legitimate user', kind => {
        const source = item('source', kind === 'star' ? 'lantern' : 'fountain', 1.5, 1.75);
        const seat = item('seat', kind === 'star' ? 'mushroom' : 'swing', -.5, .75);
        const actors = [resident(1.5, kind === 'star' ? .98 : .65, { itemId: source.id }), resident(-.5, .75, { itemId: seat.id }),
            resident(kind === 'star' ? 1.5 : 1.4178044952537634, kind === 'star' ? 2.123139008032017 : 2.020251331142882, { departingId: 'removed-prior-source' })];
        const plan = planFurnitureClearance([source, seat], actors, 6);
        expect(plan.blocked).toEqual([]); expect(plan.moves.map(move => move.index)).toEqual([2]);
        const positions = inspect(plan, [source, seat], actors);
        expect(positions[0]).toEqual(actors[0].position); expect(positions[1]).toEqual(actors[1].position);
        const delta = { x: positions[2].x - actors[2].position.x, z: positions[2].z - actors[2].position.z };
        expect(Math.abs(delta.x)).toBeGreaterThan(Math.abs(delta.z));
        expect(planFurnitureClearance([source, seat], actors.map((actor, i) => ({ ...actor, position: positions[i] })), 6)).toEqual({ moves: [], blocked: [] });
    });

    it('preflights two residents inside the same new furniture in sequence', () => {
        const items = [item('new-fountain', 'fountain', 0, 1.5)];
        const actors = [resident(-.5, 1.5), resident(.5, 1.5), resident(6.25, .8)];
        const before = JSON.stringify({ items, actors }), plan = planFurnitureClearance(items, actors, 6);
        expect(plan.blocked).toEqual([]); expect(plan.moves.map(move => move.index)).toEqual([0, 1]);
        inspect(plan, items, actors);
        expect(JSON.stringify({ items, actors })).toBe(before);
    });

    it('leaves both actually overlapping flowers without relying on an old departure ID', () => {
        const items = [item('a', 'flower', -.4, 1.5), item('b', 'flower', .4, 1.5)];
        const actors = [resident(0, 1.5, { departingId: 'gone' }), resident(2.5, 1.5)];
        const plan = planFurnitureClearance(items, actors, 0);
        expect(plan.moves).toHaveLength(1); expect(plan.blocked).toEqual([]); inspect(plan, items, actors, 0);
        expect(planFurnitureClearance([...items].reverse(), actors, 0)).toEqual(plan);
    });

    it('ignores stored objects, invisible residents, exact clearance boundaries and an owned seat', () => {
        const seat = item('seat', 'bench', 0, 1.5), stored = { ...item('stored', 'flower', 2, 1.5), position: undefined };
        const actors = [resident(0, 1.5, { itemId: seat.id }), resident(0, 1.5, { visible: false }), resident(2, 1.5)];
        expect(planFurnitureClearance([seat, stored], actors, 0)).toEqual({ moves: [], blocked: [] });
        expect(planFurnitureClearance([seat], [resident(1.07, 1.5)], 0)).toEqual({ moves: [], blocked: [] });
    });

    it('does not mistake a stale item ID for ownership of a newly covering object', () => {
        const items = [item('new', 'lantern', 0, 1.5)];
        const actors = [resident(0, 1.7, { itemId: 'stored-seat', departingId: 'new' })];
        const plan = planFurnitureClearance(items, actors, 0);
        expect(plan.moves).toHaveLength(1); expect(plan.blocked).toEqual([]); inspect(plan, items, actors, 0);
    });

    it('keeps an east-land side step on safe unlocked ground and never invents access when locked', () => {
        const items = [item('east', 'flower', 6.5, .75)], actors = [resident(6.4, .9)];
        const plan = planFurnitureClearance(items, actors, 2);
        expect(plan.moves).toHaveLength(1); expect(plan.blocked).toEqual([]); inspect(plan, items, actors, 2);
        expect(plan.moves[0].route.points.every(point => point.x > 5)).toBe(true);
        expect(planFurnitureClearance(items, actors, 0)).toEqual({ moves: [], blocked: [0] });
    });

    it('reports blocked rather than moving through another body or off the shore', () => {
        const items = [item('new', 'flower', 0, 1.5)];
        expect(planFurnitureClearance(items, [resident(0, 1.5), resident(.3, 1.5)], 0)).toEqual({ moves: [], blocked: [0, 1] });
        const edge = [item('edge', 'flower', 4.25, 0)], actors = [resident(4.4, 0)];
        expect(residentGroundIsSafe(actors[0].position, false)).toBe(false);
        expect(planFurnitureClearance(edge, actors, 0)).toEqual({ moves: [], blocked: [0] });
    });

    it('is deterministic and leaves an enclosed resident blocked without moving its saved furniture', () => {
        const items = [item('cover', 'flower', 0, 1.5), ...Array.from({ length: 16 }, (_, index) =>
            item(`wall-${index}`, 'mushroom', Math.cos(index * Math.PI / 8) * 1.4, 1.5 + Math.sin(index * Math.PI / 8) * 1.4))];
        const actors = [resident(0, 1.5)], before = JSON.stringify({ items, actors });
        const first = planFurnitureClearance(items, actors, 0);
        expect(first).toEqual({ moves: [], blocked: [0] });
        expect(planFurnitureClearance(items, actors, 0)).toEqual(first); expect(JSON.stringify({ items, actors })).toBe(before);
    });
});
