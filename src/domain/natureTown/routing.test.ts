import { describe, expect, it } from 'vitest';
import { graph, routeOn, routesFrom } from './grid';
import { newWorld } from './world';

describe('reusable routes within a fixed-cost phase', () => {
    it('preserves exact weighted and equal-cost paths, including later queries and unreachable land', () => {
        const world = newWorld('routing');
        for (const cell of world.chunks[0].cells) cell.traffic = (cell.position[0] * 7 + cell.position[1] * 3) % 5;
        for (const roadsOnly of [false, true]) {
            const network = graph(world, roadsOnly);
            for (const start of [[7, 9], [10, 9], [14, 9], [-1, 0]] as const) {
                const search = routesFrom(network, start);
                // Query distant points before close ones to exercise settled-node reuse.
                for (const cell of [...world.chunks[0].cells].reverse()) {
                    expect(search(cell.position)).toEqual(routeOn(network, start, cell.position));
                }
            }
        }
        const flat = graph(newWorld('ties'));
        const search = routesFrom(flat, [0, 0]);
        for (const target of [[3, 3], [1, 1], [5, 5], [0, 0]] as const) expect(search(target)).toEqual(routeOn(flat, [0, 0], target));
    });

    it('does not share consumable path arrays between residents', () => {
        const network = graph(newWorld('paths')), search = routesFrom(network, [0, 0]);
        const first = search([3, 3])!;
        first.path.shift(); first.path.reverse();
        expect(search([3, 3])).toEqual(routeOn(network, [0, 0], [3, 3]));
    });

    it('fresh searches observe traffic and topology changes between phases', () => {
        const world = newWorld('edits'), start = [0, 0] as const, end = [3, 3] as const;
        const before = routesFrom(graph(world), start)(end)!;
        for (const position of before.path) {
            const cell = world.chunks[0].cells.find(c => c.position[0] === position[0] && c.position[1] === position[1])!;
            cell.traffic = 100;
        }
        const changed = graph(world), after = routesFrom(changed, start)(end);
        expect(after).toEqual(routeOn(changed, start, end));
        expect(after).not.toEqual(before);
        world.chunks[0].cells.find(c => c.position[0] === 3 && c.position[1] === 3)!.terrain = 'water';
        expect(routesFrom(graph(world), start)(end)).toBeUndefined();
    });
});
