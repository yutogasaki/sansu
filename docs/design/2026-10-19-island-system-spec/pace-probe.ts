/** Design diagnostic only. In-memory overrides do not modify app sources or user saves.
 * Run: fnm exec --using=22 node_modules/.bin/vite-node docs/design/2026-10-19-island-system-spec/pace-probe.ts
 * Not a simulation of visual comprehension, logistics animation, authored 3D or save migration.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyIntent, canPlace, canReachHomePlacement, landQuote } from '../../../src/domain/growingIsland/commands';
import { foodSupport, genki, housing } from '../../../src/domain/growingIsland/community';
import { newIsland, ingestCompletions } from '../../../src/domain/growingIsland/island';
import { advanceNature } from '../../../src/domain/growingIsland/nature';
import { openTown } from '../../../src/domain/growingIsland/town';
import { HOME_CELL, distance, isReachable, landCells, reachableFromHome } from '../../../src/domain/growingIsland/space';
import { CAPE_LEVEL, LANDMARK_PRICE, RULES, UNLOCKS } from '../../../src/domain/growingIsland/rules';
import type { Command, GrowingState, LandmarkKind, SeedKind } from '../../../src/domain/growingIsland/types';

type Policy = 'housing' | 'garden' | 'two-islands';
const originalGrowth = RULES.homeGrowth.map(rule => rule && { ...rule });
const HOUR = 3600000, T0 = Date.UTC(2026, 9, 19, 7);
const allowedSeed = new Set(['home', 'farm']);
const allowedLandmark = new Set(['flower', 'bench', 'water-bowl', 'sapling', 'water-channel', 'picnic-table',
    'swing', 'lantern', 'fence', 'lighthouse', 'bandstand', 'slide', 'trampoline', 'fountain', 'postbox']);

function run(candidate: boolean, policy: Policy, daily: number) {
    // The candidate changes only home comfort/level gates, catalog eligibility and cape gates.
    // Existing build, town bank, housing capacity, prices, reachability and boat logic execute.
    for (let i = 1; i <= 3; i++) Object.assign(RULES.homeGrowth[i]!, originalGrowth[i], candidate ? { comfort: 0, level: 1 } : {});
    Object.assign(CAPE_LEVEL, candidate ? [1, 1] : [5, 6]);
    let sequence = 0, facts = 0, wallet = 0, purchases = 0;
    const states = Array.from({ length: policy === 'two-islands' ? 2 : 1 }, (_, i) => newIsland(`design-pace-${i}`, T0));
    const initial = new Set(['seed:home', 'landmark:flower', 'landmark:bench', 'landmark:water-bowl', 'landmark:sapling']);
    const eligibility = (state: GrowingState) => {
        if (!candidate) return;
        state.unlocked = UNLOCKS.map(x => x.key).filter(key => {
            const [category, kind] = key.split(':');
            return (category === 'seed' ? allowedSeed : allowedLandmark).has(kind)
                && (state.villagers.length > 0 || initial.has(key));
        });
    };
    const spot = (state: GrowingState, blocking: boolean, home = false) => {
        const reached = reachableFromHome(state);
        return landCells(state).filter(cell => canPlace(state, cell) && isReachable(cell, reached)
            && (cell.z % 2 === 1) === blocking && (!home || canReachHomePlacement(state, cell)))
            .sort((a, b) => distance(a, HOME_CELL) - distance(b, HOME_CELL) || a.x - b.x || a.z - b.z)[0];
    };
    const act = (index: number, command: Command) => {
        eligibility(states[index]);
        states[index] = applyIntent(states[index], { id: `design-${sequence++}`, command }).state;
        purchases++;
        eligibility(states[index]);
    };
    states.forEach((state, i) => act(i, { type: 'plant', kind: 'home', cell: spot(state, true, true)! }));
    const rows: object[] = [];
    const milestones: object[] = [], seenMilestones = new Set<number>();
    for (let day = 1; day <= 30; day++) {
        const index = policy === 'two-islands' ? Math.floor((day - 1) / 7) % 2 : 0;
        states[index].drops = wallet;
        for (let session = 0; session < 2; session++) {
            const now = T0 + ((day - 1) * 24 + session * 10) * HOUR;
            advanceNature(states[index], now);
            const count = session ? Math.floor(daily / 2) : Math.ceil(daily / 2);
            states[index] = ingestCompletions(states[index], Array.from({ length: count }, () => ({ id: `fact-${facts++}`, at: now }))).state;
            openTown(states[index]);
            eligibility(states[index]);
            const place = (kind: LandmarkKind, blocking: boolean) => {
                const state = states[index], cell = spot(state, blocking), price = LANDMARK_PRICE[kind];
                if (!cell || price === undefined || state.drops < price || !state.unlocked.includes(`landmark:${kind}`)) return false;
                act(index, { type: 'place', kind, cell }); return true;
            };
            // Garden policy buys at most 20 drops of decoration before town infrastructure per session.
            if (policy === 'garden') place(day % 3 === 0 ? 'sapling' : 'flower', day % 3 === 0);
            for (let guard = 0; guard < 30; guard++) {
                const state = states[index], n = state.villagers.length;
                const pending = state.plots.filter(p => p.stage === 0 && p.cell);
                const needsHome = housing(state).vacancy + pending.filter(p => p.kind === 'home').length < 1;
                const needsFood = foodSupport(state) + pending.filter(p => p.kind === 'farm').length * 2 <= n;
                const quote = landQuote(state);
                if ((!spot(state, true, true) || !spot(state, false)) && quote && state.drops >= quote.price) {
                    act(index, { type: 'expand', side: quote.sides[0] }); continue;
                }
                const plant = (kind: SeedKind) => {
                    const cell = spot(states[index], kind === 'home', kind === 'home');
                    if (!cell || states[index].drops < 40 || !states[index].unlocked.includes(`seed:${kind}`)) return false;
                    act(index, { type: 'plant', kind, cell }); return true;
                };
                if (needsHome && plant('home')) continue;
                if (needsFood && plant('farm')) continue;
                // The same comfort-seeking choice in both modes; candidate does not require it for growth.
                if (state.drops >= 20) {
                    const before = genki(state);
                    const cell = landCells(state).filter(c => canPlace(state, c)).map(c => ({ cell: c,
                        gain: genki({ ...state, landmarks: [...state.landmarks, { id: 'preview', kind: 'bench', cell: c, growth: 0 }] }) - before,
                    })).sort((a, b) => b.gain - a.gain)[0];
                    if (cell && cell.gain > 0) { act(index, { type: 'place', kind: 'bench', cell: cell.cell }); continue; }
                }
                break;
            }
            const total = states.reduce((sum, island) => sum + island.villagers.length, 0);
            for (const target of [3, 5, 10]) if (total >= target && !seenMilestones.has(target)) {
                seenMilestones.add(target);
                milestones.push({ populationAtLeast: target, day, session: session + 1,
                    receivedCompletions: facts, receivedDrops: facts * 2, wallet: states[index].drops,
                    spentDrops: facts * 2 - states[index].drops, townClocks: states.map(island => island.town.clock) });
            }
        }
        wallet = states[index].drops;
        if ([1, 7, 30].includes(day)) rows.push({ day, population: states.map(s => s.villagers.length),
            totalPopulation: states.reduce((n, s) => n + s.villagers.length, 0), wallet,
            landCells: states.map(s => landCells(s).length), homes: states.map(s => s.plots.filter(p => p.kind === 'home').length),
            farms: states.map(s => s.plots.filter(p => p.kind === 'farm').length),
            capacity: states.map(s => housing(s).capacity), food: states.map(s => foodSupport(s)),
            clock: states.map(s => s.town.clock), bank: states.map(s => s.town.bank), purchases });
    }
    return { rules: candidate ? 'candidate-partial-diagnostic' : 'current-domain', policy, dailyCompletions: daily, rows, milestones };
}

const results = [6, 20].flatMap(daily => (['housing', 'garden', 'two-islands'] as Policy[])
    .flatMap(policy => [false, true].map(candidate => run(candidate, policy, daily))));
const report = {
    kind: 'synthetic design diagnostic; not candidate runtime acceptance',
    generatedAt: new Date().toISOString(),
    assumptions: [
        '30 days, 6 or 20 synthetic valid completions per day split into two sessions; no user data',
        'Housing algorithm purchases one vacancy ahead, then food if capacity is exhausted, then a bench only if comfort improves',
        'Garden algorithm buys one flower or sapling (at most 20 drops) per session before the same housing algorithm; it may deliberately postpone housing',
        'Two-islands alternates every seven days; one shared wallet, independent states and town banks, free initial house in each',
        'Placement uses accessible odd rows for blocking objects and even rows for farms/flowers; this is a scripted policy, not a child or optimal play',
        'Both policies retain existing command, geometry-free logical cell reachability and town processing; candidate uses in-memory rules/eligibility overrides only',
        'Candidate excludes new market/bakery/planter/wild/play/festival purchases; these synthetic policies only buy home/farm/bench/flower/sapling',
        'Cosmetics, W slots/migration, authored terrain, new place shapes, visible logistics and preference-dependent fun are not simulated',
        'Population milestones are sampled at session end, not the exact within-session boat arrival or dawn',
        'Current policy also does not try every current food alternative; results cannot isolate the effect of food catalog removal',
    ],
    results,
};
writeFileSync(fileURLToPath(new URL('./pace-results.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
console.table(results.map(r => ({ rules: r.rules, policy: r.policy, daily: r.dailyCompletions, ...r.rows[2] as object })));
