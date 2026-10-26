import { afterEach, describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { boatCell, cloverFound, coves, floatingIsle, rainbowChance, waterfalls } from './discoveries';
import { scoresNear } from './environment';
import { newIsland } from './island';
import { momentCandidates } from './moments';
import { RULES } from './rules';
import { fullMoon, moonPhase } from './sky';
import { setTerrainForm } from './terraceTerrain';
import type { Cell, Command, GrowingState } from './types';

afterEach(() => setTerrainForm('continuous'));

describe('しまの ふしぎ: what the child\'s arrangement brings about', () => {
    const island = () => {
        setTerrainForm('terrace');
        const state = newIsland('wonders', 0);
        state.tutorial = 'done';
        return state;
    };
    let n = 0;
    const run = (state: GrowingState, command: Command) => applyIntent(state, { id: `w${n++}`, command }).state;
    const stroke = (state: GrowingState, cells: Cell[], to: 'up' | 'sea') => run(state, { type: 'terrain-stroke', cells, to });

    it('water on a hill falls into dug water beside it, and the ずかん keeps the waterfall', () => {
        let state = stroke(island(), [{ x: 0, z: 2 }], 'up');
        state.landmarks.push({ id: 'bowl', kind: 'water-bowl', cell: { x: 0, z: 2 }, growth: 0 });
        expect(waterfalls(state)).toEqual([]);
        state = stroke(state, [{ x: 0, z: 3 }], 'sea');
        expect(waterfalls(state)).toEqual([{ from: { x: 0, z: 2 }, to: { x: 0, z: 3 } }]);
        expect(state.discoveries).toContain('waterfall');
        // Undoing the dig takes the fall away, but what was found stays found.
        state = run(state, { type: 'terrain-undo' });
        expect(waterfalls(state)).toEqual([]);
        expect(state.discoveries).toContain('waterfall');
    });

    it('three connected dug cells make a cove with a little boat', () => {
        let state = stroke(island(), [{ x: 0, z: 4 }, { x: 1, z: 4 }], 'sea');
        expect(coves(state)).toEqual([]);
        state = stroke(state, [{ x: 0, z: 3 }], 'sea');
        expect(coves(state)[0]).toHaveLength(3);
        expect(boatCell(state)).toEqual({ x: 0, z: 4 });
        expect(state.discoveries).toContain('cove-boat');
        // A cove of four brings the whale into the child's own water.
        state = stroke(state, [{ x: 1, z: 3 }], 'sea');
        expect(momentCandidates(state).find(c => c.moment === 'whale')?.cell).toBeDefined();
    });

    it('a light on raised ground reaches one cell further', () => {
        let state = island();
        state.landmarks.push({ id: 'lamp', kind: 'lantern', cell: { x: 0, z: 1 }, growth: 0 });
        const far = { x: 3, z: 1 };
        expect(scoresNear(state, far).light).toBe(0);
        state = stroke(state, [{ x: 0, z: 1 }], 'up');
        expect(scoresNear(state, far).light).toBe(2);
        expect(state.discoveries).toContain('high-light');
    });

    it('a lord tree on a two-step hill raises a floating island', () => {
        let state = stroke(island(), [{ x: 0, z: 1 }], 'up');
        state = stroke(state, [{ x: 0, z: 1 }], 'up');
        state.landmarks.push({ id: 'old', kind: 'sapling', cell: { x: 0, z: 1 }, growth: 99, maturedAt: state.nature.hours - RULES.lordTreeHours });
        expect(floatingIsle(state)).toEqual({ x: 0, z: 1 });
        state.landmarks[state.landmarks.length - 1].maturedAt = state.nature.hours - 1;
        expect(floatingIsle(state)).toBeUndefined();
    });

    it('rainbow trees are likelier by water and flowers, and the draw belongs to the tree', () => {
        const state = island();
        const tree = { id: 't', kind: 'sapling' as const, cell: { x: 4, z: 2 }, growth: 0 };
        state.landmarks.push(tree);
        expect(rainbowChance(state, tree)).toBeCloseTo(.06);
        state.landmarks.push({ id: 'b', kind: 'water-bowl', cell: { x: 4, z: 3 }, growth: 0 }, { id: 'f', kind: 'flower', cell: { x: 3, z: 2 }, growth: 99 });
        expect(rainbowChance(state, tree)).toBeCloseTo(.26);
    });

    it('a plucked wild flower sometimes leaves a four-leaf clover in the ずかん', () => {
        let state = island();
        const id = Array.from({ length: 200 }, (_, i) => `wild${i}`).find(id => cloverFound(state, id))!;
        state.plots.push({ id, kind: 'wild', cell: { x: 4, z: 2 }, stage: 1, growth: 6, plantedAt: 0, origin: 'seed', paid: 10 });
        state = run(state, { type: 'pluck', id });
        expect(state.discoveries).toEqual(['clover']);
    });

    it('a surprise once shown is kept in the ずかん', () => {
        let state = island();
        state.surprise = { day: 3, pending: { day: 3, moment: 'rainbow' } };
        state = run(state, { type: 'ack-moment', day: 3 });
        expect(state.discoveries).toContain('moment:rainbow');
        expect(state.surprise?.pending).toBeUndefined();
    });
});

describe('the moon follows the real calendar', () => {
    it('knows a full and a new moon', () => {
        expect(fullMoon(Date.UTC(2024, 0, 25, 18))).toBe(true);
        expect(fullMoon(Date.UTC(2024, 0, 11, 12))).toBe(false);
        expect(Math.min(moonPhase(Date.UTC(2024, 0, 11, 12)), 1 - moonPhase(Date.UTC(2024, 0, 11, 12)))).toBeLessThan(.03);
    });

    it('on a full-moon day the full moon is a surprise, and one light brings the moon rabbit', () => {
        setTerrainForm('terrace');
        const state = newIsland('moon', 0);
        state.landmarks.push({ id: 'lamp', kind: 'lantern', cell: { x: 0, z: 1 }, growth: 0 });
        state.nature.realAt = Date.UTC(2024, 0, 25, 18);
        expect(momentCandidates(state).map(c => c.moment)).toEqual(expect.arrayContaining(['full-moon', 'moon-rabbit']));
        state.nature.realAt = Date.UTC(2024, 0, 11, 12);
        expect(momentCandidates(state).map(c => c.moment)).not.toContain('moon-rabbit');
    });
});
