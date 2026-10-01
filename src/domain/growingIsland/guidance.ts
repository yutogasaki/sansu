import { LANDMARK_PRICE, SEED_PRICE } from './rules';
import { canPlace, canReachHomePlacement, landQuote } from './commands';
import { landCells } from './space';
import type { AchievementId, Command, GrowingGuidance, GrowingState, GuidanceEvidence, StarterStepId, TownEvent } from './types';

export const STARTER_STEPS: readonly StarterStepId[] = ['S1', 'S2', 'S3', 'S4', 'S5'];
export const ACHIEVEMENTS: readonly AchievementId[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
export const achievementCatalog = [
    { id: 'A1', title: 'はじめての おとなりさん', hint: 'すむの たねを おいてみよう', action: 'home' },
    { id: 'A2', title: 'たねが そだった！', hint: 'くらしの たねを おいてみよう', action: 'seed' },
    { id: 'A3', title: 'じぶんの いろ', hint: 'はたの いろを えらんでみよう', action: 'flag' },
    { id: 'A4', title: 'ばしょを かえてみた', hint: 'ベンチを うごかしてみよう', action: 'move' },
    { id: 'A5', title: 'みんなで えんそうかい', hint: 'おんがくの ひろばを さわってみよう', action: 'concert' },
    { id: 'A6', title: 'しまが ひろがった', hint: 'ひろげる ほうを えらんでみよう', action: 'expand' },
] as const;
export function starterStep(state: GrowingState) { return STARTER_STEPS.find(id => !(state.guidance?.starter.legacy && ['S1', 'S2', 'S3'].includes(id)) && !state.guidance?.starter.steps[id]); }
export function pendingAchievements(state: GrowingState) {
    return ACHIEVEMENTS.filter(id => state.guidance?.achievements[id] && !state.guidance.notified.includes(id));
}
export function newGuidance(automatic: boolean): GrowingGuidance {
    return { version: 1, starter: { automatic, steps: {} }, achievements: {}, notified: [] };
}
const target = (state: GrowingState, id: string) => state.plots.find(p => p.id === id) ?? state.landmarks.find(p => p.id === id)
    ?? state.keepsakes.find(p => p.id === id) ?? state.villagers.find(p => p.id === id);
function evidence(state: GrowingState, source: string, at?: number, id?: string): GuidanceEvidence {
    const item = id ? target(state, id) : undefined;
    return { source, ...(at === undefined ? {} : { at }), ...(id ? { targetId: id } : {}), snapshot: structuredClone({
        flagColor: state.flagColor ?? 0, ...(item ? { target: item } : {}), ...(source === 'legacy' ? { legacy: true } : {}),
    }) };
}
function achieve(state: GrowingState, id: AchievementId, proof: GuidanceEvidence, silent = false) {
    const g = state.guidance!;
    if (g.achievements[id]) return;
    g.achievements[id] = structuredClone(proof);
    if (silent) g.notified.push(id);
}
/** Only facts provable in the old record; no fabricated date or inferred child action. */
export function migrateGuidance(state: GrowingState) {
    if (state.guidance) { validateGuidance(state.guidance); return; }
    state.guidance = newGuidance(false);
    state.guidance.starter.legacy = true;
    // An unopened paid plot's build clock is provable; its opening is still a future action.
    for (const p of state.plots) if (p.stage > 0 && p.paid > 0 && p.kind !== 'wild' && p.kind !== 'wonder'
        && p.builtAt !== undefined && p.builtAt > p.plantedAt) p.townBuilt = true;
    const home = state.plots.find(p => p.kind === 'home' && p.cell);
    if (home) {
        state.guidance.starter.steps.S1 = evidence(state, 'legacy', undefined, home.id);
        if (home.stage > 0 && !state.unopened.includes(home.id)) state.guidance.starter.steps.S2 = evidence(state, 'legacy', undefined, home.id);
    }
    const friend = state.villagers.find(v => !state.arrivals.includes(v.id));
    if (friend) {
        const proof = evidence(state, 'legacy', undefined, friend.id);
        achieve(state, 'A1', proof, true); state.guidance.starter.steps.S3 = structuredClone(proof);
    }
    if (state.land.expanded || state.land.extra.length || state.land.capes.length || state.land.districts?.length)
        {
        const expanded = evidence(state, 'legacy'); expanded.snapshot.land = structuredClone(state.land);
        achieve(state, 'A6', expanded, true);
    }
}
export function validateGuidance(g: GrowingGuidance) {
    const validEvidence = (x: unknown) => Boolean(x && typeof x === 'object' && typeof (x as GuidanceEvidence).source === 'string'
        && ((x as GuidanceEvidence).at === undefined || Number.isFinite((x as GuidanceEvidence).at))
        && (x as GuidanceEvidence).snapshot && typeof (x as GuidanceEvidence).snapshot === 'object'
        && Number.isInteger((x as GuidanceEvidence).snapshot.flagColor)
        && (x as GuidanceEvidence).snapshot.flagColor >= 0 && (x as GuidanceEvidence).snapshot.flagColor <= 9
        && ((x as GuidanceEvidence).targetId === undefined || typeof (x as GuidanceEvidence).targetId === 'string')
        && (!(x as GuidanceEvidence).snapshot.target || (x as GuidanceEvidence).snapshot.target!.id === (x as GuidanceEvidence).targetId));
    if (g.version !== 1 || !g.starter || typeof g.starter.automatic !== 'boolean' || !g.starter.steps || !g.achievements
        || Array.isArray(g.starter.steps) || Array.isArray(g.achievements) || !Array.isArray(g.notified) || g.notified.some(id => !ACHIEVEMENTS.includes(id) || !g.achievements[id])
        || (g.selected !== undefined && !ACHIEVEMENTS.includes(g.selected))
        || Object.entries(g.starter.steps).some(([id, value]) => !STARTER_STEPS.includes(id as StarterStepId) || !validEvidence(value))
        || Object.entries(g.achievements).some(([id, value]) => !ACHIEVEMENTS.includes(id as AchievementId) || !validEvidence(value))
        || (g.learning !== undefined && !validEvidence(g.learning)))
        throw new Error('この島のあそびかたは新しい版で開いてください。');
}
export function noteLearning(state: GrowingState, id: string, at: number) {
    if (state.guidance && !state.guidance.learning) state.guidance.learning = evidence(state, `learning:${id}`, at);
}
/** The actual bank-consuming engine built this plot, rather than the instant free introduction. */
export function noteTownBuilds(state: GrowingState, events: readonly TownEvent[]) {
    for (const event of events) if (event.type === 'built') {
        const p = state.plots.find(plot => plot.id === event.plotId);
        if (p && !p.starter && p.paid > 0 && p.kind !== 'wild' && p.kind !== 'wonder' && p.builtAt! > p.plantedAt)
            p.townBuilt = true;
    }
}
/** Called only after the corresponding validated operation, inside its save transaction. */
export function noteGuidanceIntent(previous: GrowingState, state: GrowingState, command: Command, source: string, at?: number) {
    const g = state.guidance;
    if (!g) return;
    const proof = (id?: string) => evidence(state, source, at, id);
    const step = (id: StarterStepId, e: GuidanceEvidence) => { g.starter.steps[id] ??= structuredClone(e); };
    if (command.type === 'plant' && previous.tutorial === 'first-home' && command.kind === 'home') {
        const p = state.plots.find(p => !previous.plots.some(old => old.id === p.id));
        if (p) { p.starter = true; step('S1', proof(p.id)); }
    }
    if (command.type === 'open' || command.type === 'open-all') {
        for (const id of previous.unopened) if (command.type === 'open-all' || command.id === id) {
            const p = state.plots.find(p => p.id === id);
            if (!p || !p.cell || p.stage === 0) continue;
            if (p.starter || g.starter.steps.S1?.targetId === id) step('S2', proof(id));
            if (!p.starter && p.townBuilt && p.paid > 0 && p.kind !== 'wild' && p.kind !== 'wonder') {
                step('S5', proof(id)); achieve(state, 'A2', proof(id));
            }
        }
    }
    if (command.type === 'disembark' || command.type === 'open-all') {
        for (const id of previous.arrivals) if (command.type === 'open-all' || command.id === id) {
            const v = state.villagers.find(v => v.id === id);
            if (!v) continue;
            achieve(state, 'A1', proof(id));
            if (v.home === g.starter.steps.S1?.targetId) step('S3', proof(id));
        }
    }
    if (command.type === 'paint' || command.type === 'flag') {
        const id = command.type === 'flag' ? 'flag' : command.target;
        const color = command.color;
        const old = id === 'flag' ? previous.flagColor ?? 0 : previous.plots.find(p => p.id === id)?.roof ?? 0;
        if (color !== undefined && old !== color) achieve(state, 'A3', proof(id));
    }
    if (command.type === 'move') {
        const old = target(previous, command.id), next = target(state, command.id);
        if (old && next && 'cell' in old && 'cell' in next && old.cell && next.cell
            && (old.cell.x !== next.cell.x || old.cell.z !== next.cell.z)) achieve(state, 'A4', proof(command.id));
    }
    if (command.type === 'expand') {
        const expanded = proof(); expanded.snapshot.land = structuredClone(state.land); achieve(state, 'A6', expanded);
    }
    if (command.type === 'concert-started') {
        const band = state.landmarks.find(p => p.id === command.id && p.kind === 'bandstand' && p.cell);
        if (!band) throw new Error('ひろばを もういちど えらんでね。');
        achieve(state, 'A5', proof(band.id));
    }
    if (command.type === 'learning-returned' && g.learning) step('S4', g.learning);
    if (STARTER_STEPS.every(id => g.starter.steps[id])) g.starter.automatic = false;
}
/** Stable suggestions; a selected goal stays selected if its resources later change. */
export function achievementSuggestions(state: GrowingState) {
    const cells = landCells(state);
    const space = cells.some(cell => canPlace(state, cell));
    const homeSpace = cells.some(cell => canReachHomePlacement(state, cell));
    const quote = landQuote(state);
    const normalSeed = Object.entries(SEED_PRICE).some(([kind, price]) => !['wild', 'wonder'].includes(kind)
        && state.unlocked.includes(`seed:${kind}`) && state.drops >= price && (kind === 'home' ? homeSpace : space));
    const hasSeed = state.plots.some(p => !p.starter && p.paid > 0 && !['wild', 'wonder'].includes(p.kind) && p.cell);
    const availability: Record<AchievementId, boolean> = {
        A1: state.arrivals.length > 0 || (state.unlocked.includes('seed:home') && (state.tutorial === 'first-home' || state.drops >= SEED_PRICE.home) && homeSpace),
        A2: hasSeed || normalSeed, A3: true,
        A4: [...state.plots, ...state.landmarks, ...state.keepsakes].some(p => p.cell) && space,
        A5: state.landmarks.some(p => p.kind === 'bandstand' && p.cell)
            || (space && (state.landmarks.some(p => p.kind === 'bandstand')
                || (state.unlocked.includes('landmark:bandstand') && state.drops >= LANDMARK_PRICE.bandstand!))),
        A6: Boolean(quote && state.drops >= quote.price),
    };
    const priceLine = (thing: string, price: number, particle = 'は') => `${thing}${particle} しずく ${price}こ。いまは ${state.drops}こ あるよ`;
    const normalPrices = Object.entries(SEED_PRICE).filter(([kind]) => !['wild', 'wonder'].includes(kind) && state.unlocked.includes(`seed:${kind}`));
    const placeablePrices = normalPrices.filter(([kind]) => kind === 'home' ? homeSpace : space);
    const ordinarySpace = placeablePrices.length > 0;
    const storedStand = state.landmarks.some(p => p.kind === 'bandstand' && !p.cell);
    const reasons: Record<AchievementId, string> = {
        A1: !state.unlocked.includes('seed:home') ? 'すむの たねが えらべるようになったら むかえられるよ'
            : !homeSpace ? 'おうちまで あるける ばしょを あけてみよう' : priceLine('すむの たね', SEED_PRICE.home),
        A2: !normalPrices.length ? 'くらしの たねが えらべるようになったら そだてられるよ'
            : !ordinarySpace ? 'たねを おく ばしょを あけてみよう' : priceLine('くらしの たね', Math.min(...placeablePrices.map(([, price]) => price))),
        A3: '',
        A4: ![...state.plots, ...state.landmarks, ...state.keepsakes].some(p => p.cell)
            ? 'たねや ベンチを おいたら うごかせるよ' : 'うごかす ばしょを あけてみよう',
        A5: !storedStand && !state.unlocked.includes('landmark:bandstand') ? 'ひろばが えらべるようになったら あそべるよ'
            : !space ? 'ひろばを おく ばしょを あけてみよう' : priceLine('おんがくの ひろば', LANDMARK_PRICE.bandstand!),
        A6: quote ? priceLine('しまを ひろげる', quote.price, 'には') : 'いまは この ひろさで あそべるよ',
    };
    return achievementCatalog.filter(item => !state.guidance?.achievements[item.id]).map(item => ({ ...item, available: availability[item.id],
        reason: availability[item.id] ? undefined : reasons[item.id] }))
        .sort((a, b) => Number(b.available) - Number(a.available));
}
