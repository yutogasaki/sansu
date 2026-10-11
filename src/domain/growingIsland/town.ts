import { comfort, foodSupport, genki, housing, islandLevel, levelFor, occupantsOf, refreshUnlocks } from './community';
import { features, islandCharacter, styleAt } from './environment';
import { arrivalName } from './names';
import { advancePier, docked } from './pier';
import { RULES, WONDER_LEVELS } from './rules';
import { isReachable, onLand, reachableFromHome } from './space';
import type { GrowingState, Plot, TownEvent, Villager } from './types';
import type { IslandWorld } from './worldDefinition';

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

function build(state: GrowingState, hour: number, events: TownEvent[], world?: IslandWorld) {
    const due = state.plots.filter(p => p.cell && (!world || onLand(state, p.cell, world)) && p.stage === 0 && p.plantedAt + RULES.buildHours <= hour);
    if (!due.length) return;
    const reached = reachableFromHome(state, undefined, world), all = features(state, world);
    for (const plot of due) {
        if (!isReachable(plot.cell!, reached, world)) continue;
        plot.stage = 1; plot.builtAt = hour; plot.stagedAt = hour;
        plot.style = styleAt(state, plot.cell!, all, world);
        events.push({ type: 'built', plotId: plot.id });
        if (!state.unopened.includes(plot.id)) state.unopened.push(plot.id);
    }
}

function growHomes(state: GrowingState, hour: number, events: TownEvent[], world?: IslandWorld) {
    const reached = reachableFromHome(state, undefined, world), level = islandLevel(state), fed = foodSupport(state, reached, world) >= state.villagers.length;
    for (const plot of state.plots) {
        if (plot.kind !== 'home' || !plot.cell || world && !onLand(state, plot.cell, world) || !isReachable(plot.cell, reached, world) || plot.stage < 1 || plot.stage > 3) continue;
        const rule = RULES.homeGrowth[plot.stage as 1 | 2 | 3], people = occupantsOf(state, plot.id);
        if (!people.length || hour - (plot.stagedAt ?? plot.builtAt ?? hour) < rule.hours || level < rule.level) continue;
        const average = people.reduce((sum, v) => sum + comfort(state, v, fed, reached, world), 0) / people.length;
        if (average < rule.comfort) continue;
        plot.stage = (plot.stage + 1) as Plot['stage']; plot.stagedAt = hour;
        events.push({ type: 'grew', plotId: plot.id, stage: plot.stage });
        if (!state.unopened.includes(plot.id)) state.unopened.push(plot.id);
    }
}

function refreshCommunity(state: GrowingState, events: TownEvent[], world?: IslandWorld) {
    const before = levelFor(state.genki.best);
    state.genki.current = genki(state, undefined, world);
    state.genki.best = Math.max(state.genki.best, state.genki.current);
    const after = levelFor(state.genki.best);
    events.push(...levelUp(state, before, after));
    const character = islandCharacter(state, world);
    if (character !== state.character) { state.character = character; events.push({ type: 'character', character }); }
    const keys = refreshUnlocks(state);
    if (keys.length) events.push({ type: 'unlocked', keys });
}

/** The vacant home where the newcomer would feel best; ties go to the oldest home. */
function chooseHome(state: GrowingState, villager: Villager, world?: IslandWorld) {
    const reached = reachableFromHome(state, undefined, world);
    const homes = state.plots.filter(p => p.kind === 'home' && p.cell && (!world || onLand(state, p.cell, world)) && isReachable(p.cell, reached, world) && p.stage > 0
        && occupantsOf(state, p.id).length < RULES.homeCapacity[p.stage]);
    let best: Plot | undefined, bestScore = -1;
    for (const home of homes.sort((a, b) => (a.builtAt! - b.builtAt!) || a.id.localeCompare(b.id))) {
        const score = comfort(state, { ...villager, home: home.id }, undefined, reached, world);
        if (score > bestScore) { best = home; bestScore = score; }
    }
    return best;
}

export function welcome(state: GrowingState, hour: number, home: Plot, world?: IslandWorld): Villager {
    if (world) {
        const owned = state.plots.find(plot => plot.id === home.id && plot.kind === 'home' && plot.stage > 0 && plot.cell && world.owns(plot.cell));
        if (!owned?.cell || occupantsOf(state, owned.id).length >= RULES.homeCapacity[owned.stage]
            || !isReachable(owned.cell, reachableFromHome(state, undefined, world), world)) throw new Error('なかまの いえまで あるける ばしょを あけてみよう。');
    }
    const visitor = advancePier(state, hour, world);
    const villager: Villager = { id: `v${state.nextId++}`, species: visitor.species, variant: visitor.variant,
        trait: visitor.trait, home: home.id, arrivedAt: hour, name: arrivalName(state, visitor) };
    state.villagers.push(villager);
    state.arrivals.push(villager.id);
    return villager;
}

function moveIn(state: GrowingState, hour: number, events: TownEvent[], world?: IslandWorld): 'full' | 'food' | undefined {
    if (!docked(state, hour)) return;
    const people = state.villagers.length;
    if (housing(state, undefined, world).vacancy < 1) return 'full';
    if (foodSupport(state, undefined, world) <= people) return 'food';
    const home = chooseHome(state, { ...state.pier.visitor, id: 'candidate', home: '', arrivedAt: hour }, world);
    if (!home) return 'full';
    events.push({ type: 'arrived', villagerId: welcome(state, hour, home, world).id });
}

/** Is there a useful town job? Blocked seeds and impossible growth never drain the bank. */
function hasTownWork(state: GrowingState, world?: IslandWorld) {
    // A boat can finish its crossing even before a home is prepared. It then waits.
    if (!docked(state)) return true;
    const reached = reachableFromHome(state, undefined, world), people = state.villagers.length;
    if (state.plots.some(p => p.cell && (!world || onLand(state, p.cell, world)) && p.stage === 0 && isReachable(p.cell, reached, world))) return true;
    if (housing(state, reached, world).vacancy > 0 && foodSupport(state, reached, world) > people) return true;
    if (genki(state, reached, world) !== state.genki.current) return true;
    const fed = foodSupport(state, reached, world) >= people, level = islandLevel(state);
    return state.plots.some(p => {
        if (p.kind !== 'home' || !p.cell || world && !onLand(state, p.cell, world) || !isReachable(p.cell, reached, world) || p.stage < 1 || p.stage > 3) return false;
        const rule = RULES.homeGrowth[p.stage as 1 | 2 | 3], occupants = occupantsOf(state, p.id);
        return level >= rule.level && occupants.length > 0
            && occupants.reduce((sum, v) => sum + comfort(state, v, fed, reached, world), 0) / occupants.length >= rule.comfort;
    });
}

/** Open useful banked time once, retaining the rest for the next seed or restored route. */
export function openTown(state: GrowingState, world?: IslandWorld): TownEvent[] {
    const events: TownEvent[] = [], from = state.town.clock;
    while (state.town.bank > 0 && hasTownWork(state, world)) {
        state.town.clock += 1; state.town.bank -= 1;
        const hour = state.town.clock;
        build(state, hour, events, world);
        if (!isDawn(hour)) continue;
        growHomes(state, hour, events, world);
        refreshCommunity(state, events, world);
        moveIn(state, hour, events, world);
    }
    const reached = reachableFromHome(state, undefined, world);
    for (const plot of state.plots) if (plot.cell && plot.stage === 0 && !isReachable(plot.cell, reached, world))
        events.push({ type: 'blocked', reason: 'unreachable', plotId: plot.id });
    if (docked(state) && !events.some(e => e.type === 'arrived')) {
        if (housing(state, reached, world).vacancy < 1) events.push({ type: 'blocked', reason: 'full' });
        else if (foodSupport(state, reached, world) <= state.villagers.length) events.push({ type: 'blocked', reason: 'food' });
    }
    if (!docked(state) && state.town.clock > from) events.push({ type: 'boat', hoursLeft: state.pier.dockAt - state.town.clock });
    if (!events.length && state.town.clock > from) events.push({ type: 'quiet' });
    return events;
}
