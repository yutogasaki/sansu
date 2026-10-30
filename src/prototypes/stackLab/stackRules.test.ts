import { describe, expect, it } from 'vitest';
import { changed, derive, emptyGrid, fromHeights, setBlock } from './stackRules';

const block = (v: ReturnType<typeof derive>, x: number, y: number, z: number) => v.blocks.find(b => b.x === x && b.y === y && b.z === z)!;

describe('stack lab rules', () => {
    it('makes a lone block a house whose door leads up inside to its roof terrace', () => {
        const grid = emptyGrid();
        setBlock(grid, 4, 0, 4, true);
        const v = derive(grid);
        const b = block(v, 4, 0, 4);
        expect(b.kind).toBe('house');
        expect(b.terrace).toBe(true);
        expect(b.doors).toHaveLength(1);
        expect(v.stairs.length).toBeLessThanOrEqual(1);
        expect(v.walks.get('4,1,4')).toBeDefined();
        expect(b.parapets.length).toBeGreaterThanOrEqual(3);
    });

    it('turns a hill buried two deep into rock, but keeps a slender tower a building', () => {
        const hill = derive(fromHeights(['333', '333', '333']));
        expect(block(hill, 1, 0, 1).kind).toBe('rock');
        expect(block(hill, 1, 2, 1).kind).toBe('house');
        const tower = derive(fromHeights(['', '', '', '0003']));
        expect(block(tower, 3, 0, 3).kind).toBe('house');
    });

    it('opens an arch under a block that bridges two pillars', () => {
        const grid = fromHeights(['', '', '', '0202']);
        setBlock(grid, 2, 1, 3, true);
        const v = derive(grid);
        expect(block(v, 2, 1, 3)).toMatchObject({ kind: 'arch', archAxis: 'z' });
    });


    it('reports that one stacked block changes its neighbours too', () => {
        const grid = fromHeights(['', '', '', '0111']);
        const before = derive(grid);
        setBlock(grid, 2, 1, 3, true);
        expect(changed(before, derive(grid)).size).toBeGreaterThan(2);
    });
});

describe('stack lab paths', () => {
    const reachable = (v: ReturnType<typeof derive>, from: string) => {
        const seen = new Set([from]);
        const todo = [from];
        while (todo.length) for (const w of v.walks.get(todo.pop()!) ?? []) if (!seen.has(w.to)) { seen.add(w.to); todo.push(w.to); }
        return seen;
    };

    it('lets a resident walk from the ground up a one-level stair onto a roof', () => {
        const v = derive(fromHeights(['', '', '', '0001']));
        expect(reachable(v, '0,0,0').has('3,1,3')).toBe(true);
        expect(v.stranded).toBe(0);
    });

    it('climbs a two-level wall through the building, with no flight outside', () => {
        const v = derive(fromHeights(['', '', '', '0002']));
        expect(v.stairs.filter(s => s.rise > 1)).toHaveLength(0);
        expect(reachable(v, '0,0,0').has('3,2,3')).toBe(true);
        expect(v.stranded).toBe(0);
    });

    it('zigzags a cliff path when the cliff has no way in', () => {
        // A solid wall of rock three high: no doors face the ground in front.
        const grid = fromHeights(['3333333333', '3333333333', '3333333333', '3333333333']);
        const v = derive(grid);
        const flight = v.stairs.find(s => s.rise === 3);
        if (flight) expect(flight.cells).toHaveLength(3);
        expect(v.stranded).toBe(0);
    });

    it('reaches even a lone tower three levels high', () => {
        const v = derive(fromHeights(['', '', '', '0003']));
        expect(v.stranded).toBe(0);
    });

    it('throws a bridge across a one-cell gap between two roofs of the same height', () => {
        const v = derive(fromHeights(['', '', '', '0303']));
        expect(v.bridges).toHaveLength(1);
        expect(v.walks.get('1,3,3')!.some(w => w.to === '3,3,3')).toBe(true);
    });

    it('lets a resident go in a door and come out higher up the same building', () => {
        const grid = emptyGrid();
        for (let y = 0; y < 6; y++) setBlock(grid, 4, y, 4, true);
        for (let y = 0; y < 3; y++) setBlock(grid, 5, y, 4, true);
        const v = derive(grid);
        const doors = v.entrances.filter(e => e.x === 4 && e.z === 4);
        expect(doors.map(e => e.y)).toEqual(expect.arrayContaining([0, 3]));
        const through = [...v.walks.values()].flat().filter(w => w.points.some(p => p[3] === 1));
        expect(through.length).toBeGreaterThan(0);
    });

    it('takes a resident up inside a tower and out onto its roof', () => {
        const v = derive(fromHeights(['', '', '', '', '00009']));
        expect(v.stairs.filter(s => s.rise > 1)).toHaveLength(0);
        expect(v.stranded).toBe(0);
    });

    it('paves one street network that joins every door it can reach outdoors', () => {
        const v = derive(fromHeights(['', '', '0101', '', '0101']));
        const touched = new Set(v.streets.flat());
        for (const p of v.places) expect(touched.has(p)).toBe(true);
    });
});
