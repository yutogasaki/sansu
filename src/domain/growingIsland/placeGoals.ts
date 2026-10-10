import { placeGoalCatalog } from './placeCatalog';
import { derivePlaces } from './places';
import { isReachable, key, reachableFromHome } from './space';
import { PLACE_GOAL_IDS, type DerivedPlace, type PlaceEvidence, type PlaceGoalId, type PlaceProgress, type PlaceStatus, type PlaceUseEvidence } from './placeTypes';
import type { GrowingState } from './types';

export function newPlaceProgress(): PlaceProgress {
    return { version: 1, milestones: {}, uses: {}, shown: {}, useHistory: [] };
}

const goalId = (id: unknown): id is PlaceGoalId => PLACE_GOAL_IDS.includes(id as PlaceGoalId);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const keysOnly = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const receiptKey = (use: PlaceUseEvidence) => JSON.stringify([use.ruleId, use.revision, use.actorId, use.targetId]);

/** Reject unknown/corrupt saves before any writer can discard their future meaning. */
export function validatePlaceProgress(progress: PlaceProgress) {
    const evidence = (value: unknown, id?: string): value is PlaceEvidence => object(value) && goalId(value.ruleId)
        && (id === undefined || value.ruleId === id) && Number.isFinite(value.at) && Number(value.at) >= 0
        && text(value.anchorId) && text(value.variant) && text(value.revision)
        && Array.isArray(value.memberIds) && value.memberIds.length > 0 && value.memberIds.every(text)
        && new Set(value.memberIds).size === value.memberIds.length;
    const use = (value: unknown, id?: string): value is PlaceUseEvidence => evidence(value, id)
        && text((value as unknown as Record<string, unknown>).actorId) && text((value as unknown as Record<string, unknown>).targetId)
        && value.ruleId !== 'P06';
    if (!object(progress) || progress.version !== 1 || !keysOnly(progress, ['version', 'selected', 'milestones', 'uses', 'shown', 'useHistory'])
        || (progress.selected !== undefined && !goalId(progress.selected))
        || !object(progress.milestones) || !object(progress.uses) || !object(progress.shown)
        || Object.entries(progress.milestones).some(([id, value]) => !goalId(id) || !evidence(value, id))
        || Object.entries(progress.shown).some(([id, value]) => !goalId(id) || !text(value))
        || Object.entries(progress.uses).some(([id, value]) => !goalId(id) || id === 'P06' || !object(value)
            || !keysOnly(value, ['pokomoko', 'villager']) || Object.entries(value).some(([actor, fact]) => !use(fact, id)
                || (actor === 'pokomoko' ? fact.actorId !== 'pokomoko' : fact.actorId === 'pokomoko')))
        || (progress.useHistory !== undefined && (!Array.isArray(progress.useHistory) || progress.useHistory.some(value => !use(value))
            || new Set(progress.useHistory.map(receiptKey)).size !== progress.useHistory.length)))
        throw new Error('この島の育つばしょは新しい版で開いてください。');
}

function snapshot(place: DerivedPlace, at: number): PlaceEvidence {
    return { at, ruleId: place.ruleId, anchorId: place.anchorId, memberIds: [...place.memberIds], variant: place.variant, revision: place.revision };
}

function presentActor(state: GrowingState, id: string) {
    if (id === 'pokomoko') return true;
    const actor = state.villagers.find(actor => actor.id === id && !actor.away && !state.arrivals.includes(actor.id));
    if (!actor) return false;
    if (actor.home === 'pokomoko') return true;
    const home = state.plots.find(plot => plot.id === actor.home && plot.kind === 'home' && plot.stage > 0 && plot.cell
        && !state.unopened.includes(plot.id));
    return Boolean(home?.cell && isReachable(home.cell, reachableFromHome(state)));
}

function matchesCurrentUse(state: GrowingState, place: DerivedPlace, fact?: PlaceUseEvidence) {
    return Boolean(fact && fact.ruleId === place.ruleId && fact.revision === place.revision && fact.anchorId === place.anchorId
        && fact.memberIds.length === place.memberIds.length && fact.memberIds.every(id => place.memberIds.includes(id))
        && place.useTargets.some(target => target.id === fact.targetId) && presentActor(state, fact.actorId));
}

/** The latest actor slot is convenient for deduplication, but an older actual receipt
 * remains valid while its place/target and actor still exist in the current island. */
function hasCurrentUse(state: GrowingState, place: DerivedPlace, actor?: 'pokomoko' | 'villager') {
    const matches = (fact: PlaceUseEvidence) => (actor === undefined || (fact.actorId === 'pokomoko' ? 'pokomoko' : 'villager') === actor)
        && matchesCurrentUse(state, place, fact);
    return Boolean(state.placeProgress?.useHistory?.some(matches)
        || Object.values(state.placeProgress?.uses[place.ruleId] ?? {}).some(matches));
}

const grown = (place: DerivedPlace) => place.stage === 'grown' || place.stage === 'lived';
const INPUT_NAMES: Record<string, string> = {
    'landmark:sapling': '木のなえ', 'landmark:bench': 'ベンチ', 'landmark:water-bowl': '水ばち',
    'landmark:water-channel': 'みずみち', 'landmark:flower': '花', 'plot:home': 'いえ', 'plot:play': 'あそびば',
};
const GOAL_HINTS: Record<PlaceGoalId, string> = {
    P01: '木を よせて ベンチを おいてみよう', P02: '大木のそばに 木のいえを そだてよう',
    P03: '水ばちを みずみちで つないでみよう', P04: '海のそばに いえと あそびばを よせてみよう',
    P05: '花を よせて 花の屋根を そだてよう', P06: 'ちがう ばしょを つないで めぐってみよう',
};
function currentIsland(state: GrowingState, places: DerivedPlace[]) {
    const reachable = reachableFromHome(state);
    const mature = places.filter(place => grown(place) && place.entrances.some(cell => reachable.has(key(cell))));
    const families = new Set(mature.map(place => place.family));
    const pokomoko = mature.some(place => hasCurrentUse(state, place, 'pokomoko'));
    const villager = mature.some(place => hasCurrentUse(state, place, 'villager'));
    return { mature, families, pokomoko, villager };
}

/** Matches the same set that the book reports; P06 has no invented owned object. */
export function placeRevisionForGoal(state: GrowingState, id: PlaceGoalId): string | undefined {
    const places = derivePlaces(state);
    if (id !== 'P06') return places.filter(place => place.ruleId === id && grown(place)).sort((a, b) => a.id.localeCompare(b.id))[0]?.revision;
    const { mature, families } = currentIsland(state, places);
    return families.size >= 3 ? JSON.stringify(mature.map(place => place.revision).sort()) : undefined;
}

/** Milestones retain the first exact owned snapshot, even after a garden is split or stored. */
export function syncPlaceMilestones(state: GrowingState, now: number) {
    const progress = state.placeProgress ??= newPlaceProgress();
    validatePlaceProgress(progress);
    const places = derivePlaces(state);
    for (const place of places.filter(grown).sort((a, b) => a.id.localeCompare(b.id)))
        progress.milestones[place.ruleId] ??= snapshot(place, now);
    const island = currentIsland(state, places);
    if (island.families.size >= 3 && island.pokomoko && island.villager && !progress.milestones.P06) {
        progress.milestones.P06 = { at: now, ruleId: 'P06', anchorId: state.seed,
            memberIds: [...new Set(island.mature.flatMap(place => place.memberIds))].sort(), variant: 'island',
            revision: JSON.stringify(island.mature.map(place => place.revision).sort()) };
    }
}

export interface PlaceUseReceipt { ruleId: PlaceGoalId; placeId: string; revision: string; actorId: string; targetId: string }
/** Called after the foreground actor reached a target; maturity alone never creates a use. */
export function recordPlaceUse(state: GrowingState, receipt: PlaceUseReceipt, at: number) {
    if (!Number.isFinite(at) || at < 0) throw new Error('ばしょの いまを もういちど たしかめてね。');
    const place = derivePlaces(state).find(place => place.id === receipt.placeId && place.ruleId === receipt.ruleId && grown(place)
        && place.revision === receipt.revision && place.entrances.length > 0);
    if (!place || !presentActor(state, receipt.actorId)) throw new Error('ばしょの いまを もういちど たしかめてね。');
    const target = place.useTargets.find(target => target.id === receipt.targetId);
    const reached = reachableFromHome(state);
    if (!target || !isReachable(target.route?.[0] ?? target.cell, reached)) throw new Error('ここまで あるける ばしょを あけてみよう。');
    const progress = state.placeProgress ??= newPlaceProgress();
    validatePlaceProgress(progress);
    const fact: PlaceUseEvidence = { ...snapshot(place, at), actorId: receipt.actorId, targetId: receipt.targetId };
    const history = progress.useHistory ??= Object.values(progress.uses).flatMap(actors => Object.values(actors)).filter((fact): fact is PlaceUseEvidence => Boolean(fact));
    const original = history.find(use => receiptKey(use) === receiptKey(fact));
    if (!original) history.push(fact);
    const latest = progress.uses[place.ruleId] ??= {};
    latest[receipt.actorId === 'pokomoko' ? 'pokomoko' : 'villager'] = original ?? fact;
    syncPlaceMilestones(state, at);
}

/** A notice is acknowledged only for the grown revision rendered by the owner. */
export function recordPlaceShown(state: GrowingState, receipt: { ruleId: PlaceGoalId; revision: string }) {
    if (!goalId(receipt.ruleId) || !text(receipt.revision)) throw new Error('ばしょの いまを もういちど たしかめてね。');
    const current = receipt.ruleId === 'P06' ? placeRevisionForGoal(state, 'P06')
        : derivePlaces(state).find(place => place.ruleId === receipt.ruleId && grown(place) && place.revision === receipt.revision)?.revision;
    if (current !== receipt.revision) throw new Error('ばしょの いまを もういちど たしかめてね。');
    const progress = state.placeProgress ??= newPlaceProgress();
    validatePlaceProgress(progress);
    progress.shown[receipt.ruleId] = receipt.revision;
}

/** Current functionality and durable achievements are independent of goal selection. */
export function placeStatuses(state: GrowingState): PlaceStatus[] {
    const places = derivePlaces(state);
    const score = { seeded: 0, connected: 1, grown: 2, lived: 3 };
    return placeGoalCatalog.map(goal => {
        const achieved = Boolean(state.placeProgress?.milestones[goal.id]);
        if (goal.id === 'P06') {
            const island = currentIsland(state, places), ready = island.families.size >= 3;
            const missing = [!ready && `ちがう ばしょを あと ${Math.max(0, 3 - island.families.size)}しゅるい そだててみよう`,
                !island.pokomoko && 'ぽこもこが そだった ばしょで あそぶ', !island.villager && 'なかまが そだった ばしょで あそぶ'].filter((line): line is string => Boolean(line));
            return { id: goal.id, name: goal.name, family: 'island', hint: missing[0] ?? GOAL_HINTS.P06, achieved, missing,
                stage: ready ? island.pokomoko && island.villager ? 'lived' : 'grown' : island.families.size >= 2 ? 'connected' : 'seeded' };
        }
        const best = places.filter(place => place.ruleId === goal.id).map(place => ({ place,
            stage: grown(place) && hasCurrentUse(state, place) ? 'lived' as const : place.stage }))
            .sort((a, b) => score[b.stage] - score[a.stage] || a.place.id.localeCompare(b.place.id))[0];
        const place = best?.place, used = best?.stage === 'lived';
        return { id: goal.id, name: goal.name, family: goal.family, hint: place?.missing[0] ?? (used ? 'また このばしょで あそぼう' : place && grown(place) ? 'そだった ばしょで あそんでみよう' : GOAL_HINTS[goal.id]), achieved, place,
            stage: best?.stage ?? 'seeded', missing: place?.missing ?? goal.inputs.map(input => `${INPUT_NAMES[input.kind] ?? 'もの'}を ${input.count}こ 近くに おいてみよう`) };
    });
}
