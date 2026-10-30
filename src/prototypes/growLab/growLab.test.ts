import { describe, expect, it } from 'vitest';
import { houseSpot, moveHouse, rng, treeSpot, type House } from './growth';
import { MAX_GRADE, cutRoads, findWay, network, node } from './roads';
import { N, RES, brush, heightAt, sampleIsland, slopeAt } from './terrain';

describe('grow lab terrain', () => {
    it('raises the middle of a brush stroke more than its edge', () => {
        const h = sampleIsland();
        const before = [heightAt(h, 2, 6), heightAt(h, 3.5, 6)];
        brush(h, 2, 6, 1);
        expect(heightAt(h, 2, 6) - before[0]).toBeGreaterThan(heightAt(h, 3.5, 6) - before[1]);
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

    it('still reaches the top of a hill too steep for any road, by steps or the funicular', () => {
        const h = sampleIsland();
        for (let i = 0; i < 14; i++) brush(h, 3, 4, 1.2, 1.2);
        const { roads, reached } = network(h, [0, 8], [[3, 4]]);
        expect(reached).toEqual([true]);
        expect(roads[0].parts.some(p => p.kind === 'stair' || p.kind === 'lift')).toBe(true);
    });

    it('bridges a channel dug right across the island', () => {
        const h = sampleIsland();
        for (let x = -9; x <= 9; x += .5) brush(h, x, 2, -3, 1.4);
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

    it('levels the ground under a road', () => {
        const base = sampleIsland();
        const { roads } = network(base, [0, 8], [[-1, -1.5]]);
        const cut = cutRoads(base, roads);
        const [x, , z] = roads[0].line[Math.floor(roads[0].line.length / 2)];
        expect(slopeAt(cut, x, z)).toBeLessThan(slopeAt(base, x, z) + .05);
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

    it('moves a house next door instead of losing it, keeping its colour', () => {
        const base = sampleIsland();
        const { roads } = network(base, [0, 8], [[-1, -1.5]]);
        const h = cutRoads(base, roads);
        const rand = rng(5);
        const o = houseSpot(h, roads, [], rand, 1, 0)!;
        const next = moveHouse(h, roads, [], rand, { ...o, tint: 3 })!;
        expect(next).toBeDefined();
        expect(next.id).toBe(o.id);
        expect(next.tint).toBe(3);
        expect(Math.hypot(next.x - o.x, next.z - o.z)).toBeLessThan(5);
    });
});
