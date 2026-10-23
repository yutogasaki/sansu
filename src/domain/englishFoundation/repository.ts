import { db, type SansuDatabase } from '../../db';
import { FOUNDATION_UNITS, makeFoundationSlots } from './catalog';
import type { FoundationAction, FoundationCompletion, FoundationCourse, FoundationCourseRecord, FoundationEvent, FoundationPlan, FoundationProgress, FoundationTarget, FoundationUnit } from './types';
export type { FoundationCompletion } from './types';
const DAY = 86_400_000;
const intervals = [1, 3, 7, 14, 30];
export const foundationTables = (d: SansuDatabase) => [d.profiles, d.appData, d.islands, d.islandPlans, d.foundationCourses, d.foundationOwners, d.foundationProgress, d.foundationPlans, d.foundationEvents, d.foundationOutbox];
const progressId = (target: FoundationTarget, form: string) => `${target}:${form}`;
const formsFor = (target: FoundationTarget) => ['A', 'B', 'C'].includes(target) ? ['shape', 'letter-name'] as const : ['word-listening'] as const;
const stamp = (now: number) => { if (!Number.isFinite(now) || now <= 0) throw new Error('Invalid foundation clock'); return now; };
export async function readFoundationOwnerAvailable(profileId: string, d = db): Promise<boolean> {
    return !!await d.profiles.get(profileId) && (await d.foundationOwners.get(profileId))?.status !== 'deleting';
}
async function assertOwner(profileId: string, d: SansuDatabase) {
    if (!await readFoundationOwnerAvailable(profileId, d)) throw new Error('Foundation owner unavailable');
    const app = await d.appData.get('app');
    if (!app || app.activeProfileId !== profileId || !app.profiles[profileId]) throw new Error('Foundation profile changed');
}
async function progress(profileId: string, target: FoundationTarget, form: FoundationProgress['form'], d: SansuDatabase): Promise<FoundationProgress> {
    return await d.foundationProgress.get([profileId, progressId(target, form)]) ?? { profileId, id: progressId(target, form), target, form, introduced: false, contactRevision: 0, strength: 0, independentCount: 0, delayedCount: 0 };
}
async function expose(profileId: string, target: FoundationTarget, now: number, d: SansuDatabase, presentationId?: string) {
    for (const form of formsFor(target)) {
        const p = await progress(profileId, target, form, d);
        await d.foundationProgress.put({ ...p, introduced: true, contactRevision: p.contactRevision + 1, lastContactAt: now, lastPresentationId: presentationId });
    }
}
async function readPlan(profileId: string, planId: string, revision: number | undefined, d: SansuDatabase) {
    await assertOwner(profileId, d);
    const p = await d.foundationPlans.get(planId);
    if (!p || p.sourceVersion !== 'english-foundation-v1' || p.catalogVersion !== 'foundation-v1' || p.profileId !== profileId || (revision !== undefined && p.revision !== revision)) throw new Error('Foundation reservation changed');
    return p;
}
export async function readFoundationCourse(profileId: string, d = db): Promise<FoundationCourseRecord> {
    return await d.foundationCourses.get(profileId) ?? { profileId, course: 'vocabulary', unit: 'F01' };
}
async function pending(profileId: string, d: SansuDatabase) {
    return (await d.foundationPlans.where('[profileId+status]').equals([profileId, 'pending']).toArray())[0];
}
export async function setFoundationCourse(profileId: string, course: FoundationCourse, unit: FoundationUnit = 'F01', d = db) {
    return d.transaction('rw', foundationTables(d), async () => {
        await assertOwner(profileId, d);
        const previous = await readFoundationCourse(profileId, d);
        const island = await d.islands.get(profileId);
        const legacy = island?.pendingPlanId ? await d.islandPlans.get(island.pendingPlanId) : undefined;
        const queued = !!await pending(profileId, d) || legacy?.status === 'active';
        const next: FoundationCourseRecord = queued ? { ...previous, pending: { course, unit } } : { profileId, course, unit };
        await d.foundationCourses.put(next);
        return next;
    });
}
/** Explicitly initialize a new profile without inferring English proficiency. */
export async function initializeFoundationCourse(profileId: string, d = db) {
    await d.transaction('rw', foundationTables(d), async () => {
        await assertOwner(profileId, d);
        if (!await d.foundationCourses.get(profileId)) await d.foundationCourses.put({ profileId, unit: 'F01' });
    });
}
export async function reserveFoundationPlan(profileId: string, d = db, now = Date.now()): Promise<FoundationPlan | null> {
    stamp(now);
    return d.transaction('rw', foundationTables(d), async () => {
        await assertOwner(profileId, d);
        const existing = await pending(profileId, d);
        if (existing) return existing;
        if ((await d.profiles.get(profileId))?.subjectMode === 'math') return null;
        const island = await d.islands.get(profileId);
        if (island?.pendingPlanId && (await d.islandPlans.get(island.pendingPlanId))?.status === 'active') return null;
        const previous = await readFoundationCourse(profileId, d);
        const preference: FoundationCourseRecord = previous.pending ? { profileId, ...previous.pending } : previous;
        if (preference.course !== 'foundation') {
            if (previous.pending) await d.foundationCourses.put(preference);
            return null;
        }
        const count = await d.foundationPlans.where('profileId').equals(profileId).count();
        const targets = FOUNDATION_UNITS.find(u => u.id === preference.unit)!.targets;
        const introduced = await Promise.all(targets.map(t => progress(profileId, t, formsFor(t)[0], d)));
        const introTargets = targets.filter((_, i) => !introduced[i].introduced);
        const plan: FoundationPlan = { id: crypto.randomUUID(), profileId, unit: preference.unit, sourceVersion: 'english-foundation-v1', catalogVersion: 'foundation-v1', status: 'pending', revision: 0, cursor: 0, introDone: introTargets.length === 0, introTargets, createdAt: now, slots: makeFoundationSlots(preference.unit, count) };
        await d.foundationCourses.put(preference);
        await d.foundationPlans.add(plan);
        return plan;
    });
}
export async function recordFoundationExposure(profileId: string, targets: FoundationTarget[], kind: 'introduction' | 'replay' | 'model', d = db, now = Date.now(), presentationId?: string) {
    stamp(now);
    await d.transaction('rw', foundationTables(d), async () => {
        await assertOwner(profileId, d);
        for (const target of [...new Set(targets)]) {
            if (!FOUNDATION_UNITS.some(u => u.targets.includes(target))) throw new Error('Unknown foundation target');
            // Prompt replay belongs to the same presentation and is required input, not assistance.
            const prior = await progress(profileId, target, formsFor(target)[0], d);
            if (presentationId && prior.lastPresentationId === presentationId) {
                for (const form of formsFor(target)) { const current = await progress(profileId, target, form, d);
                    await d.foundationProgress.put({ ...current, lastContactAt: Math.max(current.lastContactAt ?? now, now) }); }
            } else await expose(profileId, target, now, d, presentationId);
            await d.foundationEvents.add({ id: crypto.randomUUID(), profileId, target, type: kind, at: now });
        }
    });
}
export async function finishFoundationIntroduction(profileId: string, planId: string, revision?: number, d = db, now = Date.now()) {
    return d.transaction('rw', foundationTables(d), async () => {
        stamp(now);
        const plan = await readPlan(profileId, planId, revision, d);
        if (plan.introDone) return plan;
        for (const target of plan.introTargets) {
            await expose(profileId, target, now, d);
            await d.foundationEvents.add({ id: crypto.randomUUID(), profileId, planId, target, type: 'introduction', at: now });
        }
        plan.introDone = true;
        plan.revision++;
        await d.foundationPlans.put(plan);
        return plan;
    });
}
export async function presentFoundationSlot(profileId: string, planId: string, d = db, now = Date.now()): Promise<FoundationPlan> {
    return d.transaction('rw', foundationTables(d), async () => {
        stamp(now);
        const plan = await readPlan(profileId, planId, undefined, d);
        if (!plan.introDone || plan.status !== 'pending') return plan;
        const slot = plan.slots[plan.cursor];
        if (slot.presentation) return plan;
        const prior = await progress(profileId, slot.target, slot.form, d);
        const id = crypto.randomUUID();
        const validTime = prior.lastContactAt !== undefined && now >= prior.lastContactAt;
        const delayedEligible = validTime && now - prior.lastContactAt! >= DAY && prior.nextReview !== undefined && now >= prior.nextReview;
        slot.presentation = { id, at: now, contactRevision: prior.contactRevision + 1, delayedEligible, timing: validTime ? 'known' : 'unknown' };
        for (const target of slot.choices) await expose(profileId, target, now, d, id);
        await d.foundationEvents.add({ id, profileId, planId, slotIndex: slot.index, target: slot.target, type: 'presentation', at: now });
        plan.revision++;
        await d.foundationPlans.put(plan);
        return plan;
    });
}
export async function commitFoundationAction(input: FoundationAction, d = db, now = Date.now()): Promise<{ plan: FoundationPlan; completion?: FoundationCompletion }> {
    return d.transaction('rw', foundationTables(d), async () => {
        stamp(now);
        if (!['answer', 'hint', 'model', 'supported_completed', 'alternative'].includes(input.action)) throw new Error('Invalid foundation action');
        const plan = await readPlan(input.profileId, input.planId, undefined, d);
        if (plan.revision !== input.revision) {
            const prior = await d.foundationEvents.get(`${plan.id}:${input.revision}`);
            if (!prior || prior.type !== input.action || prior.answer !== input.answer) throw new Error('Foundation reservation changed');
            const oldSlot = plan.slots[prior.slotIndex!];
            const completion = oldSlot.completedAt && (prior.type === 'supported_completed' || prior.correct) ? await d.foundationOutbox.get(`english-foundation-v1:${plan.profileId}:${plan.id}:${oldSlot.index}`) : undefined;
            return { plan, completion };
        }
        if (plan.status !== 'pending' || !plan.introDone) throw new Error('Foundation reservation not answerable');
        const slot = plan.slots[plan.cursor];
        if (!slot.presentation) throw new Error('Foundation stimulus not presented');
        const p = await progress(input.profileId, slot.target, slot.form, d);
        const event: FoundationEvent = { id: `${plan.id}:${plan.revision}`, profileId: input.profileId, planId: plan.id, slotIndex: slot.index, type: input.action, at: now, target: slot.target };
        let complete = false;
        if (input.action === 'answer') {
            if (!input.answer || !slot.choices.includes(input.answer)) throw new Error('Invalid foundation choice');
            const correct = input.answer === slot.target;
            event.answer = input.answer;
            event.correct = correct;
            slot.firstAnswer ??= { answer: input.answer, correct, at: now };
            if (!correct) slot.support = slot.support === 'model' ? 'model' : 'hint';
            complete = correct;
        } else if (input.action === 'hint') slot.support = slot.support === 'model' ? 'model' : 'hint';
        else if (input.action === 'alternative') slot.support = slot.support === 'model' ? 'model' : 'hint';
        else if (input.action === 'model') {
            if (slot.support === 'none') throw new Error('Foundation hint required before model');
            slot.support = 'model';
            await expose(input.profileId, slot.target, now, d, slot.presentation.id);
        } else {
            if (slot.support !== 'model') throw new Error('Foundation model required before completion');
            complete = true;
        }
        let completion: FoundationCompletion | undefined;
        if (complete) {
            const independent = now >= slot.presentation.at && slot.support === 'none' && slot.firstAnswer?.correct === true && p.contactRevision === slot.presentation.contactRevision && p.lastPresentationId === slot.presentation.id;
            slot.completionKind = independent ? 'independent' : 'assisted';
            slot.completedAt = now;
            const delayed = independent && slot.presentation.delayedEligible && now >= slot.presentation.at && now - slot.presentation.at < DAY;
            event.delayed = delayed;
            // Early practice and supported completion never postpone an existing Due.
            if (independent) {
                p.independentCount++;
                if (p.strength === 0) { p.strength = 1; p.nextReview = now + DAY; }
                else if (delayed) { p.strength = Math.min(5, p.strength + 1); p.nextReview = now + intervals[p.strength - 1] * DAY; }
                if (delayed) p.delayedCount++;
            }
            p.lastContactAt = Math.max(p.lastContactAt ?? now, now);
            await d.foundationProgress.put(p);
            completion = { sourceVersion: plan.sourceVersion, profileId: plan.profileId, completionId: `english-foundation-v1:${plan.profileId}:${plan.id}:${slot.index}`, planId: plan.id, slotIndex: slot.index, completionKind: slot.completionKind, completedAt: now };
            await d.foundationOutbox.add(completion);
            plan.cursor++;
            if (plan.cursor === plan.slots.length) plan.status = 'completed';
        }
        await d.foundationEvents.add(event);
        plan.revision++;
        await d.foundationPlans.put(plan);
        return { plan, completion };
    });
}
export async function pendingFoundationCompletions(profileId: string, d = db): Promise<FoundationCompletion[]> {
    if (!await readFoundationOwnerAvailable(profileId, d)) return [];
    return (await d.foundationOutbox.where('profileId').equals(profileId).toArray()).filter(row => !row.acknowledgedAt).map(row => ({ sourceVersion: row.sourceVersion, profileId: row.profileId, completionId: row.completionId, planId: row.planId, slotIndex: row.slotIndex, completionKind: row.completionKind, completedAt: row.completedAt }));
}
export async function verifyFoundationCompletion(receipt: FoundationCompletion, d = db): Promise<boolean> {
    return d.transaction('r', [d.profiles, d.foundationOwners, d.foundationPlans, d.foundationOutbox], async () => {
        if (!await readFoundationOwnerAvailable(receipt.profileId, d)) return false;
        const row = await d.foundationOutbox.get(receipt.completionId);
        const plan = await d.foundationPlans.get(receipt.planId);
        const slot = plan?.slots[receipt.slotIndex];
        return !!row && !!slot && plan?.profileId === receipt.profileId && receipt.sourceVersion === 'english-foundation-v1' && slot.completedAt === receipt.completedAt && slot.completionKind === receipt.completionKind && (['sourceVersion', 'profileId', 'completionId', 'planId', 'slotIndex', 'completionKind', 'completedAt'] as const).every(key => row[key] === receipt[key]);
    });
}
export async function acknowledgeFoundationCompletion(receipt: FoundationCompletion, d = db) {
    await d.transaction('rw', [d.profiles, d.foundationOwners, d.foundationPlans, d.foundationOutbox], async () => {
        if (!await verifyFoundationCompletion(receipt, d)) throw new Error('Foundation receipt unavailable');
        await d.foundationOutbox.update(receipt.completionId, { acknowledgedAt: Date.now() });
    });
}
export async function beginFoundationOwnerDeletion(profileId: string, d = db) {
    await d.foundationOwners.put({ profileId, status: 'deleting', updatedAt: Date.now() });
}
