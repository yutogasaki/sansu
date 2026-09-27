import { describe, expect, it } from 'vitest';
import { beginFoodLoop, foodGrowthConditions, growFood, syncFoodItems } from './foodLoop';
import { newLife, type LifeItem } from './model';
import { replayLife } from './simulation';
import { canStand } from './walkingSpace';
import { connectedWaterChannels, landMoisture } from './waterChannels';

const item = (id: string, kind: LifeItem['kind'], x: number, z: number): LifeItem =>
    ({ id, kind, cell: { x, z }, growth: 0, style: 'original' });

function world() {
    const state = replayLife(newLife('channels', 0));
    state.expanded = 'east'; state.extraLand = ['south']; state.placementVersion = 1;
    state.items = [item('bowl', 'water-bowl', 0, 2), item('herbs', 'planter', 8, 3),
        ...Array.from({ length: 8 }, (_, index) => item(`c${index + 1}`, 'water-channel', index + 1, 2))];
    beginFoodLoop(state);
    return state;
}

describe('water channels on owned island land', () => {
    it('feeds only connected shallow pieces up to eight edges and never blocks walking', () => {
        const state = world();
        state.items.push(item('ninth', 'water-channel', 8, 1));
        const reached = connectedWaterChannels(state);
        expect(reached.size).toBe(8);
        expect(reached.has('8,1')).toBe(false);
        expect(canStand(state, { x: 4, z: 2 })).toBe(true);
        syncFoodItems(state);
        expect(state.items.find(i => i.id === 'c8')?.waterFlow).toBe(true);
        expect(state.items.find(i => i.id === 'ninth')?.waterFlow).toBe(false);
        expect(state.items.find(i => i.id === 'c2')?.waterConnections).toBe(10);
    });

    it('wets distant ground and changes the harvest only while the line is connected', () => {
        const state = world(), planter = state.items.find(i => i.id === 'herbs')!;
        const wet = landMoisture(state);
        expect(wet['8,3']).toBeGreaterThan(.2);
        expect(foodGrowthConditions(state, planter).water).toBe(1);
        growFood(state, 1.5);
        expect(state.food?.harvested).toBe(1);
        state.items.find(i => i.id === 'c4')!.cell = undefined;
        syncFoodItems(state);
        expect(connectedWaterChannels(state).has('8,2')).toBe(false);
        expect(state.items.find(i => i.id === 'c5')?.waterConnections).toBe(2);
        expect(landMoisture(state)['8,3']).toBeCloseTo(.2);
        expect(foodGrowthConditions(state, planter).water).toBe(0);
        const stock = state.food?.plots.herbs.stock;
        state.items.find(i => i.id === 'c4')!.cell = { x: 4, z: 2 };
        syncFoodItems(state);
        expect(state.food?.plots.herbs.stock).toBe(stock);
        expect(foodGrowthConditions(state, planter).water).toBe(1);
    });

    it('does not create water from an isolated line or count loops as extra sources', () => {
        const state = world();
        state.items.find(i => i.id === 'bowl')!.cell = undefined;
        expect(connectedWaterChannels(state).size).toBe(0);
        expect(landMoisture(state)['8,3']).toBeCloseTo(.2);
        state.items.find(i => i.id === 'bowl')!.cell = { x: 0, z: 2 };
        state.items.push(item('loop-a', 'water-channel', 1, 3), item('loop-b', 'water-channel', 2, 3));
        expect(connectedWaterChannels(state).size).toBe(10);
        expect(landMoisture(state)['8,3']).toBeLessThanOrEqual(1);
    });
});
