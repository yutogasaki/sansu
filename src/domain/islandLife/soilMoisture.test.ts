import { describe, expect, it } from 'vitest';
import { beginFoodLoop, foodGrowthConditions } from './foodLoop';
import { HOUR, newLife, type LifeItem } from './model';
import { advanceLifeState, replayLife } from './simulation';
import { beginSoilMoisture, soilMoistureAt, syncSoilCells } from './soilMoisture';
import { landCells } from './space';

function world() {
    const state = replayLife(newLife('soil', 0));
    state.items = [
        { id: 'bowl', kind: 'water-bowl', cell: { x: 0, z: 3 }, growth: 0, style: 'original' },
        { id: 'herbs', kind: 'planter', cell: { x: 1, z: 3 }, growth: 0, style: 'original' },
    ] satisfies LifeItem[];
    beginFoodLoop(state);
    beginSoilMoisture(state);
    return state;
}

describe('time-varying soil on the owned island', () => {
    it('wets and dries gradually, and uses stored moisture for harvest growth', () => {
        const state = world(), planter = state.items[1], cell = planter.cell!;
        expect(soilMoistureAt(state, cell)).toBe(.2);
        expect(foodGrowthConditions(state, planter).water).toBe(0);
        advanceLifeState(state, 6 * HOUR);
        const wet = soilMoistureAt(state, cell);
        expect(wet).toBeCloseTo(.575);
        expect(foodGrowthConditions(state, planter).water).toBeCloseTo(.75);
        const harvested = state.food!.harvested;
        state.items[0].cell = undefined;
        expect(soilMoistureAt(state, cell)).toBe(wet);
        advanceLifeState(state, 12 * HOUR);
        expect(soilMoistureAt(state, cell)).toBeCloseTo(.29375);
        expect(state.food!.harvested).toBeGreaterThanOrEqual(harvested);
    });

    it('is stable across replay step sizes and starts newly opened land at baseline', () => {
        const single = world(), steps = structuredClone(single);
        advanceLifeState(single, 12 * HOUR);
        for (let hour = 1; hour <= 12; hour++) advanceLifeState(steps, hour * HOUR);
        expect(soilMoistureAt(steps, { x: 1, z: 3 })).toBeCloseTo(soilMoistureAt(single, { x: 1, z: 3 }), 9);
        expect(steps.food!.plots.herbs.hours).toBeCloseTo(single.food!.plots.herbs.hours, 6);
        expect(steps.food!.harvested).toBe(single.food!.harvested);
        const old = soilMoistureAt(single, { x: 1, z: 3 });
        single.extraLand = ['south'];
        syncSoilCells(single);
        expect(single.soilMoisture && Object.keys(single.soilMoisture).length).toBe(landCells(single).length);
        expect(soilMoistureAt(single, { x: 0, z: 5 })).toBe(.2);
        expect(soilMoistureAt(single, { x: 1, z: 3 })).toBe(old);
    });

    it('keeps the same shade transition when a learning-growth window expires mid-step', () => {
        const single = world();
        single.now = 23 * HOUR;
        single.residents = [];
        single.economy = { version: 'life-v3.0-rc1', completionTimes: [0], lightRemainingBudget: 0 };
        single.items.push({ id: 'tree', kind: 'sapling', cell: { x: 1, z: 2 }, growth: 17.2, style: 'original' });
        const steps = structuredClone(single);
        advanceLifeState(single, 25 * HOUR);
        advanceLifeState(steps, 24 * HOUR);
        advanceLifeState(steps, 25 * HOUR);
        expect(soilMoistureAt(single, { x: 1, z: 3 })).toBeCloseTo(soilMoistureAt(steps, { x: 1, z: 3 }), 9);
        expect(single.food!.plots.herbs.hours).toBeCloseTo(steps.food!.plots.herbs.hours, 8);
    });

    it('integrates through the fully wet threshold without depending on step size', () => {
        const single = world();
        single.residents = [];
        single.soilMoisture!['1,3'] = .68;
        single.items.push({ id: 'tree', kind: 'sapling', cell: { x: 1, z: 2 }, growth: 18, style: 'original' });
        const steps = structuredClone(single);
        advanceLifeState(single, 3 * HOUR);
        for (let hour = 1; hour <= 3; hour++) advanceLifeState(steps, hour * HOUR);
        expect(soilMoistureAt(single, { x: 1, z: 3 })).toBeCloseTo(soilMoistureAt(steps, { x: 1, z: 3 }), 9);
        expect(single.food!.plots.herbs.hours).toBeCloseTo(steps.food!.plots.herbs.hours, 8);
    });
});
