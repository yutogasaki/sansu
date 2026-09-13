import { describe, expect, it } from 'vitest';
import { newLife, type LifeState, type ResidentId } from './model';
import { replayLife } from './simulation';
import { playTourMembers, planPlayTourDepartures, type PendingPlayTour } from './playTours';
import { sameCell } from './space';
function fixture(): LifeState {
    const state = replayLife(newLife('p', 100));
    state.items = ['a', 'b', 'c'].map((id, x) => ({ id, kind: 'swing', cell: { x, z: 2 }, growth: 0, style: 'original', access: 'front' }));
    state.residents.forEach((r, x) => { r.visit = undefined; r.cell = { x, z: 3 }; });
    return state;
}
const requests = (state: LifeState): PendingPlayTour[] => state.residents.map((r, i) => ({ residentId: r.id,
    cursor: { memberIds: ['a', 'b', 'c'], lastItemId: ['a', 'b', 'c'][i] } }));
describe('GP3 authoritative tour departure planner', () => {
    it('rotates three occupied seats together without revisiting the last item or mutating the world', () => {
        const state = fixture(), pending = requests(state), before = structuredClone({ state, pending });
        const result = planPlayTourDepartures(state, pending);
        expect(result.cancelled).toEqual([]); expect(result.waiting).toEqual([]); expect(result.departures).toHaveLength(3);
        expect(new Set(result.departures.map(d => d.itemId)).size).toBe(3);
        for (const d of result.departures) {
            const current = pending.find(p => p.residentId === d.residentId)!;
            expect(d.itemId).not.toBe(current.cursor.lastItemId);
            expect(d.path[0]).toEqual(state.residents.find(r => r.id === d.residentId)!.cell);
            expect(d.path.every(p => !state.items.some(i => i.cell && sameCell(i.cell, p)))).toBe(true);
            expect(d.path.slice(1).every((p, i) => Math.abs(p.x - d.path[i].x) + Math.abs(p.z - d.path[i].z) === 1)).toBe(true);
        }
        expect({ state, pending }).toEqual(before);
    });
    it('uses the same route order after purchase array and scheduler input order change', () => {
        const state = fixture(), pending = requests(state);
        const first = planPlayTourDepartures(state, pending);
        state.items.reverse();
        expect(playTourMembers(state, 'b')).toEqual(['a', 'b', 'c']);
        expect(planPlayTourDepartures(state, [...pending].reverse())).toEqual(first);
    });
    it('preserves explicit hero destinations and lets the other two residents exchange available seats', () => {
        const state = fixture(); state.target = 'a';
        const result = planPlayTourDepartures(state, requests(state));
        expect(result.cancelled).toEqual(['pokomoko']); expect(result.departures).toHaveLength(2);
        expect(result.departures.map(d => d.itemId).sort()).toEqual(['b', 'c']);
        expect(result.departures.every(d => !sameCell(d.path.at(-1)!, state.residents[0].cell))).toBe(true);
    });
    it('never interrupts an active visit or takes its seat', () => {
        const state = fixture(), hero = state.residents[0];
        hero.visit = { itemId: 'a', from: hero.cell, path: [hero.cell], start: 100, end: 10000 };
        const result = planPlayTourDepartures(state, requests(state));
        expect(result.departures).toHaveLength(2);
        expect(result.departures.every(d => d.residentId !== 'pokomoko' && d.itemId !== 'a')).toBe(true);
    });
    it('waits when both other seats remain reserved instead of repeatedly choosing the same swing', () => {
        const state = fixture();
        state.residents.slice(1).forEach((r, i) => { r.visit = { itemId: ['b', 'c'][i], from: r.cell, path: [r.cell], start: 100, end: 10000 }; });
        expect(planPlayTourDepartures(state, requests(state))).toEqual({ departures: [], cancelled: [], waiting: ['pokomoko'] });
    });
    it('cancels a split or changed component and never plans for a stored item', () => {
        for (const change of ['split', 'store', 'extend']) {
            const state = fixture(), pending = requests(state);
            if (change === 'split') state.items[2].cell = { x: 5, z: 2 };
            if (change === 'store') state.items[2].cell = undefined;
            if (change === 'extend') state.items.push({ ...state.items[2], id: 'd', cell: { x: 3, z: 2 } });
            const result = planPlayTourDepartures(state, pending);
            expect(result.departures).toEqual([]); expect(result.cancelled.sort()).toEqual(['otter', 'pokomoko', 'rabbit']);
        }
    });
    it('requires GP3; GP2 and plant beds do not create tours', () => {
        const state = fixture(); state.items.pop(); expect(playTourMembers(state, 'a')).toBeUndefined();
        state.items = fixture().items.map(i => ({ ...i, kind: 'flower', growth: 6 })); expect(playTourMembers(state, 'a')).toBeUndefined();
    });
    it('rejects duplicate assignment for the same resident', () => {
        const state = fixture(), pending = requests(state);
        expect(() => planPlayTourDepartures(state, [pending[0], pending[0]])).toThrow('Duplicate');
    });
    it('visits each of three destinations over successive rounds', () => {
        const state = fixture(), pending = requests(state), seen = new Map<ResidentId, Set<string>>(pending.map(t => [t.residentId, new Set([t.cursor.lastItemId])]));
        for (let round = 0; round < 2; round++) {
            for (const d of planPlayTourDepartures(state, pending).departures) {
                state.residents.find(r => r.id === d.residentId)!.cell = d.path.at(-1)!;
                pending.find(t => t.residentId === d.residentId)!.cursor.lastItemId = d.itemId;
                seen.get(d.residentId)!.add(d.itemId);
            }
        }
        expect([...seen.values()].map(s => s.size)).toEqual([3, 3, 3]);
    });
});
