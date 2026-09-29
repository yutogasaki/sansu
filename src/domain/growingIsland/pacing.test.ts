import { describe, expect, it } from 'vitest';
import { applyIntent, canPlace, landQuote } from './commands';
import { foodSupport, housing, islandLevel, playSupport } from './community';
import { ingestCompletions, newIsland } from './island';
import { advanceNature } from './nature';
import { openTown } from './town';
import { HOME_CELL, distance, isReachable, landCells, reachableFromHome } from './space';
import { LANDMARK_PRICE, SEED_PRICE } from './rules';
import type { Cell, Command, SeedKind } from './types';

const HOUR = 3_600_000, T0 = Date.UTC(2026, 8, 29, 7);

/**
 * A plain scripted child: two learning sessions of six completions a day, then plants
 * whatever the island seems to want. Buildings go on odd rows so even rows stay walkable.
 */
function playDays(days: number, seed = 'pace-kid') {
    let state = newIsland(seed, T0), n = 0, fact = 0;
    const act = (command: Command) => { state = applyIntent(state, { id: `pace-${n++}`, command }).state; };
    const spot = (blocking: boolean): Cell | undefined => {
        const reached = reachableFromHome(state);
        // Buildings take odd rows; small things take even rows, so paths stay open.
        return landCells(state).filter(c => (c.z % 2 === 1) === blocking && canPlace(state, c) && isReachable(c, reached))
            .sort((a, b) => distance(a, HOME_CELL) - distance(b, HOME_CELL) || a.x - b.x || a.z - b.z)[0];
    };
    const plant = (kind: SeedKind, blocking: boolean) => {
        const cell = spot(blocking);
        if (!cell || state.drops < SEED_PRICE[kind] || !state.unlocked.includes(`seed:${kind}`)) return false;
        act({ type: 'plant', kind, cell }); return true;
    };
    act({ type: 'plant', kind: 'home', cell: spot(true)! });
    const log: { day: number; villagers: number; level: number; land: number }[] = [];
    for (let day = 1; day <= days; day++) {
        for (const session of [0, 1]) {
            const at = T0 + ((day - 1) * 24 + session * 10) * HOUR;
            advanceNature(state, at);
            state = ingestCompletions(state, Array.from({ length: 6 }, () => ({ id: `f${fact++}`, at }))).state;
            openTown(state);
            for (let guard = 0; guard < 20; guard++) {
                const reached = reachableFromHome(state), people = state.villagers.length;
                const waiting = state.plots.filter(p => p.stage === 0 && p.cell && isReachable(p.cell, reached));
                const quote = landQuote(state);
                if (quote && (!spot(true) || !spot(false)) && state.drops >= quote.price) { act({ type: 'expand', side: quote.sides[0] }); continue; }
                if (housing(state).vacancy + waiting.filter(p => p.kind === 'home').length < 1 && plant('home', true)) continue;
                if (foodSupport(state) + waiting.filter(p => p.kind === 'farm').length * 2 <= people + 1 && plant('farm', false)) continue;
                if (playSupport(state) <= people && plant('play', true)) continue;
                // Decorate a little, and keep room for farms.
                const flower = spot(false), flowers = state.landmarks.filter(l => l.kind === 'flower').length;
                if (flower && flowers < landCells(state).length / 8 && state.drops >= LANDMARK_PRICE.flower! + 12) {
                    act({ type: 'place', kind: 'flower', cell: flower }); continue;
                }
                break;
            }
        }
        log.push({ day, villagers: state.villagers.length, level: islandLevel(state), land: landCells(state).length });
    }
    return { state, log };
}

describe('pacing (spec 52 §15, starting values)', () => {
    it('grows a village over a month without running away', () => {
        const { log } = playDays(30);
        const on = (day: number) => log[day - 1];
        console.table([1, 3, 7, 14, 30].map(on));
        expect(on(1).villagers).toBeGreaterThanOrEqual(1);
        expect(on(7).villagers).toBeGreaterThanOrEqual(7);
        expect(on(7).villagers).toBeLessThanOrEqual(12);
        expect(on(30).villagers).toBeGreaterThanOrEqual(20);
        expect(on(30).villagers).toBeLessThanOrEqual(40);
    });

    it('keeps growing slowly for three months', () => {
        const { log } = playDays(90);
        console.table([45, 60, 90].map(day => log[day - 1]));
        expect(log[89].villagers).toBeGreaterThan(log[29].villagers);
    });

    it('gives two children different islands from the same habits', () => {
        const a = playDays(10, 'kid-one').state, b = playDays(10, 'kid-two').state;
        expect(a.villagers.map(v => v.species)).not.toEqual(b.villagers.map(v => v.species));
    });
});
