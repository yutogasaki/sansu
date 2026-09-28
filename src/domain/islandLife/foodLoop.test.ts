import { describe, expect, it } from 'vitest';
import { advanceLifeState, arrangeVisits, replayLife } from './simulation';
import { arrangeFoodTrip, beginFoodLoop, cancelFoodTrip, foodGrowthConditions, foodInventory, growFood, syncFoodItems } from './foodLoop';
import { HOUR, newLife, type LifeItem } from './model';

function fixture() {
    const state = replayLife(newLife('food', 0));
    state.items = [
        { id: 'herbs', kind: 'planter', cell: { x: 0, z: 3 }, growth: 0, style: 'original' },
        { id: 'table', kind: 'picnic-table', cell: { x: 4, z: 3 }, growth: 0, style: 'original' },
    ] satisfies LifeItem[];
    beginFoodLoop(state);
    return state;
}

describe('food on the current island', () => {
    it('uses nearby water and grown-tree shade, recalculating after a move without resetting stock', () => {
        const dry = fixture(); growFood(dry, 1.5);
        expect(dry.food?.harvested).toBe(0);
        const watered = fixture();
        watered.items.push({ id: 'water', kind: 'water-bowl', cell: { x: 1, z: 3 }, growth: 0, style: 'original' });
        expect(foodGrowthConditions(watered, watered.items[0]).water).toBe(1);
        growFood(watered, 1.5);
        expect(watered.food?.harvested).toBe(1);
        const before = watered.food!.plots.herbs.stock;
        watered.items[2].cell = { x: 5, z: 4 };
        expect(foodGrowthConditions(watered, watered.items[0]).water).toBe(0);
        expect(watered.food?.plots.herbs.stock).toBe(before);
        const shaded = fixture();
        shaded.items.push({ id: 'tree', kind: 'sapling', cell: { x: 1, z: 3 }, growth: 18, style: 'original' });
        expect(foodGrowthConditions(shaded, shaded.items[0]).shade).toBeGreaterThan(0);
        growFood(shaded, 2);
        expect(shaded.food?.harvested).toBe(0);
        shaded.items[2].cell = { x: 5, z: 4 };
        growFood(shaded, 1);
        expect(shaded.food?.harvested).toBe(1);
    });

    it('applies shade only after a tree finishes growing during a long replay step', () => {
        const state = fixture();
        state.items.push({ id: 'tree', kind: 'sapling', cell: { x: 1, z: 3 }, growth: 17, style: 'original' });
        growFood(state, 2);
        expect(state.food?.plots.herbs.hours).toBeGreaterThan(1.5);
        expect(state.food?.plots.herbs.hours).toBeLessThan(2);
        expect(state.food?.harvested).toBe(0);
    });
    it('grows a real unit, carries it on a resident path, and delivers without duplication', () => {
        const state = fixture();
        growFood(state, 2);
        expect(state.food?.harvested).toBe(1);
        expect(foodInventory(state)).toBe(1);
        arrangeFoodTrip(state);
        const carrier = state.residents.find(r => r.foodTrip)!;
        expect(carrier.id).not.toBe('pokomoko');
        expect(carrier.visit?.itemId).toBe('herbs');
        advanceLifeState(state, carrier.visit!.end);
        expect(carrier.foodTrip?.phase).toBe('carry');
        expect(carrier.visit?.itemId).toBe('table');
        expect(foodInventory(state)).toBe(1);
        advanceLifeState(state, carrier.visit!.end);
        expect(state.food?.delivered).toBe(1);
        expect(state.food?.tables.table).toBe(1);
        expect(foodInventory(state) + state.food!.eaten).toBe(state.food?.harvested);
    });

    it('keeps the harvest when a route is interrupted or the source is removed', () => {
        const state = fixture();
        growFood(state, 2); arrangeFoodTrip(state);
        const carrier = state.residents.find(r => r.foodTrip)!;
        advanceLifeState(state, carrier.visit!.end);
        cancelFoodTrip(state, carrier);
        carrier.visit = undefined;
        expect(foodInventory(state)).toBe(1);
        state.items = state.items.filter(i => i.id !== 'herbs');
        syncFoodItems(state);
        expect(state.food?.pantry).toBe(1);
        expect(foodInventory(state)).toBe(1);
    });

    it('returns an interrupted unit to the pantry when its planter has refilled', () => {
        const state = fixture(); growFood(state, 2); arrangeFoodTrip(state);
        const carrier = state.residents.find(r => r.foodTrip)!;
        advanceLifeState(state, carrier.visit!.end);
        state.food!.plots.herbs.stock = 3;
        state.food!.harvested = 4;
        cancelFoodTrip(state, carrier);
        expect(state.food?.plots.herbs.stock).toBe(3);
        expect(state.food?.pantry).toBe(1);
        expect(foodInventory(state)).toBe(4);
    });

    it('waits for a placed destination and uses the island growth clock', () => {
        const state = fixture();
        state.items[1].cell = undefined;
        growFood(state, 2);
        arrangeFoodTrip(state);
        expect(state.residents.every(r => !r.foodTrip)).toBe(true);
        expect(state.food?.plots.herbs.stock).toBe(1);
        expect(state.items[0].foodStage).toBe(2);
        state.items[1].cell = { x: 4, z: 3 };
        arrangeFoodTrip(state);
        expect(state.residents.some(r => r.foodTrip)).toBe(true);
    });

    it('waits behind a blocked table and resumes after a route is opened', () => {
        const state = fixture();
        state.items.push(...[{ x: 4, z: 2 }, { x: 5, z: 3 }, { x: 3, z: 3 }, { x: 4, z: 4 }]
            .map((cell, index) => ({ id: `fence-${index}`, kind: 'fence' as const, cell, growth: 0, style: 'original' as const })));
        growFood(state, 2); arrangeFoodTrip(state);
        expect(state.residents.every(r => !r.foodTrip)).toBe(true);
        expect(state.food?.plots.herbs.stock).toBe(1);
        state.items = state.items.filter(item => item.id !== 'fence-0');
        arrangeFoodTrip(state);
        expect(state.residents.some(r => r.foodTrip)).toBe(true);
    });

    it('eats one stocked unit when a modern short table visit completes', () => {
        const state = fixture();
        state.cadenceVersion = 1;
        state.food!.tables.table = 1;
        const resident = state.residents[1];
        resident.cell = { x: 4, z: 4 };
        resident.visit = { itemId: 'table', from: resident.cell, path: [resident.cell], start: 0, end: 1000, cadence: true };
        advanceLifeState(state, 1000);
        expect(state.food?.tables.table).toBe(0);
        expect(state.food?.eaten).toBe(1);
    });

    it('returns to the only table when fresh food arrives after the last visit', () => {
        const state = fixture(); state.cadenceVersion = 1;
        state.food!.tables.table = 1;
        state.residents.forEach(r => { r.cadence = { round: 1, lastItemId: 'table', useMs: {} }; });
        arrangeVisits(state);
        expect(state.residents.some(r => r.visit?.itemId === 'table')).toBe(true);
    });
});

it('lets a new solo island supply its first invitation while keeping the hero call available', () => {
    const s = fixture(); s.residency = { joined: [], invitations: {} }; s.residents = s.residents.slice(0, 1);
    s.residents[0].visit = undefined; s.target = 'table'; growFood(s, 6);
    arrangeFoodTrip(s); expect(s.residents[0].foodTrip).toBeUndefined();
    s.target = undefined; arrangeFoodTrip(s); expect(s.residents[0].foodTrip?.sourceId).toBe('herbs');
    advanceLifeState(s, 7 * HOUR);
    expect(s.food!.delivered).toBeGreaterThanOrEqual(3); expect(s.food!.eaten).toBeGreaterThanOrEqual(3);
    expect(s.residency.invitations.rabbit?.reason).toBe('shared-meal');
    expect(s.residency.invitations.otter?.reason).toBe('shared-meal');
    expect(foodInventory(s) + s.food!.eaten).toBe(s.food!.harvested);
});
