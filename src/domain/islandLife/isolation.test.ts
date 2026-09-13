import { describe, expect, it } from 'vitest';
import { HOUR, newLife, type LifeState } from './model';
import { advanceLifeState, applyCommand, replayLife } from './simulation';
import { homeCell, isolatedItems, usablePlacement } from './space';

function island(): LifeState {
    const state = replayLife(newLife('isolation', 0));
    state.placementVersion = 1;
    state.residents = [{ id: 'pokomoko', cell: { ...homeCell }, enjoyed: 0, enjoyedBy: {} }];
    state.items = [
        { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
        { id: 'bench', kind: 'bench', cell: { x: 4, z: 3 }, access: 'front', growth: 0, style: 'original' },
    ];
    return state;
}

describe('isolation is a visible use state, not a placement failure', () => {
    it('allows an entrance to be blocked, preserves growth, and resumes use after a free move', () => {
        const state = island(); state.target = 'library';
        expect(usablePlacement(state, 'bench', { x: 0, z: 2 })).toBe(true);
        applyCommand(state, { id: 'isolate', at: 0, command: { type: 'move', itemId: 'bench', cell: { x: 0, z: 2 } } });
        expect(isolatedItems(state).map(i => i.id)).toContain('library');
        state.items.push({ id: 'flower', kind: 'flower', cell: { x: 5, z: 3 }, growth: 1, style: 'starlight' });
        advanceLifeState(state, HOUR);
        expect(state.residents[0].visit).toBeUndefined(); expect(state.light).toBe(0);
        expect(state.items.find(i => i.id === 'flower')!.growth).toBeGreaterThan(1);
        const before = { drops: state.drops, light: state.light, items: state.items.map(i => [i.id, i.growth, i.style]) };
        applyCommand(state, { id: 'restore', at: state.now, command: { type: 'move', itemId: 'bench', cell: { x: 4, z: 3 } } });
        expect(isolatedItems(state)).toEqual([]);
        expect(state.residents[0].visit?.itemId).toBe('library');
        expect({ drops: state.drops, light: state.light, items: state.items.map(i => [i.id, i.growth, i.style]) }).toEqual(before);
    });
    it('retains overlap and land checks while allowing neighboring buildings', () => {
        const state = island();
        state.items.push({ id: 'hut', kind: 'garden-hut', growth: 0, style: 'original' });
        expect(usablePlacement(state, 'hut', { x: 0, z: 2 })).toBe(true);
        expect(usablePlacement(state, 'hut', { x: 1, z: 0 })).toBe(false);
        expect(usablePlacement(state, 'hut', { x: 5, z: 4 })).toBe(false);
        expect(usablePlacement(state, 'hut', { x: -1, z: 2 })).toBe(false);
    });
    it('does not place an obstacle through a resident or mutate the wallet on retry', () => {
        const state = island(); state.residents[0].cell = { x: 3, z: 3 }; state.drops = 10;
        const before = structuredClone(state);
        expect(() => applyCommand(state, { id: 'occupied', at: 0, command: { type: 'buy', kind: 'bench', cell: { x: 3, z: 3 } } })).toThrow('そこを あるいているよ');
        expect(state).toEqual(before);
    });
    it('cancels a blocked unfinished visit without awarding use or teleporting', () => {
        const state = island(), origin = { x: 2, z: 2 };
        state.residents[0].cell = origin;
        state.residents[0].visit = { itemId: 'library', from: origin, path: [origin, { x: 1, z: 2 }, { x: 0, z: 2 }], start: 0, end: HOUR };
        state.target = 'library';
        applyCommand(state, { id: 'block', at: 0, command: { type: 'move', itemId: 'bench', cell: { x: 0, z: 2 } } });
        expect(state.residents[0].cell).toEqual(origin);
        expect(state.residents[0].visit).toBeUndefined(); expect(state.light).toBe(0);
    });
    it('keeps an ongoing visit when only ground behind the walker changes', () => {
        const state = island(); state.items = [state.items[1]]; state.items[0].cell = { x: 4, z: 0 };
        const path = [{ x: 2, z: 2 }, { x: 3, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 1 }];
        const visit = { itemId: 'bench', from: path[0], path, start: 0, end: HOUR };
        state.residents[0].cell = path[0]; state.residents[0].visit = visit;
        state.now = 2400; state.target = 'bench'; state.drops = 2;
        applyCommand(state, { id: 'behind', at: state.now, command: { type: 'buy', kind: 'flower', cell: path[0] } });
        expect(state.residents[0].visit).toBe(visit); expect(state.light).toBe(0);
    });
});
