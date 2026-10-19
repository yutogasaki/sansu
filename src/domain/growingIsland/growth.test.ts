import { describe, expect, it } from 'vitest';
import { newIsland } from './island';
import { applyIntent, landQuote } from './commands';
import { canPurchase, cosmeticsOpen } from './community';
import { advanceNature } from './nature';
import { grantGrowthMilestones, migrateGrowth, restoreWonderSlot, validateGrowth, WONDER_SLOTS } from './growth';
import { openTown, levelUp } from './town';
import { derivePlaces } from './places';
import type { Command, GrowingState } from './types';
const HOUR = 3_600_000;
let sequence = 0;
const act = (state: GrowingState, command: Command) => applyIntent(state, { id: `growth-test-${sequence++}`, command }, 0).state;
const started = () => act(newIsland('growth-v04', 0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } });

describe('adopted v0.4 growth', () => {
    it('opens only A initially, B after a real arrival, and never sells retired kinds from legacy unlocks', () => {
        const initial = newIsland('a', 0);
        expect(initial.unlocked).toContain('landmark:sapling'); expect(initial.unlocked).not.toContain('seed:farm');
        expect(cosmeticsOpen(initial, 2)).toBe(false);
        const state = started(); expect(canPurchase(state, 'seed:farm')).toBe(true);
        expect(canPurchase(state, 'landmark:trampoline')).toBe(true); expect(cosmeticsOpen(state, 10)).toBe(true);
        state.drops = 1000;
        for (const kind of ['wild', 'play', 'market', 'festival'] as const) {
            state.unlocked.push(`seed:${kind}`);
            expect(() => act(state, { type: 'plant', kind, cell: { x: 5, z: 4 } })).toThrow('まだ');
        }
        for (const kind of ['planter', 'bakery'] as const) {
            state.unlocked.push(`landmark:${kind}`);
            expect(() => act(state, { type: 'place', kind, cell: { x: 5, z: 4 } })).toThrow('まだ');
        }
    });
    it('grows occupied reachable homes from each actual stage dawn without comfort or level gates', () => {
        const state = started(), home = state.plots[0];
        state.town.bank = 24; openTown(state); expect(home.stage).toBe(1);
        state.town.bank = 6; openTown(state); expect(home.stage).toBe(2); expect(home.stagedAt).toBe(30);
        state.town.bank = 48; openTown(state); expect(home.stage).toBe(3); expect(home.stagedAt).toBe(78);
        state.town.bank = 96; openTown(state); expect(home.stage).toBe(4); expect(home.stagedAt).toBe(174);
    });
    it('does not grow an unoccupied house or invent past occupancy', () => {
        const state = started(), home = state.plots[0]; state.villagers = []; state.pier.dockAt = 1000;
        state.town.bank = 100; openTown(state); expect(home.stage).toBe(1);
    });
    it('grants each milestone once, excludes the free build and initial bloom, and stops level rewards', () => {
        let state = started(); expect(state.wonderSeeds).toBe(1);
        expect(state.growth?.slots.W1.status).toBe('granted'); expect(state.growth?.slots.W2.status).toBe('available');
        advanceNature(state, HOUR); expect(state.growth?.matured).toBeUndefined();
        state.drops = 160; state.town.bank = 6;
        state = act(state, { type: 'plant', kind: 'farm', cell: { x: 5, z: 4 } });
        expect(state.growth?.slots.W2.status).toBe('granted');
        state.landmarks.push({ id: 'real-young-tree', kind: 'sapling', cell: { x: 5, z: 1 }, growth: 0 });
        advanceNature(state, 25 * HOUR); grantGrowthMilestones(state, 25 * HOUR);
        expect(state.growth?.slots.W3).toMatchObject({ status: 'granted', targetId: 'real-young-tree' });
        state = act(state, { type: 'expand', side: 'east' }); expect(state.growth?.slots.W4.status).toBe('granted');
        const stock = state.wonderSeeds; expect(stock).toBe(4);
        grantGrowthMilestones(state, 99 * HOUR); levelUp(state, 1, 10); expect(state.wonderSeeds).toBe(stock);
        expect(WONDER_SLOTS.every(id => state.growth?.slots[id].status === 'granted')).toBe(true);
    });
    it('keeps the old issue slots distinct from the new milestone reasons', () => {
        const state = newIsland('old', 0); delete state.growth; state.genki.best = 25; state.wonderSeeds = 0;
        migrateGrowth(state, 4, 8);
        expect(state.growth?.slots.W1.status).toBe('legacy-confirmed'); expect(state.growth?.slots.W2.status).toBe('legacy-confirmed');
        expect(state.growth?.slots.W3.status).toBe('available'); grantGrowthMilestones(state, 1); expect(state.wonderSeeds).toBe(0);
    });
    it('restores only ambiguous slots once and carries provenance through cancel, replant and storage', () => {
        let state = newIsland('ambiguous', 0); delete state.growth; migrateGrowth(state, 1, 1);
        expect(restoreWonderSlot(state, 'W3', 1)).toBe(true); expect(restoreWonderSlot(state, 'W3', 2)).toBe(false);
        expect(state.wonderSeeds).toBe(1);
        state = act(state, { type: 'plant', kind: 'wonder', cell: { x: 5, z: 4 } });
        const plot = state.plots.at(-1)!; expect(plot.restoredWonder).toBe('W3');
        state = act(state, { type: 'store', id: plot.id }); expect(state.drops).toBe(0); expect(state.growth?.restoredStock).toEqual(['W3']);
        state = act(state, { type: 'plant', kind: 'wonder', cell: { x: 5, z: 4 } });
        state.town.bank = 6; openTown(state); expect(state.plots.at(-1)?.restoredWonder).toBe('W3');
        state = act(state, { type: 'store', id: state.plots.at(-1)!.id }); validateGrowth(state);
        expect(state.wonderSeeds).toBe(0); expect(state.plots.at(-1)?.cell).toBeUndefined();
    });
    it('retains original paid cancellation for retired seeds while rejecting another purchase', () => {
        let state = started(); state.plots.push({ id: 'legacy-paid', kind: 'market', cell: { x: 5, z: 4 }, plantedAt: 0, stage: 0, growth: 0, paid: 7, origin: 'seed' });
        state = act(state, { type: 'store', id: 'legacy-paid' }); expect(state.drops).toBe(7);
    });
    it('opens cape four without a genki gate while retaining prices and acquisition order', () => {
        const state = started(); state.land = { expanded: 'west', extra: ['east', 'south'], capes: [] };
        expect(landQuote(state)).toMatchObject({ step: 4, price: 720, sides: ['east', 'west'] });
    });
    it('grows deterministic wild scenery from owned flowers, bounded by the same total inventory cap', () => {
        const make = () => {
            const state = newIsland('spread-v04', 0);
            state.landmarks.push({ id: 'wet', kind: 'water-bowl', cell: { x: 0, z: 2 }, growth: 0 },
                { id: 'bloom', kind: 'flower', cell: { x: 0, z: 3 }, growth: 6 });
            advanceNature(state, 72 * HOUR); return state;
        };
        const a = make(), b = make(), wild = a.plots.filter(p => p.kind === 'wild');
        expect(wild.length).toBeGreaterThan(0); expect(wild.length).toBeLessThanOrEqual(12);
        expect(a.plots).toEqual(b.plots); expect(wild.every(p => p.paid === 0 && p.origin === 'spread')).toBe(true);
        const before = structuredClone(a); advanceNature(a, 72 * HOUR); expect(a).toEqual(before);
    });
    it('forms single and connected places without obligatory seats, home style or three water sources', () => {
        const state = newIsland('places-v04', 0); state.landmarks = [
            { id: 'wood', kind: 'sapling', cell: { x: 5, z: 1 }, growth: 18, maturedAt: 0 },
            { id: 'flower', kind: 'flower', cell: { x: 0, z: 3 }, growth: 6 },
            { id: 'water', kind: 'water-bowl', cell: { x: 5, z: 4 }, growth: 0 }];
        const before = structuredClone(state), places = derivePlaces(state);
        for (const id of ['P01', 'P03', 'P05']) expect(places.find(p => p.ruleId === id)?.stage).toBe('grown');
        expect(places.every(p => !p.useTargets.some(t => t.kind === 'gallery'))).toBe(true); expect(state).toEqual(before);
    });
});

it('starts a missing legacy home timestamp at migration time without inventing past growth', () => {
    const state = newIsland('old-time', 0); delete state.growth; state.town.clock = 200;
    state.plots.push({ id: 'old-house', kind: 'home', cell: { x: 1, z: 3 }, plantedAt: 0, stage: 2, growth: 0, origin: 'seed', paid: 40 });
    migrateGrowth(state, 4, 5);
    expect(state.plots[0].stagedAt).toBe(200); expect(state.plots[0].stage).toBe(2);
});
