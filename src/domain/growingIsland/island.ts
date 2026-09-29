import type { LifeState } from '../islandLife/model';
import { refreshUnlocks } from './community';
import { islandCharacter, syncSoil } from './environment';
import { roll } from './random';
import { rollVisitor } from './pier';
import { RULES } from './rules';
import type { GrowingState, Trait } from './types';

function blank(seed: string, now: number): GrowingState {
    return {
        rules: 'growing-island-v1', seed, drops: 0,
        land: { extra: [], capes: [] }, plots: [], landmarks: [], keepsakes: [], villagers: [],
        pier: { visitor: { ordinal: 0, species: 'rabbit', variant: { color: 0, accessory: 0, sparkle: false }, trait: 'lively' },
            next: { ordinal: 1, species: 'otter', variant: { color: 0, accessory: 0, sparkle: false }, trait: 'mellow' }, rolled: 1, dockAt: 0 },
        town: { clock: 0, bank: 0 }, nature: { hours: 0, realAt: now, lastSpread: 0 }, soil: {},
        genki: { current: 0, best: 0 }, character: 'mixed', unlocked: [], unopened: [], arrivals: [],
        tutorial: 'done', learned: [], enrolledAt: now, applied: [], nextId: 1,
    };
}

/** The first visitor is already on the pier; later boats pace themselves (§7.2). */
function seatPier(state: GrowingState, firstFriend: boolean) {
    state.pier = { visitor: rollVisitor(state, 0, firstFriend ? ['rabbit', 'otter'] : undefined), next: rollVisitor(state, 1), rolled: 1,
        dockAt: state.town.clock };
}

/** A new island: house, Pokomoko, a bloomed flower and a bench, and a friend on the pier (§14). */
export function newIsland(profileId: string, now: number): GrowingState {
    const state = blank(profileId, now);
    state.landmarks.push({ id: 'starter-flower', kind: 'flower', cell: { x: 1, z: 2 }, growth: 6 },
        { id: 'starter-bench', kind: 'bench', cell: { x: 3, z: 3 }, growth: 0 });
    state.tutorial = 'first-home';
    syncSoil(state);
    seatPier(state, true);
    refreshUnlocks(state);
    return state;
}

const TRAITS: readonly Trait[] = ['lively', 'mellow', 'shy', 'hungry'];

/**
 * Copies one replayed moment of the current island (save 21) into the new engine (§18.2).
 * The original record is not modified; it stays available for rollback.
 */
export function fromLife(life: LifeState, profileId: string, now: number): GrowingState {
    const state = blank(profileId, now);
    state.drops = life.drops;
    state.legacyLight = life.light;
    state.land = { expanded: life.expanded, extra: [...(life.extraLand ?? [])], capes: [] };
    state.landmarks = life.items.map(item => ({
        id: item.id, kind: item.kind, cell: item.cell && { ...item.cell }, growth: item.growth,
        maturedAt: item.kind === 'sapling' && item.growth >= 18 ? 0 : undefined,
        rotation: item.rotation,
        legacy: { style: item.style, foodStage: item.foodStage, foodStock: item.foodStock, access: item.access },
    }));
    state.villagers = life.residents.filter(r => r.id !== 'pokomoko').map(r => ({
        id: `legacy-${r.id}`, species: r.id as 'rabbit' | 'otter', legacyId: r.id as 'rabbit' | 'otter',
        variant: { color: 0, accessory: 0, sparkle: false },
        trait: TRAITS[Math.floor(roll(profileId, 'legacy-trait', r.id, 0) * TRAITS.length)],
        home: 'pokomoko', arrivedAt: 0,
    }));
    state.soil = { ...(life.soilMoisture ?? {}) };
    syncSoil(state);
    state.character = islandCharacter(state);
    seatPier(state, false);
    refreshUnlocks(state);
    return state;
}

/** Each valid completion after enrollment adds drops and town time once (§10). */
export function ingestCompletions(previous: GrowingState, facts: readonly { id: string; at: number }[]) {
    const known = new Set(previous.learned);
    const fresh = facts.filter(f => f.at >= previous.enrolledAt && !known.has(f.id));
    if (!fresh.length) return { state: previous, added: 0 };
    const state = structuredClone(previous);
    for (const fact of fresh) { state.learned.push(fact.id); known.add(fact.id); }
    state.drops += fresh.length * RULES.dropsPerCompletion;
    state.town.bank += fresh.length * RULES.townHoursPerCompletion;
    return { state, added: fresh.length };
}

/** Seeds waiting to grow, shown on the learn tab as 🌱n. Never a count of remaining problems. */
export function waitingSeeds(state: GrowingState) {
    return state.plots.filter(p => p.cell && p.stage === 0).length;
}
