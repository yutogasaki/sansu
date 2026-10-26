import { canonicalKanjiExposure, kana } from './kanji/data';
import { REQUIRED_CONDITIONS } from './curriculum';
import type { KokugoItem, KokugoProgress, KokugoSlot } from './types';
export const hasExposure = (progress: KokugoProgress, group: string) => progress.seenExposures.some(seen => canonicalKanjiExposure(seen) === canonicalKanjiExposure(group));
export const DAY = 86_400_000;
export const progressId = (item: KokugoItem) => `${item.target}:${item.form}:${item.mode}`;
export const emptyProgress = (profileId: string, item: KokugoItem): KokugoProgress => ({
    profileId, id: progressId(item), unitId: item.unitId, target: item.target, form: item.form, mode: item.mode,
    evidencePolicy: 'editorial-2', independentAfter: 0, introduced: false, contactRevision: 0, seenExposures: [], independentItems: [], independentFamilies: [], independentConditions: [], delayedCount: 0, strength: 0,
});
export function grade(item: KokugoItem, answer: string): boolean | null {
    if (item.form === 'activity') return null;
    if (item.form === 'short' && item.version.startsWith('kokugo-kanji-')) return (item.acceptedAnswers ?? [item.answer]).some(value => kana(value) === kana(answer)) ? true : null;
    if (item.form === 'short') return answer.normalize('NFKC').replace(/\s/g, '') === item.answer.normalize('NFKC').replace(/\s/g, '') ? true : null;
    if (item.form === 'order') {
        const parts = answer.split('｜');
        if (parts.length !== item.choices.length || new Set(parts).size !== parts.length || parts.some(part => !item.choices.includes(part))) throw new Error('ことばを ぜんぶ ならべてね。');
    } else if (!item.choices.includes(answer)) throw new Error('こたえを えらんでね。');
    return answer === item.answer;
}
export function spacedReviewEligible(progress: KokugoProgress, now: number) {
    return Number.isFinite(now) && progress.lastContactAt !== undefined && now - progress.lastContactAt >= DAY
        && progress.nextReview !== undefined && now >= progress.nextReview;
}
export function delayedEligible(progress: KokugoProgress, item: KokugoItem, now: number) {
    return spacedReviewEligible(progress, now) && !hasExposure(progress, item.exposureGroup);
}
function unaidedFirstAnswer(slot: KokugoSlot, progress: KokugoProgress, now: number) {
    return slot.support === 'none' && !slot.firstAnswer && !!slot.presentation
        && now >= slot.presentation.at && slot.presentation.contactRevision === progress.contactRevision
        && now >= (progress.independentAfter ?? 0) && (slot.item.mode !== 'listening' || slot.heard);
}
export function independentEligible(slot: KokugoSlot, progress: KokugoProgress, now: number) {
    return unaidedFirstAnswer(slot, progress, now) && !!slot.presentation?.novel;
}
export function retrievalEligible(slot: KokugoSlot, progress: KokugoProgress, now: number) {
    return unaidedFirstAnswer(slot, progress, now) && !!(slot.presentation?.reviewEligible ?? slot.presentation?.delayedEligible);
}
/** Old exposure records do not distinguish teaching from testing. Preserve their facts and gate only new evidence. */
export function adoptEditorialPolicy(progress: KokugoProgress) {
    if (progress.evidencePolicy === 'editorial-2') return;
    if (progress.seenExposures.length && progress.lastContactAt !== undefined)
        progress.independentAfter = Math.max(progress.independentAfter ?? 0, progress.lastContactAt + DAY);
    progress.evidencePolicy = 'editorial-2';
}
export function confirmed(progress: KokugoProgress) { return progress.independentItems.length >= 3 && progress.independentFamilies.length >= 2
    && (REQUIRED_CONDITIONS[progress.unitId] ?? ['基本例']).every(condition => progress.independentConditions.includes(condition)); }
export function recordAnswer(progress: KokugoProgress, slot: KokugoSlot, independent: boolean, now: number, retrieved = false) {
    const delayed = independent && !!slot.presentation?.delayedEligible;
    if (independent && !progress.independentItems.includes(slot.item.id)) {
        progress.independentItems.push(slot.item.id);
        if (!progress.independentConditions.includes(slot.item.condition)) progress.independentConditions.push(slot.item.condition);
        if (!progress.independentFamilies.includes(slot.item.family)) progress.independentFamilies.push(slot.item.family);
    }
    if (delayed) progress.delayedCount += 1;
    if (retrieved && !delayed) progress.familiarReviewCount = (progress.familiarReviewCount ?? 0) + 1;
    if (independent) progress.strength = Math.min(5, progress.strength + 1);
    if (progress.nextReview === undefined) progress.nextReview = now + DAY;
    else if (delayed || retrieved) progress.nextReview = now + [1, 3, 7, 14, 30][Math.min(4, progress.delayedCount + (progress.familiarReviewCount ?? 0))] * DAY;
    progress.contactRevision += 1;
    progress.lastContactAt = Math.max(progress.lastContactAt ?? now, now);
    if (!hasExposure(progress, slot.item.exposureGroup)) progress.seenExposures.push(slot.item.exposureGroup);
    return delayed;
}
