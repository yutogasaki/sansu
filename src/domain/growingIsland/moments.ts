import { growthStage } from '../islandLife/model';
import { homeCellOf } from './community';
import { BLOOM_HOURS, TREE_MATURE_HOURS } from './environment';
import { roll } from './random';
import { likesOf } from './rules';
import { distance, isReachable, landCells, key, reachableFromHome } from './space';
import type { Cell, GrowingState, Moment, TownEvent, Villager } from './types';

const bloomedFlowers = (state: GrowingState): Cell[] => [
    ...state.landmarks.filter(l => l.kind === 'flower' && l.cell && growthStage({ kind: 'flower', growth: l.growth }) === 2).map(l => l.cell!),
    ...state.plots.filter(p => p.kind === 'wild' && p.cell && p.stage > 0 && p.growth >= BLOOM_HOURS && p.style !== 'tree').map(p => p.cell!),
];

/** Friends who share a favourite thing: they like to spend time together (§7.1). */
export function friendOf(state: GrowingState, villager: Villager): Villager | undefined {
    const likes = likesOf(villager), home = homeCellOf(state, villager);
    return state.villagers.filter(v => v.id !== villager.id && !v.away && likesOf(v).some(like => likes.includes(like)))
        .sort((a, b) => distance(homeCellOf(state, a), home) - distance(homeCellOf(state, b), home) || a.arrivedAt - b.arrivedAt)[0];
}

type Candidate = { moment: Moment; cell?: Cell };

/** The surprises whose conditions hold on the island right now (§11.2). */
export function momentCandidates(state: GrowingState): Candidate[] {
    const out: Candidate[] = [], flowers = bloomedFlowers(state), cells = landCells(state);
    const wet = cells.reduce((sum, cell) => sum + (state.soil[key(cell)] ?? 0), 0) / Math.max(1, cells.length);
    if (wet >= .42) out.push({ moment: 'rainbow' });
    if (flowers.length >= 6) out.push({ moment: 'butterflies', cell: flowers[0] });
    const housed = state.villagers.filter(v => !v.away && v.home !== 'pokomoko');
    for (const v of housed) {
        const friend = friendOf(state, v);
        if (friend && friend.home !== 'pokomoko' && distance(homeCellOf(state, v), homeCellOf(state, friend)) <= 2) {
            out.push({ moment: 'friends', cell: homeCellOf(state, v) }); break;
        }
    }
    // The two spirit guests of spec 51 (F-V01 / F-V02), seen for one night, never moving in.
    const lights = state.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).map(l => l.cell!);
    const bowl = state.landmarks.find(l => l.kind === 'water-bowl' && l.cell && lights.some(c => distance(c, l.cell!) <= 2)
        && flowers.some(c => distance(c, l.cell!) <= 2));
    if (bowl?.cell) out.push({ moment: 'guest-water', cell: bowl.cell });
    const reached = reachableFromHome(state);
    const benches = state.landmarks.filter(l => l.kind === 'bench' && l.cell && isReachable(l.cell, reached)).map(l => l.cell!);
    const tree = state.landmarks.find(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS
        && benches.some(c => distance(c, l.cell!) <= 2) && flowers.filter(c => distance(c, l.cell!) <= 2).length >= 2);
    if (tree?.cell) out.push({ moment: 'guest-grove', cell: tree.cell });
    // Three more one-night guests: a whale by a watery island, a rainbow bird for a flower
    // book of five colours, and the moon rabbit where many lights glow.
    const waters = state.landmarks.filter(l => l.cell && (l.kind === 'water-bowl' || l.kind === 'fountain')).length;
    if (waters >= 2 || state.landmarks.some(l => l.kind === 'lighthouse' && l.cell)) out.push({ moment: 'whale' });
    if ((state.flowerBook?.length ?? 0) >= 5) out.push({ moment: 'rainbow-bird', cell: flowers[0] });
    if (lights.length >= 3) out.push({ moment: 'moon-rabbit', cell: lights[0] });
    return out;
}

const MOMENT_CHANCE = .6, GUEST_CHANCE = .3;
const GUESTS: readonly Moment[] = ['guest-water', 'guest-grove', 'whale', 'rainbow-bird', 'moon-rabbit'];

/** A deterministic real-day draw. Its day must never come from learning or town time. */
export function dayMoment(state: GrowingState, day: number): Candidate | undefined {
    const guests = roll(state.seed, 'moment-guest', 'day', day) < GUEST_CHANCE;
    const candidates = momentCandidates(state).filter(c => guests || !GUESTS.includes(c.moment));
    if (!candidates.length || roll(state.seed, 'moment', 'day', day) >= MOMENT_CHANCE) return undefined;
    return candidates[Math.floor(roll(state.seed, 'moment-pick', 'day', day) * candidates.length)];
}

export function surpriseDay(state: GrowingState) {
    return Math.max(0, Math.floor((state.nature.realAt - state.enrolledAt) / 86_400_000));
}

/** Keep an unseen result across reloads and days; never draw missed days in a batch. */
export function scheduleSurprise(state: GrowingState): TownEvent[] {
    const day = surpriseDay(state);
    state.surprise ??= { day: -1 };
    if (!state.surprise.pending && day > state.surprise.day) {
        state.surprise.day = day;
        const result = dayMoment(state, day);
        if (result) state.surprise.pending = { day, ...result };
    }
    const pending = state.surprise.pending;
    return pending ? [{ type: 'moment', ...pending }] : [];
}
