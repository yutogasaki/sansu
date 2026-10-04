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
 * A plain scripted child: two learning sessions of ten completions a day, then plants
 * whatever the island seems to want. Buildings go on odd rows so even rows stay walkable.
 */
function playDays(days: number, seed = 'pace-kid', daily = 20, weekly = false, decorFirst = false) {
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
    const log: { day: number; villagers: number; level: number; unlocks: number; land: number; drops: number; bank: number }[] = [];
    for (let day = 1; day <= days; day++) {
        for (const session of (weekly ? [0] : [0, 1])) {
            if (weekly && (day - 1) % 7 !== 0) continue;
            const at = T0 + ((day - 1) * 24 + session * 10) * HOUR;
            advanceNature(state, at);
            state = ingestCompletions(state, Array.from({ length: weekly ? daily * 7 : session === 0 ? Math.ceil(daily / 2) : Math.floor(daily / 2) }, () => ({ id: `f${fact++}`, at }))).state;
            openTown(state);
            if (decorFirst) {
                const cell = spot(false);
                if (cell && state.drops >= LANDMARK_PRICE.flower!) act({ type: 'place', kind: 'flower', cell });
            }
            for (let guard = 0; guard < 20; guard++) {
                const reached = reachableFromHome(state), people = state.villagers.length;
                const waiting = state.plots.filter(p => p.stage === 0 && p.cell && isReachable(p.cell, reached));
                const quote = landQuote(state);
                if (quote && (!spot(true) || !spot(false)) && state.drops >= quote.price) { act({ type: 'expand', side: quote.sides[0] }); continue; }
                // Decoration-first play may fill a cape before the next level opens.
                // Store owned decorations for free to make room for the next farm/home.
                const needsFood = foodSupport(state) <= people + 1;
                const needsHome = housing(state).vacancy + waiting.filter(p => p.kind === 'home').length < 1;
                const crowded = needsFood && !spot(false) ? false : needsHome && !spot(true) ? true : undefined;
                if (decorFirst && crowded !== undefined) {
                    const decoration = state.landmarks.find(l => l.id !== 'starter-flower' && l.id !== 'starter-bench'
                        && l.cell && (l.cell.z % 2 === 1) === crowded);
                    if (decoration) { act({ type: 'store', id: decoration.id }); continue; }
                }
                if (housing(state).vacancy + waiting.filter(p => p.kind === 'home').length < 1 && plant('home', true)) continue;
                if (foodSupport(state) + waiting.filter(p => p.kind === 'farm').length * 2 <= people + 1 && plant('farm', false)) continue;
                if (playSupport(state) <= people && plant('play', true)) continue;
                // Decorate a little, and keep room for farms.
                const flower = spot(false), flowers = state.landmarks.filter(l => l.kind === 'flower').length;
                if (flower && flowers < landCells(state).length / 8 && state.drops >= LANDMARK_PRICE.flower! + SEED_PRICE.home) {
                    act({ type: 'place', kind: 'flower', cell: flower }); continue;
                }
                break;
            }
        }
        log.push({ day, villagers: state.villagers.length, level: islandLevel(state), unlocks: state.unlocked.length, land: landCells(state).length, drops: state.drops, bank: state.town.bank });
    }
    return { state, log };
}

describe('pacing (spec 52 §15, starting values)', () => {
    it('grows a village over a month without running away', () => {
        const { log } = playDays(30);
        const on = (day: number) => log[day - 1];
        console.table([1, 3, 7, 14, 30].map(on));
        expect(on(1).villagers).toBeGreaterThanOrEqual(1);
        expect(on(7).villagers).toBeGreaterThanOrEqual(3);
        expect(on(7).villagers).toBeLessThanOrEqual(5);
        expect(on(30).villagers).toBeGreaterThanOrEqual(12);
        expect(on(30).villagers).toBeLessThanOrEqual(18);
    });

    it('keeps growing slowly for three months', () => {
        const { log } = playDays(90);
        console.table([45, 60, 90].map(day => log[day - 1]));
        expect(log[89].villagers).toBeGreaterThan(log[29].villagers);
        expect(log[89].unlocks).toBeGreaterThan(log[29].unlocks);
    });

    it('gives two children different islands from the same habits', () => {
        const a = playDays(10, 'kid-one').state, b = playDays(10, 'kid-two').state;
        expect(a.villagers.map(v => v.species)).not.toEqual(b.villagers.map(v => v.species));
    });

    it.each([false, true])('continues beyond the former land cap for a year (decor first: %s)', decor => {
        const { state, log } = playDays(365, 'pace-kid', 20, false, decor);
        console.table([90, 180, 365].map(day => ({ decor, ...log[day - 1] })));
        expect(log[364].villagers).toBeGreaterThan(log[179].villagers);
        expect(log[364].land).toBeGreaterThan(144);
        expect(state.land.districts?.length).toBeGreaterThan(0);
    }, 30000);

    it('retains weekly batching throughput instead of losing all unused town hours', () => {
        const daily = playDays(84).log[83], weekly = playDays(84, 'pace-kid', 20, true).log[83];
        console.table([{ habit: 'daily', ...daily }, { habit: 'weekly', ...weekly }]);
        expect(weekly.villagers).toBeGreaterThanOrEqual(daily.villagers - 4);
    }, 30000);

    it('still lets a small daily habit grow an island', () => {
        const { log } = playDays(90, 'pace-kid', 1);
        expect(log[89].villagers).toBeGreaterThan(log[29].villagers);
    });

    it('makes the twenty-question habit grow more than six questions without revoking small progress', () => {
        const short = playDays(30, 'pace-kid', 6).log[29];
        const standard = playDays(30).log[29];
        console.table([{ habit: 'six', ...short }, { habit: 'twenty', ...standard }]);
        expect(short.villagers).toBeGreaterThan(1);
        expect(standard.villagers).toBeGreaterThan(short.villagers * 2);
    });
});
