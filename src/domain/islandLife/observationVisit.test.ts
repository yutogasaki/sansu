import { describe, it, expect } from 'vitest';
import { observationVisit } from './observationVisit';
import { advanceLifeState, applyCommand, commandLife, replayLife } from './simulation';
import { HOUR, newLife, readableLifeVersion, type LifeState } from './model';
function fixture(): LifeState {
    const state = replayLife(newLife('owner', 0));
    state.items = [{ id: 'bench', kind: 'bench', cell: { x: 0, z: 2 }, access: 'front', growth: 0, style: 'original' }];
    state.residents.forEach(resident => { resident.visit = undefined; });
    return state;
}
describe('optional current bench visit', () => {
    it('uses the nearest idle resident and a real path while retaining a hero destination', () => {
        const state = fixture(); state.target = 'another-place'; state.residents[1].cell = { x: 0, z: 3 };
        expect(observationVisit(state, 'bench')).toMatchObject({ kind: 'ready', residentId: 'rabbit', duration: 6000 });
        const before = structuredClone(state);
        applyCommand(state, { id: 'test', at: 0, command: { type: 'observe', itemId: 'bench' } });
        expect(state.residents[1].visit).toMatchObject({ itemId: 'bench', observationTest: true, path: [{ x: 0, z: 3 }] });
        expect(state.target).toBe(before.target); expect(state.drops).toBe(before.drops); expect(state.light).toBe(before.light);
    });
    it('versions the new command without rewriting earlier purchases or the ordinary visit', () => {
        let record = newLife('versioned', 0);
        record.credits = [{ id: 'one', at: 0, day: 'day' }, { id: 'two', at: 0, day: 'day' }];
        record = commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 0, z: 2 } }, 'bench', 0);
        const next = commandLife(record, { type: 'observe', itemId: 'bench' }, 'test', 0);
        expect(record.version).toBe(1); expect(next.version).toBe(2);
        expect(next.actions.slice(0, -1)).toEqual(record.actions); expect(next.credits).toEqual(record.credits);
        expect(replayLife(next)).toEqual(replayLife(record));
        expect(readableLifeVersion(1)).toBe(true); expect(readableLifeVersion(2)).toBe(true); expect(readableLifeVersion(3)).toBe(true); expect(readableLifeVersion(4)).toBe(true); expect(readableLifeVersion(5)).toBe(true); expect(readableLifeVersion(6)).toBe(true); expect(readableLifeVersion(7)).toBe(true); expect(readableLifeVersion(10)).toBe(true); expect(readableLifeVersion(11)).toBe(true); expect(readableLifeVersion(12)).toBe(true); expect(readableLifeVersion(13)).toBe(false);
    });
    it('finishes a test visit without minting light or increasing use achievements', () => {
        const state = fixture(); state.residents[1].cell = { x: 0, z: 3 };
        applyCommand(state, { id: 'test', at: 0, command: { type: 'observe', itemId: 'bench' } });
        const visitor = state.residents.find(resident => resident.visit?.observationTest)!;
        const before = { light: state.light, drops: state.drops, enjoyed: visitor.enjoyed, by: structuredClone(visitor.enjoyedBy) };
        advanceLifeState(state, visitor.visit!.end);
        expect(state.light).toBe(before.light); expect(state.drops).toBe(before.drops);
        expect(visitor.enjoyed).toBe(before.enjoyed); expect(visitor.enjoyedBy).toEqual(before.by);
    });
    it('does not steal a reserved seat or interrupt busy residents', () => {
        const state = fixture(); state.residents.forEach((resident, index) => {
            resident.visit = { itemId: `other-${index}`, path: [resident.cell], from: resident.cell, start: 0, end: HOUR };
        });
        expect(observationVisit(state, 'bench').kind).toBe('busy');
        const before = structuredClone(state);
        expect(() => applyCommand(state, { id: 'busy', at: 0, command: { type: 'observe', itemId: 'bench' } })).toThrow('ほかのこと');
        expect(state).toEqual(before);
    });
    it('reuses an existing visit without marking the ordinary visit as an unpaid test', () => {
        const state = fixture(); state.residents[0].visit = { itemId: 'bench', path: [{ x: 0, z: 3 }], from: { x: 0, z: 3 }, start: 0, end: HOUR };
        expect(observationVisit(state, 'bench')).toMatchObject({ kind: 'existing', residentId: 'pokomoko' });
        applyCommand(state, { id: 'reuse', at: 0, command: { type: 'observe', itemId: 'bench' } });
        expect(state.residents[0].visit!.observationTest).toBeUndefined(); expect(state.residents[0].visit!.end).toBe(HOUR);
    });
});
