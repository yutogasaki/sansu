import { kanjiUnitInfo } from './kanji/curriculum';
import { shareKanjiContact } from './kanji/progress';
import { db, type SansuDatabase } from '../../db';
import { itemsForUnit } from './catalog';
import { kokugoUnit } from './curriculum';
import { adoptEditorialPolicy, delayedEligible, emptyProgress, hasExposure, progressId, spacedReviewEligible } from './evaluation';
import { assertKokugoOwner, kokugoTables, writeKokugo } from './storage';
import type { KokugoCompletion, KokugoPlan, KokugoWork } from './types';
export async function chooseKokugo(profileId: string, unitId: string, band: number, preferred = true, d: SansuDatabase = db, selection?: { focusTarget?: string }) {
    kokugoUnit(unitId);
    if (!Number.isInteger(band) || band < 0 || band > 7) throw new Error('学年の めやすを えらんでね。');
    return writeKokugo(profileId, d, async () => {
        const pending = await d.kokugoPlans.where('[profileId+status]').equals([profileId, 'pending']).first();
        const course = await d.kokugoCourses.get(profileId);
        const focusTarget = selection ? selection.focusTarget : pending?.focusTarget ?? (course?.unitId === unitId ? course.focusTarget : undefined);
        if (focusTarget && (!kanjiUnitInfo(unitId) || !itemsForUnit(unitId, focusTarget).length)) throw new Error('この学年の 漢字を えらんでね。');
        if (pending && (pending.unitId !== unitId || pending.focusTarget !== focusTarget)) throw new Error('とちゅうの 3もんを 終えてから えらぼう。');
        await d.kokugoCourses.put({ profileId, unitId, band, preferred, ...(focusTarget ? { focusTarget } : {}) });
    });
}
export async function leaveKokugo(profileId: string, d: SansuDatabase = db) {
    return writeKokugo(profileId, d, async () => {
        const course = await d.kokugoCourses.get(profileId);
        if (course) await d.kokugoCourses.put({ ...course, preferred: false });
    });
}
export async function reserveKokugo(profileId: string, unitId: string, d: SansuDatabase = db, now = Date.now()) {
    kokugoUnit(unitId);
    return writeKokugo(profileId, d, async () => {
        const existing = await d.kokugoPlans.where('[profileId+status]').equals([profileId, 'pending']).first();
        if (existing) return existing;
        const progress = await d.kokugoProgress.where('profileId').equals(profileId).toArray();
        const course = await d.kokugoCourses.get(profileId);
        const focusTarget = course?.unitId === unitId ? course.focusTarget : undefined;
        const candidates = itemsForUnit(unitId, focusTarget).filter(item => item.form !== 'activity');
        if (!candidates.length) throw new Error('作品の ページから はじめよう。');
        const ranked = candidates.map(item => {
            const p = progress.find(p => p.id === progressId(item)) ?? emptyProgress(profileId, item);
            return { item, seen: hasExposure(p, item.exposureGroup), contact: p.lastContactAt ?? -Infinity, rank: spacedReviewEligible(p, now) ? 0 : !hasExposure(p, item.exposureGroup) ? 1 : 2 };
        }).sort((a, b) => a.rank - b.rank || (kanjiUnitInfo(unitId) ? a.contact - b.contact : 0) || Number(a.seen) - Number(b.seen));
        const selected = ranked.slice(0, 3);
        if (kanjiUnitInfo(unitId) && !focusTarget) {
            selected.length = 0;
            // Spread each three-question section across characters without demoting due material.
            for (const rank of [0, 1, 2]) {
                const tier = ranked.filter(row => row.rank === rank);
                for (const row of tier) if (selected.length < 3 && !selected.some(other => other.item.target === row.item.target)) selected.push(row);
                for (const row of tier) if (selected.length < 3 && !selected.includes(row)) selected.push(row);
            }
        }
        const plan: KokugoPlan = {
            id: crypto.randomUUID(), profileId, unitId, version: 'kokugo-v1', status: 'pending',
            ...(focusTarget ? { focusTarget } : {}), createdAt: now, revision: 0, cursor: 0, repeatedPractice: selected.every(row => row.seen), introDone: progress.some(p => p.unitId === unitId && p.introduced),
            slots: selected.map(({ item }) => ({ item: structuredClone(item), support: 'none', draft: '', heard: false })),
        };
        await d.kokugoPlans.add(plan);
        return plan;
    });
}
export async function presentKokugo(profileId: string, planId: string, d: SansuDatabase = db, now = Date.now()) {
    return writeKokugo(profileId, d, async () => {
        const plan = await d.kokugoPlans.get(planId);
        if (!plan || plan.profileId !== profileId || plan.version !== 'kokugo-v1') throw new Error('つづきを ひらきなおしてね。');
        const slot = plan.slots[plan.cursor];
        if (plan.status !== 'pending' || !plan.introDone || slot.presentation) return plan;
        const p = await d.kokugoProgress.get([profileId, progressId(slot.item)]) ?? emptyProgress(profileId, slot.item);
        adoptEditorialPolicy(p);
        const delayed = delayedEligible(p, slot.item, now), reviewEligible = spacedReviewEligible(p, now);
        const novel = !hasExposure(p, slot.item.exposureGroup) && (p.lastContactAt === undefined || now >= p.lastContactAt);
        p.contactRevision += 1;
        p.lastContactAt = Math.max(p.lastContactAt ?? now, now);
        if (!hasExposure(p, slot.item.exposureGroup)) p.seenExposures.push(slot.item.exposureGroup);
        slot.presentation = { at: now, contactRevision: p.contactRevision, delayedEligible: delayed, reviewEligible, novel };
        plan.revision += 1;
        await d.kokugoProgress.put(p);
        await shareKanjiContact(slot.item, profileId, now, d, p);
        await d.kokugoPlans.put(plan);
        await d.kokugoEvents.add({ id: `${plan.id}:present:${plan.cursor}`, profileId, planId, revision: plan.revision,
            at: now, action: 'present', itemId: slot.item.id, delayed });
        return plan;
    });
}
export async function saveKokugoWork(work: KokugoWork, d: SansuDatabase = db) {
    kokugoUnit(work.unitId);
    if (work.text.length > 5000 || !work.id.startsWith(`${work.profileId}:`)) throw new Error('5000字までで 保存してね。');
    return writeKokugo(work.profileId, d, async () => {
        const previous = await d.kokugoWorks.get(work.id);
        const revisions = previous?.revisions ?? (previous?.saved ? [{ text: previous.text, at: previous.updatedAt }] : []);
        if (work.saved && revisions[revisions.length - 1]?.text !== work.text) revisions.push({ text: work.text, at: work.updatedAt });
        await d.kokugoWorks.put({ ...work, revisions });
    });
}
export async function pendingKokugoCompletions(profileId: string, d: SansuDatabase = db) {
    return (await d.kokugoOutbox.where('profileId').equals(profileId).toArray()).filter(row => row.acknowledgedAt === undefined);
}
const proofKeys = ['sourceVersion', 'profileId', 'completionId', 'planId', 'slotIndex', 'completionKind', 'completedAt'] as const;
export async function verifyKokugoCompletion(proof: KokugoCompletion, d: SansuDatabase = db) {
    return d.transaction('r', kokugoTables(d), async () => {
        try { await assertKokugoOwner(proof.profileId, d, false); } catch { return false; }
        const row = await d.kokugoOutbox.get(proof.completionId), plan = await d.kokugoPlans.get(proof.planId);
        if (!row || !plan || plan.version !== 'kokugo-v1' || plan.profileId !== proof.profileId || !proofKeys.every(key => row[key] === proof[key])) return false;
        const slot = plan.slots[proof.slotIndex];
        return !!slot && !slot.skipped && slot.item.form !== 'activity' && slot.completedAt === proof.completedAt
            && slot.completionKind === proof.completionKind && proof.completionId === `kokugo-v1:${proof.profileId}:${proof.planId}:${proof.slotIndex}`;
    });
}
export async function acknowledgeKokugoCompletion(proof: KokugoCompletion, d: SansuDatabase = db) {
    return writeKokugo(proof.profileId, d, async () => {
        if (!await verifyKokugoCompletion(proof, d)) throw new Error('保存を たしかめてね。');
        await d.kokugoOutbox.update(proof.completionId, { acknowledgedAt: Date.now() });
    });
}
