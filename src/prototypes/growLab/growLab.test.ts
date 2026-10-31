import { describe, expect, it } from 'vitest';
import { houseSpot, moveHouse, rng, treeSpot, type House } from './growth';
import { MAX_GRADE, cutRoads, findWay, network, node } from './roads';
import { N, RES, STEP, brush, heightAt, levelAt, sampleIsland, smallIsland, terrace } from './terrain';
import { graphOf, newFootfall, nodeNear, pathBetween, stageFor, walkTrips } from './traffic';

describe('grow lab terrain', () => {
    it('raises the middle of a brush stroke more than its edge', () => {
        const h = sampleIsland();
        const before = [heightAt(h, 2, 6), heightAt(h, 3.5, 6)];
        brush(h, 2, 6, 1);
        expect(heightAt(h, 2, 6) - before[0]).toBeGreaterThan(heightAt(h, 3.5, 6) - before[1]);
    });

    it('raises the ground one flat step per tap, and lowers it one step back', () => {
        const h = smallIsland();
        const tap = (up: boolean) => terrace(h, 0, 0, levelAt(h, 0, 0) + (up ? 1 : -1), up);
        tap(true); tap(true);
        expect(heightAt(h, 0, 0)).toBeCloseTo(3 * STEP);
        // Flat on top, so a house or a road can stand on it.
        expect(heightAt(h, .8, .3)).toBeCloseTo(3 * STEP);
        tap(false);
        expect(heightAt(h, 0, 0)).toBeCloseTo(2 * STEP);
    });

    it('makes new land where the sea is tapped', () => {
        const h = smallIsland();
        expect(heightAt(h, 7, 0)).toBeLessThan(0);
        terrace(h, 7, 0, Math.max(1, levelAt(h, 7, 0) + 1), true);
        expect(heightAt(h, 7, 0)).toBeGreaterThan(0);
    });
});

describe('grow lab roads', () => {
    it('never climbs more steeply than a road may where it is a plain road', () => {
        const h = sampleIsland();
        // From the harbour on the shore, as the island finds it.
        const way = findWay(h, node([0, 7]), new Set([node([-1, -1.5])]))!;
        expect(way).toBeDefined();
        for (let i = 1; i < way.nodes.length; i++) {
            const [a, b] = [way.nodes[i - 1], way.nodes[i]];
            const run = Math.hypot(a % N - b % N, Math.floor(a / N) - Math.floor(b / N)) * RES;
            if (way.kinds[i] === 'road') expect(Math.abs(h[b] - h[a]) / run).toBeLessThanOrEqual(MAX_GRADE + 1e-6);
        }
        // The sample hill is climbed by road alone.
        expect(way.kinds.every(k => k === 'road')).toBe(true);
    });

    it('still reaches the top of a cliff too steep for any road, by steps or the funicular', () => {
        const h = sampleIsland();
        // A sheer pillar, set straight into the heights (a brush would let it slide into a hill).
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const d = Math.hypot(-10 + i * RES - 3, -10 + j * RES - 4);
            if (d < 1.2) h[i + j * N] = 7;
        }
        const { roads, reached } = network(h, [0, 8], [[3, 4]]);
        expect(reached).toEqual([true]);
        expect(roads[0].parts.some(p => p.kind === 'stair' || p.kind === 'lift')).toBe(true);
    });

    it('bridges a channel dug right across the island', () => {
        const h = sampleIsland();
        // Wide enough that the banks, sliding in at their steepest, leave water in the middle.
        for (let pass = 0; pass < 2; pass++) for (let x = -9; x <= 9; x += .5) brush(h, x, 2, -3, 2.4);
        expect(heightAt(h, 0, 2)).toBeLessThan(0);
        const { roads, reached } = network(h, [0, 8], [[-1, -1.5]]);
        expect(reached).toEqual([true]);
        expect(roads[0].parts.some(p => p.kind === 'bridge')).toBe(true);
    });

    it('zigzags up a steep hill instead of going straight', () => {
        const h = sampleIsland();
        const { roads, reached } = network(h, [0, 8], [[-1, -1.5]]);
        expect(reached[0]).toBe(true);
        const length = roads[0].line.reduce((s, p, i, l) => (i ? s + Math.hypot(p[0] - l[i - 1][0], p[2] - l[i - 1][2]) : 0), 0);
        expect(length).toBeGreaterThan(Math.hypot(1, 9.5) * 1.4);
    });

    it('joins a second place onto the road already built', () => {
        const h = sampleIsland();
        const { roads, reached } = network(h, [0, 8], [[-1, -1.5], [4.5, 3]]);
        expect(reached).toEqual([true, true]);
        expect(roads).toHaveLength(2);
    });

    it('cuts the ground to the road, so the road neither floats nor sinks', () => {
        const base = sampleIsland();
        const { roads } = network(base, [0, 8], [[-1, -1.5]]);
        const cut = cutRoads(base, roads);
        const gaps = roads[0].parts.filter(p => p.kind === 'road').flatMap(p => p.line.map(([x, y, z]) => Math.abs(heightAt(cut, x, z) - y)));
        expect(Math.max(...gaps)).toBeLessThan(.15);
    });
});

describe('grow lab growth', () => {
    it('settles houses beside the road, never on it, and trees clear of both', () => {
        const base = sampleIsland();
        const { roads } = network(base, [0, 8], [[-1, -1.5]]);
        const h = cutRoads(base, roads);
        const rand = rng(3);
        const houses: House[] = [];
        for (let i = 0; i < 12; i++) { const o = houseSpot(h, roads, houses, rand, i, 0); if (o) houses.push(o); }
        expect(houses.length).toBeGreaterThan(5);
        for (const o of houses) {
            const nearest = Math.min(...roads.flatMap(r => r.line.map(([x, , z]) => Math.hypot(x - o.x, z - o.z))));
            expect(nearest).toBeGreaterThan(.45);
            expect(nearest).toBeLessThan(2);
        }
        const tree = treeSpot(h, roads, houses, [], rand, 99, 0)!;
        expect(tree).toBeDefined();
    });

    it('moves a house next door instead of losing it, keeping its size and colour', () => {
        const base = sampleIsland();
        const { roads } = network(base, [0, 8], [[-1, -1.5]]);
        const h = cutRoads(base, roads);
        const rand = rng(5);
        const o = houseSpot(h, roads, [], rand, 1, 0)!;
        const next = moveHouse(h, roads, [], rand, { ...o, tint: 3 })!;
        expect(next).toBeDefined();
        expect(next.id).toBe(o.id);
        expect(next.tint).toBe(3);
        expect([next.w, next.d]).toEqual([o.w, o.d]);
        expect(Math.hypot(next.x - o.x, next.z - o.z)).toBeLessThan(5);
    });
});

describe('grow lab traffic', () => {
    it('counts footsteps along the road between a house and a place, and nowhere else', () => {
        const h = sampleIsland();
        const { roads } = network(h, [0, 8], [[-1, -1.5], [4.5, 3]]);
        const fall = newFootfall();
        const { trips } = walkTrips(fall, roads, [[0, 8]], [[-1, -1.5]], 5, rng(1));
        expect(trips).toBe(5);
        const g = graphOf(roads);
        const path = pathBetween(g, nodeNear(g, [0, 8], 2.4)!, nodeNear(g, [-1, -1.5], 1.6)!)!;
        for (const k of path) expect(fall[k]).toBe(5);
        // The branch to the other place was not walked.
        expect(roads[1].nodes.slice(1).every(k => fall[k] === 0)).toBe(true);
    });

    it('leaves out places no road reaches, so the island can hint at them', () => {
        const h = sampleIsland();
        const { roads } = network(h, [0, 8], [[-1, -1.5]]);
        const { unreached } = walkTrips(newFootfall(), roads, [[0, 8]], [[-1, -1.5], [6, -6]], 3, rng(2));
        expect(unreached).toEqual([[6, -6]]);
    });

    it('paves a road better the more it is walked', () => {
        expect([0, 4, 5, 23, 24, 69, 70, 200].map(stageFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    });
});
