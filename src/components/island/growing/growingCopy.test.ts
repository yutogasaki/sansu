import { describe, expect, it } from 'vitest';
import { applyIntent, ingestCompletions, newIsland, openTown } from '../../../domain/growingIsland';
import { actorLine, idleLine, revealLine } from './growingCopy';

const T0 = Date.UTC(2026, 8, 29, 9);
const started = () => applyIntent(newIsland('kid', T0), { id: 'first', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;

describe('Pokomoko lines', () => {
    it('guides the first home and then the boat', () => {
        const island = newIsland('kid', T0);
        expect(idleLine(island)).toContain('「たね」から おうちを');
        expect(idleLine(started())).toContain('つぼみ');
    });

    it('names one reason when nobody could come, without blame', () => {
        const state = ingestCompletions(started(), Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: T0 + i }))).state;
        state.unopened = []; state.arrivals = [];
        const events = openTown(state);
        state.unopened = []; state.arrivals = [];
        const blocked = revealLine(state, events.filter(e => e.type === 'blocked' || e.type === 'boat' || e.type === 'quiet'));
        expect(blocked).toMatch(/いっぱい|とどいて|いけない|ちかづいて|のんびり/);
        expect(blocked).not.toMatch(/だめ|できない|へた|まだまだ/);
    });

    it('never asks for a number of problems', () => {
        const state = started();
        for (const line of [idleLine(state), actorLine(state, 'pokomoko'), actorLine(state, 'visitor')]) expect(line).not.toMatch(/あと\s*\d|もんだい/);
    });

    it('announces keepsakes, sibling flowers and small surprises', () => {
        const state = { ...started(), unopened: [], arrivals: [] };
        expect(revealLine(state, [{ type: 'keepsake', unitId: 'math:6' }])).toContain('きねんひん');
        expect(revealLine(state, [{ type: 'gift', from: 'はるか' }])).toBe('はるかが おはなを くれたよ');
        expect(revealLine(state, [{ type: 'moment', moment: 'rainbow' }])).toBe('にじが でたよ！');
    });

    it('calls えま and えいた by name on the pier', () => {
        const state = started();
        expect(['えま', 'えいた'].some(name => idleLine({ ...state, unopened: [], arrivals: [] }).includes(name) || actorLine(state, 'visitor').startsWith(name))).toBe(true);
    });
});
