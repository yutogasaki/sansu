import { shareKanjiContact } from './kanji/progress';
import { db, type SansuDatabase } from '../../db';
import { DAY, adoptEditorialPolicy, emptyProgress, grade, independentEligible, progressId, recordAnswer, retrievalEligible } from './evaluation';
import { writeKokugo } from './storage';
import type { KokugoAction, KokugoEvent } from './types';
export async function actKokugo(input: KokugoAction, d: SansuDatabase = db, now = Date.now()) {
    return writeKokugo(input.profileId, d, async () => {
        const plan = await d.kokugoPlans.get(input.planId);
        if (!plan || plan.profileId !== input.profileId || plan.version !== 'kokugo-v1') throw new Error('つづきを ひらきなおしてね。');
        const key = `${plan.id}:action:${input.revision}`;
        const previous = await d.kokugoEvents.get(key);
        if (previous) {
            if (previous.action !== input.action || previous.answer !== input.answer) throw new Error('つづきを ひらきなおしてね。');
            return plan;
        }
        if (plan.revision !== input.revision || plan.status !== 'pending' || !Number.isFinite(now)) throw new Error('つづきを ひらきなおしてね。');
        const slot = plan.slots[plan.cursor];
        const p = await d.kokugoProgress.get([input.profileId, progressId(slot.item)]) ?? emptyProgress(input.profileId, slot.item);
        adoptEditorialPolicy(p);
        const event: KokugoEvent = { id: key, profileId: input.profileId, planId: plan.id, revision: input.revision,
            at: now, action: input.action, itemId: slot.item.id, ...(input.answer !== undefined ? { answer: input.answer } : {}) };
        if (input.action === 'intro') {
            if (plan.introDone) throw new Error('つづきを ひらきなおしてね。');
            plan.introDone = true;
            for (const next of plan.slots) {
                const progress = await d.kokugoProgress.get([input.profileId, progressId(next.item)]) ?? emptyProgress(input.profileId, next.item);
                progress.introduced = true;
                progress.contactRevision += 1;
                progress.lastContactAt = Math.max(progress.lastContactAt ?? now, now);
                await d.kokugoProgress.put(progress);
            }
        } else {
            if (!plan.introDone || !slot.presentation) throw new Error('もんだいを ひらきなおしてね。');
            if (input.action === 'next') {
                if (!slot.completedAt && !slot.skipped) throw new Error('こたえを たしかめてから すすもう。');
                plan.cursor += 1;
                if (plan.cursor === plan.slots.length) plan.status = 'completed';
            } else {
                if (slot.completedAt || slot.skipped) throw new Error('つぎの もんだいへ すすもう。');
                if (input.action === 'heard') {
                    if (slot.item.mode !== 'listening') throw new Error('この もんだいは 音を 使わないよ。');
                    slot.heard = true;
                } else if (input.action === 'draft') slot.draft = (input.answer ?? '').slice(0, 5000);
                else if (input.action === 'skip') slot.skipped = true;
                else if (input.action === 'hint' || input.action === 'model') {
                    if (slot.support !== 'model') slot.support = input.action;
                    p.contactRevision += 1;
                    p.lastContactAt = Math.max(p.lastContactAt ?? now, now);
                } else if (input.action === 'complete-supported') {
                    if (slot.support !== 'model') throw new Error('おてほんを 見てから おわろう。');
                    slot.completedAt = now;
                    slot.completionKind = 'assisted';
                    recordAnswer(p, slot, false, now);
                } else if (input.action === 'answer') {
                    if (slot.item.mode === 'listening' && !slot.heard) throw new Error('音を きいてから えらぼう。');
                    const result = grade(slot.item, input.answer ?? '');
                    const independent = result === true && independentEligible(slot, p, now);
                    const retrieved = result === true && retrievalEligible(slot, p, now);
                    if (result !== null) event.correct = result;
                    else event.unscorable = true;
                    event.independent = independent;
                    slot.firstAnswer ??= { answer: input.answer!, correct: result, at: now };
                    if (result) {
                        slot.completedAt = now;
                        slot.completionKind = independent ? 'independent' : 'assisted';
                        if (retrieved) { slot.retrieved = independent && slot.presentation?.delayedEligible ? 'new-context' : 'familiar'; event.retrieved = slot.retrieved; }
                        event.delayed = recordAnswer(p, slot, independent, now, retrieved);
                    } else {
                        if (result === null) slot.support = 'model';
                        else if (slot.support === 'none') slot.support = 'hint';
                        p.contactRevision += 1;
                        p.lastContactAt = Math.max(p.lastContactAt ?? now, now);
                    }
                }
                if (slot.completedAt) {
                    const completionId = `kokugo-v1:${input.profileId}:${plan.id}:${plan.cursor}`;
                    await d.kokugoOutbox.add({ sourceVersion: 'kokugo-v1', profileId: input.profileId, completionId,
                        planId: plan.id, slotIndex: plan.cursor, completionKind: slot.completionKind!, completedAt: slot.completedAt });
                }
                const taught = input.action === 'hint' || input.action === 'model' || input.action === 'complete-supported' || (input.action === 'answer' && slot.support !== 'none');
                if (taught) p.independentAfter = Math.max(p.independentAfter ?? 0, now + DAY);
                await d.kokugoProgress.put(p);
                if (['answer', 'hint', 'model', 'complete-supported'].includes(input.action)) await shareKanjiContact(slot.item, input.profileId, now, d, p, taught);
            }
        }
        plan.revision += 1;
        await d.kokugoEvents.add(event);
        await d.kokugoPlans.put(plan);
        return plan;
    });
}
