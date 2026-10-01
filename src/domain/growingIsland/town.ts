import { comfort, foodSupport, genki, housing, islandLevel, levelFor, occupantsOf, refreshUnlocks } from './community';
import { features, islandCharacter, styleAt } from './environment';
import { dayMoment } from './moments';
import { arrivalName } from './names';
import { advancePier, docked } from './pier';
import { RULES, WONDER_LEVELS } from './rules';
import { isReachable, reachableFromHome } from './space';
import type { Cell, GrowingState, Moment, Plot, TownEvent, Villager } from './types';

const isDawn = (hour: number) => hour % 24 === RULES.dawnHour;

/** Level events for each level crossed; levels 3, 5, 7 and 9 also bring a ふしぎの たね (§3.5). */
export function levelUp(state: GrowingState, before: number, after: number): TownEvent[] {
    const events: TownEvent[] = [];
    for (let level = before + 1; level <= after; level++) {
        events.push({ type: 'level', level });
        if ((WONDER_LEVELS as readonly number[]).includes(level)) { state.wonderSeeds = (state.wonderSeeds ?? 0) + 1; events.push({ type: 'wonder-seed' }); }
    }
    return events;
}

function build(state: GrowingState, hour: number, events: TownEvent[]) {
    const due = state.plots.filter(p => p.cell && p.stage === 0 && p.plantedAt + RULES.buildHours <= hour);
    if (!due.length) return;
    const reached = reachableFromHome(state), all = features(state);
    for (const plot of due) {
        if (!isReachable(plot.cell!, reached)) continue;
        plot.stage = 1; plot.builtAt = hour; plot.stagedAt = hour;
        plot.style = styleAt(state, plot.cell!, all);
        events.push({ type: 'built', plotId: plot.id });
        if (!state.unopened.includes(plot.id)) state.unopened.push(plot.id);
    }
}

function growHomes(state: GrowingState, hour: number, events: TownEvent[]) {
    const level = islandLevel(state), fed = foodSupport(state) >= state.villagers.length;
    for (const plot of state.plots) {
        if (plot.kind !== 'home' || !plot.cell || plot.stage < 1 || plot.stage > 3) continue;
        const rule = RULES.homeGrowth[plot.stage as 1 | 2 | 3], people = occupantsOf(state, plot.id);
        if (!people.length || hour - (plot.stagedAt ?? plot.builtAt ?? hour) < rule.hours || level < rule.level) continue;
        const average = people.reduce((sum, v) => sum + comfort(state, v, fed), 0) / people.length;
        if (average < rule.comfort) continue;
        plot.stage = (plot.stage + 1) as Plot['stage']; plot.stagedAt = hour;
        events.push({ type: 'grew', plotId: plot.id, stage: plot.stage });
        if (!state.unopened.includes(plot.id)) state.unopened.push(plot.id);
    }
}

function refreshCommunity(state: GrowingState, events: TownEvent[]) {
    const before = levelFor(state.genki.best);
    state.genki.current = genki(state);
    state.genki.best = Math.max(state.genki.best, state.genki.current);
    const after = levelFor(state.genki.best);
    events.push(...levelUp(state, before, after));
    const character = islandCharacter(state);
    if (character !== state.character) { state.character = character; events.push({ type: 'character', character }); }
    const keys = refreshUnlocks(state);
    if (keys.length) events.push({ type: 'unlocked', keys });
}

/** The vacant home where the newcomer would feel best; ties go to the oldest home. */
function chooseHome(state: GrowingState, villager: Villager) {
    const homes = state.plots.filter(p => p.kind === 'home' && p.cell && p.stage > 0
        && occupantsOf(state, p.id).length < RULES.homeCapacity[p.stage]);
    let best: Plot | undefined, bestScore = -1;
    for (const home of homes.sort((a, b) => (a.builtAt! - b.builtAt!) || a.id.localeCompare(b.id))) {
        const score = comfort(state, { ...villager, home: home.id });
        if (score > bestScore) { best = home; bestScore = score; }
    }
    return best;
}

export function welcome(state: GrowingState, hour: number, home: Plot): Villager {
    const visitor = advancePier(state, hour);
    const villager: Villager = { id: `v${state.nextId++}`, species: visitor.species, variant: visitor.variant,
        trait: visitor.trait, home: home.id, arrivedAt: hour, name: arrivalName(state, visitor) };
    state.villagers.push(villager);
    state.arrivals.push(villager.id);
    return villager;
}

function moveIn(state: GrowingState, hour: number, events: TownEvent[]): 'full' | 'food' | undefined {
    if (!docked(state, hour)) return;
    const people = state.villagers.length;
    if (housing(state).vacancy < 1) return 'full';
    if (foodSupport(state) <= people) return 'food';
    const home = chooseHome(state, { ...state.pier.visitor, id: 'candidate', home: '', arrivedAt: hour });
    if (!home) return 'full';
    events.push({ type: 'arrived', villagerId: welcome(state, hour, home).id });
}

/**
 * Opens the banked town time in one deterministic pass (§11). The result is saved at once,
 * so closing the app midway through the presentation cannot change what happened.
 */
export function openTown(state: GrowingState): TownEvent[] {
    const events: TownEvent[] = [], end = state.town.clock + state.town.bank;
    let blocked: 'full' | 'food' | undefined, moment: { moment: Moment; cell?: Cell } | undefined;
    for (let hour = state.town.clock + 1; hour <= end; hour++) {
        build(state, hour, events);
        if (!isDawn(hour)) continue;
        growHomes(state, hour, events);
        refreshCommunity(state, events);
        blocked = moveIn(state, hour, events);
        // One small surprise at most per opening: the latest dawn's (§11.2).
        moment = dayMoment(state, Math.floor(hour / 24));
    }
    state.town.clock = end; state.town.bank = 0;
    const reached = reachableFromHome(state);
    for (const plot of state.plots) if (plot.cell && plot.stage === 0 && plot.plantedAt + RULES.buildHours <= end
        && !isReachable(plot.cell, reached)) events.push({ type: 'blocked', reason: 'unreachable', plotId: plot.id });
    if (blocked && !events.some(e => e.type === 'arrived')) events.push({ type: 'blocked', reason: blocked });
    if (!docked(state)) events.push({ type: 'boat', hoursLeft: state.pier.dockAt - state.town.clock });
    if (moment) events.push({ type: 'moment', ...moment });
    if (!events.length) events.push({ type: 'quiet' });
    return events;
}
