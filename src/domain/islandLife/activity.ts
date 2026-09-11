import { LIFE_STEP_MS, type LifeResident, type LifeState } from './model';
import { favorite } from './simulation';

const favoriteLabels = { flower: 'おはな', bench: 'ベンチ', swing: 'ブランコ' } as const;
const favoriteReplies = { flower: 'におい すき', bench: 'ひとやすみ', swing: 'ゆらゆら' } as const;

/** Short, stable copy for the passive resident trait shown beside the island. */
export function residentFavoriteLabel(resident: LifeResident) {
    return favoriteLabels[favorite(resident)];
}

/** A short, favorite-specific line that makes the resident's personality legible during use. */
export function residentFavoriteReply(resident: LifeResident) {
    return favoriteReplies[favorite(resident)];
}

/** Returns the elapsed time inside a favorite-use reaction, or undefined when
 * the resident is still walking, is using another item, or the short window
 * has ended. The renderer uses this same clock for its species-specific pose. */
export function favoriteReactionElapsed(state: LifeState, resident: LifeResident, now: number) {
    const visit = resident.visit, item = state.items.find(i => i.id === visit?.itemId && i.cell);
    if (!visit || !item || item.kind !== favorite(resident)) return;
    const arrived = visit.start + (visit.path.length - 1) * LIFE_STEP_MS + (item.kind === 'flower' ? 400 : 900);
    const elapsed = now - arrived;
    return elapsed >= 0 && elapsed < 2400 ? elapsed : undefined;
}

/** Brief, clock-based expressions. They never award currency or need collecting. */
export function residentReaction(state: LifeState, resident: LifeResident, now: number) {
    const discovered = resident.discovery;
    if (discovered && now >= discovered.at && now < discovered.at + 1600
        && state.items.some(i => i.id === discovered.itemId && i.cell)) {
        const elapsed = now - discovered.at;
        // A notice gets one small, earned bounce; curiosity stays a question
        // mark so it does not look like a completed reaction.
        const hop = discovered.mood === 'notice' && elapsed < 650 ? Math.sin(elapsed / 650 * Math.PI) * .09 : 0;
        return { symbol: discovered.mood === 'notice' ? '!' : '?', label: discovered.mood === 'notice' ? 'あっ、あたらしいもの！' : 'あれは なんだろう？', hop };
    }
    const item = state.items.find(i => i.id === resident.visit?.itemId && i.cell);
    const elapsed = favoriteReactionElapsed(state, resident, now);
    if (!item || elapsed === undefined) return;
    // Two small hops beside a flower; seated residents keep their seat contact.
    const hop = item.kind === 'flower' && elapsed < 1100 ? Math.abs(Math.sin(elapsed / 550 * Math.PI)) * .13 : 0;
    return { symbol: '♪', label: residentFavoriteReply(resident), hop };
}

export function activityPhase(state: LifeState, resident: LifeResident, now: number) {
    const visit = resident.visit, item = state.items.find(i => i.id === visit?.itemId && i.cell);
    if (!visit || !item) return resident.id === 'pokomoko' && state.target ? 'waiting' : 'home';
    const walkEnd = visit.start + (visit.path.length - 1) * LIFE_STEP_MS;
    const settle = item.kind === 'bench' || item.kind === 'swing' ? 900 : 400;
    return now < walkEnd + settle ? 'walking' : item.kind;
}
export function activityLabel(state: LifeState, resident: LifeResident, now: number) {
    const phase = activityPhase(state, resident, now);
    return phase === 'walking' ? 'てくてく むかっている' : phase === 'flower' ? 'おはなの かおりを くんくん'
        : phase === 'swing' ? 'ブランコで ゆらゆら' : phase === 'bench' ? 'すわって ひとやすみ'
        : phase === 'waiting' ? 'あくのを まっている' : 'おうちの そば';
}
