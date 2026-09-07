import { describe, expect, it } from 'vitest';
import { boards } from './boards';
import { achieved, clone, count, inspect, pairs, play } from './engine';
import { createJournal, decode, fresh, replay, save } from './state';

describe('Pittari positive v1: all reachable states', () => {
    for (const board of boards) it(`${board.id} has a solution and unambiguous arithmetic`, () => {
        const original = clone(board.columns);
        const report = inspect(board);
        expect(report.wins.length).toBeGreaterThan(0);
        const seen = new Set<string>();
        const visit = (columns: number[][]) => {
            const key = JSON.stringify(columns);
            if (seen.has(key)) return;
            seen.add(key);
            for (const pair of pairs(columns, board.target)) {
                const steps = play(columns, board.target, pair);
                expect(play(columns, board.target, pair)).toEqual(steps);
                for (const step of steps) {
                    expect(step.values[0] + step.values[1]).toBe(board.target);
                    expect(count(step.after)).toBe(count(step.before) - 2);
                    const sum = (s: number[][]) => s.flat().reduce((a, b) => a + b, 0);
                    expect(sum(step.before) - sum(step.after)).toBe(board.target);
                }
                visit(steps[steps.length - 1].after);
            }
        };
        visit(board.columns);
        expect(board.columns).toEqual(original);
        if (board.goal === 'all') expect(report.wins.every(path => path.length >= 2)).toBe(true);
    });
    it('includes every positive unordered pair as a manual candidate', () => {
        for (const target of [5, 10]) {
            const covered = new Set(boards.filter(b => b.target === target).flatMap(b => inspect(b).manualPairs));
            for (let a = 1; a <= target / 2; a++) expect(covered.has(`${a}+${target - a}`)).toBe(true);
        }
    });
    it('preserves the left/right example, mirrored advantage, and correct short chains', () => {
        const left = boards.find(b => b.id === '10-3')!;
        const right = boards.find(b => b.id === '10-4')!;
        expect(play(left.columns, 10, 0)).toHaveLength(2);
        expect(play(left.columns, 10, 1)).toHaveLength(1);
        expect(play(right.columns, 10, 0)).toHaveLength(1);
        expect(play(right.columns, 10, 1)).toHaveLength(2);
        expect(achieved(left, play(left.columns, 10, 1)[0].after, 1)).toBe(false);
    });
    it('does not auto-clear an untouched match', () => {
        expect(play([[1], [4], [2], [3]], 5, 0)).toHaveLength(1);
    });
    it('rejects mismatches and competing auto candidates', () => {
        expect(() => play([[1], [2], [3]], 5, 0)).toThrow();
        expect(() => play([[1, 2], [4, 3], [2]], 5, 0)).toThrow('Competing');
    });
    it('reconstructs the exact board and whole-turn undo; rejects corrupt saves', () => {
        const session = { ...fresh(), boardId: '10-3', moves: [0] };
        const stack = replay(session);
        expect(stack).toHaveLength(2);
        expect(stack[1].last).toBe(2);
        let raw = '';
        expect(save(session, { setItem: (_key, value) => { raw = value; } })).toBe(true);
        expect(decode(raw)).toEqual(session);
        expect(replay({ ...session, moves: [] })[0].columns).toEqual(boards[8].columns);
        expect(() => decode(raw.replace('"moves":[0]', '"moves":[99]'))).toThrow();
        expect(() => decode('{}')).toThrow();
        expect(save(session, { setItem: () => { throw new Error('quota'); } })).toBe(false);
    });
    it('keeps manual actions, automatic events, support and replay context separate', () => {
        const journal = createJournal();
        journal.record('manual_pair', fresh(), { valid: true });
        journal.record('automatic_clear', { ...fresh(), dots: false, afterUndo: true }, { chain: 2 });
        const exported = journal.export();
        expect(exported.affectsSrs).toBe(false);
        expect(exported.events.map(e => [e.event, e.dots, e.afterUndo])).toEqual([
            ['manual_pair', true, false], ['automatic_clear', false, true],
        ]);
    });
});
