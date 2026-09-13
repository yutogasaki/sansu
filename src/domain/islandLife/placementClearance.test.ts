import { describe, expect, it } from 'vitest';
import { newLife, type LifeItem } from './model';
import { applyCommand, advanceLifeState, replayLife, residentCell } from './simulation';
import { planPlacementClearance, placementClearanceEnd, PLACEMENT_CLEARANCE_HOLD_MS } from './placementClearance';
import { landCells, isHouse, walkable } from './space';
import { routeDuration, sampleRoute } from './walkingSpace';
import { commandFingerprint, purchaseReceipt } from './purchases';

const item = (id: string, kind: LifeItem['kind'], x: number, z: number): LifeItem => ({ id, kind, cell: { x, z }, style: 'original', growth: 0 });
function fixture() {
    const state = { ...replayLife(newLife('clearance', 0)), placementVersion: 1 as const, drops: 100, items: [item('library', 'library', 0, 0)] };
    state.residents.forEach((r, index) => { r.visit = undefined; r.cell = index === 0 ? { x: 0, z: 2 } : { x: 3 + index, z: 3 }; });
    return state;
}
const target = { kind: 'garden-hut' as const, cell: { x: 0, z: 2 } };

describe('automatic placement clearance', () => {
    it('walks an entrance visitor clear before the adjacent building is placed, without paying a reward', () => {
        const state = fixture(), before = structuredClone(state);
        state.residents[0].visit = { itemId: 'library', from: { x: 0, z: 2 }, path: [{ x: 0, z: 2 }], start: 0, end: 1800000 };
        const plan = planPlacementClearance(state, target);
        expect(plan.moves).toHaveLength(1); expect(plan.durationMs).toBeGreaterThan(0);
        applyCommand(state, { id: 'clear', at: state.now, command: { type: 'clear-placement', ...target } });
        expect(state.items).toEqual(before.items); expect(state.drops).toBe(before.drops);
        expect(residentCell(state.residents[0], 0, true)).toEqual({ x: 0, z: 2 });
        const path = state.residents[0].visit!.path;
        for (let elapsed = 0; elapsed < routeDuration(path); elapsed += 20) expect(walkable(before, sampleRoute(path, elapsed))).toBe(true);
        const arrival = placementClearanceEnd(state);
        expect(state.residents[0].visit!.end).toBe(arrival + PLACEMENT_CLEARANCE_HOLD_MS);
        advanceLifeState(state, arrival);
        expect(state.light).toBe(before.light); expect(state.residents[0].enjoyed).toBe(before.residents[0].enjoyed);
        expect(state.residents[0].visit!.itemId).toContain('roam:clear-placement:');
        const event = { id: 'hut', at: state.now, command: { type: 'buy' as const, ...target } };
        applyCommand(state, { ...event, purchaseReceipt: purchaseReceipt(event) });
        expect(state.items.some(i => i.id === 'hut')).toBe(true);
    });
    it('does nothing when nobody overlaps and leaves the world intact when no retreat exists', () => {
        const state = fixture();
        const unchanged = structuredClone(state);
        applyCommand(state, { id: 'none', at: 0, command: { type: 'clear-placement', kind: 'flower', cell: { x: 5, z: 4 } } });
        expect(state).toEqual(unchanged);
        state.items = landCells(state).filter(p => !isHouse(p) && !(p.x === 0 && p.z === 2)).map(p => item(`${p.x},${p.z}`, 'bench', p.x, p.z));
        const trapped = structuredClone(state);
        expect(() => applyCommand(state, { id: 'trapped', at: 0, command: { type: 'clear-placement', kind: 'flower', cell: { x: 0, z: 2 } } })).toThrow();
        expect(state).toEqual(trapped);
    });
    it('rejects legacy states and fingerprints exact intent', () => {
        const state = fixture(); delete (state as { placementVersion?: number }).placementVersion;
        expect(() => planPlacementClearance(state, target)).toThrow();
        const command = { type: 'clear-placement' as const, ...target };
        expect(commandFingerprint(command)).not.toBe(commandFingerprint({ ...command, itemId: 'hut' }));
        expect(commandFingerprint(command)).not.toBe(commandFingerprint({ ...command, cell: { x: 1, z: 2 } }));
    });
});
