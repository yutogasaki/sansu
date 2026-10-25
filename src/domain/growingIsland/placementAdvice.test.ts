import { afterEach, describe, expect, it } from 'vitest';
import { newIsland } from './island';
import { crowded, groveLift, islandCrowding, placementAdvice, tendAdvice } from './placementAdvice';
import { applyIntent } from './commands';
import { setTerrainForm } from './terraceTerrain';
import { HOME_CELL, landCells } from './space';
import type { Cell, GrowingState } from './types';

const withFarm = (state: GrowingState, cell: Cell): GrowingState => ({
    ...state, plots: [...state.plots, { ...structuredClone(state.plots[0] ?? {}), id: `farm-${cell.x}-${cell.z}`, kind: 'farm', cell } as GrowingState['plots'][number]],
});

describe('DEV placement advice', () => {
    const state = newIsland('advice', 0);
    const free = landCells(state).filter(cell => !(cell.x === HOME_CELL.x && cell.z === HOME_CELL.z));
    it('suggests only from the legal cells it is given, at most three', () => {
        const ranked = placementAdvice(state, 'bench', free);
        expect(ranked.length).toBe(3);
        for (const cell of ranked) expect(free).toContainEqual(cell);
    });
    it('never suggests the cell in front of the home door, even when it is the last one free', () => {
        const door = { x: HOME_CELL.x, z: HOME_CELL.z + 1 };
        expect(free).toContainEqual(door);
        for (const kind of ['home', 'farm', 'sapling', 'bench'] as const) {
            expect(placementAdvice(state, kind, free, 99)).not.toContainEqual(door);
            expect(placementAdvice(state, kind, [door])).toEqual([]);
        }
    });
    it('joins a new field to the existing one', () => {
        const first = free.find(c => c.z === 3) ?? free.at(-1)!;
        const farmed = withFarm(state, first);
        const best = placementAdvice(farmed, 'farm', free.filter(c => c.x !== first.x || c.z !== first.z))[0];
        expect(Math.abs(best.x - first.x) + Math.abs(best.z - first.z)).toBe(1);
    });
    it('never advises the cell that would wall the home in', () => {
        // The home's only open way out runs through (2, 2): its other sides are already full.
        const boxed = { ...state, landmarks: [{ x: 1, z: 1 }, { x: 3, z: 1 }, { x: 1, z: 2 }, { x: 3, z: 2 }, { x: 1, z: 3 }, { x: 3, z: 3 }]
            .map((cell, i) => ({ id: `b${i}`, kind: 'bench' as const, cell, growth: 0 })) };
        const open = free.filter(c => !boxed.landmarks.some(l => l.cell.x === c.x && l.cell.z === c.z));
        for (const kind of ['flower', 'sapling', 'bench'] as const) {
            const all = placementAdvice(boxed, kind, open, 99);
            expect(all.length).toBeGreaterThan(0);
            expect(all).not.toContainEqual({ x: 2, z: 3 });
        }
    });
    it('extends water as one line instead of a pool', () => {
        const pool = { ...state, landmarks: [{ id: 'w0', kind: 'water-bowl' as const, cell: { x: 2, z: 2 }, growth: 0 }, { id: 'w1', kind: 'water-channel' as const, cell: { x: 2, z: 3 }, growth: 0 }] };
        const open = free.filter(c => !pool.landmarks.some(l => l.cell.x === c.x && l.cell.z === c.z));
        const best = placementAdvice(pool, 'water-channel', open)[0];
        const touching = pool.landmarks.filter(l => Math.abs(l.cell.x - best.x) + Math.abs(l.cell.z - best.z) === 1);
        expect(touching).toHaveLength(1);
        // Seaward: the line grows from its front end, not beside its source.
        expect(touching[0].id).toBe('w1');
    });
});

describe('DEV growing a place instead of adding one', () => {
    afterEach(() => setTerrainForm('continuous'));
    const grove = () => {
        const s = newIsland('grove', 0);
        s.tutorial = 'done'; s.drops = 500;
        s.landmarks = [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 0, z: 3 }].map((cell, i) => ({ id: `t${i}`, kind: 'sapling' as const, cell, growth: 18, maturedAt: 0 }));
        return s;
    };
    it('grows a place three times for a price, and saves only a count on it', () => {
        let s = grove();
        const target = tendAdvice(s)!;
        expect(target.kind).toBe('sapling');
        for (let i = 0; i < 3; i++) s = applyIntent(s, { id: `tend-${i}`, command: { type: 'tend', id: target.id } }).state;
        expect(s.landmarks.find(l => l.id === target.id)!.tended).toBe(3);
        expect(s.drops).toBe(500 - 3 * 20);
        expect(() => applyIntent(s, { id: 'tend-4', command: { type: 'tend', id: target.id } })).toThrow('じゅうぶん');
    });
    it('counts how full the island is', () => {
        const s = grove();
        expect(islandCrowding(s)).toBeLessThan(.5);
        expect(crowded(s)).toBe(false);
    });
    it('raises a grown grove into a walkable hill with the ordinary terrain rules', () => {
        setTerrainForm('terrace');
        let s = grove();
        const lift = groveLift(s)!;
        expect(lift.cells).toHaveLength(3);
        for (const [i, edit] of lift.edits.entries()) s = applyIntent(s, { id: `lift-${i}`, command: edit }).state;
        const raised = { ...s.terrain!.heights };
        for (const cell of lift.cells) expect(raised[`${cell.x},${cell.z}`]).toBeGreaterThanOrEqual(1);
        expect(groveLift(s)).toBeUndefined();
        // One action, one undo: the whole hill goes back and comes again in a single step each.
        s = applyIntent(s, { id: 'undo-hill', command: { type: 'terrain-undo' } }).state;
        expect(s.terrain!.heights).toEqual({});
        s = applyIntent(s, { id: 'redo-hill', command: { type: 'terrain-redo' } }).state;
        expect(s.terrain!.heights).toEqual(raised);
    });
});


describe('DEV one more and it grows', () => {
    it('names the place a tree beside a grove would grow, ahead of a lone spot far away', async () => {
        const { growthHint } = await import('./placementAdvice');
        const s = newIsland('hint', 0);
        s.tutorial = 'done';
        s.landmarks = [{ x: 0, z: 2 }, { x: 0, z: 3 }].map((cell, i) => ({ id: `t${i}`, kind: 'sapling' as const, cell, growth: 18, maturedAt: 0 }));
        const hint = growthHint(s, 'sapling', [{ x: 0, z: 4 }, { x: 5, z: 0 }]);
        expect(hint?.cell).toEqual({ x: 0, z: 4 });
        expect(hint?.message).toContain('木陰の庭');
    });
});
