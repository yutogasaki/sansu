import { db } from '../../db';
import { foundationTables, readFoundationCourse, reserveFoundationPlan } from '../englishFoundation/repository';
import type { FoundationPlan } from '../englishFoundation/types';
import { islandTables, ownedIsland, startIslandPlan } from './repository';
import { selectIslandSubject } from './subjectSelection';
import type { IslandPlan } from './types';

export type IslandLearningEntry = { kind: 'course-choice' } | { kind: 'foundation'; plan: FoundationPlan }
    | { kind: 'island'; plan: IslandPlan };

/** One reservation boundary across both English courses. Saved problems always win. */
export async function resolveIslandLearningEntry(profileId: string, database = db): Promise<IslandLearningEntry> {
    return database.transaction('rw', [...islandTables(database), ...foundationTables(database)], async () => {
        const { island, profile } = await ownedIsland(database, profileId);
        const classic = island.pendingPlanId ? await database.islandPlans.get(island.pendingPlanId) : undefined;
        if (classic?.status === 'active') return { kind: 'island', plan: await startIslandPlan(profileId, database) };
        const foundations = await database.foundationPlans.where('profileId').equals(profileId).toArray();
        const pending = foundations.find(plan => plan.status === 'pending');
        if (pending && profile.subjectMode !== 'math') return { kind: 'foundation', plan: pending };
        // Applying a queued preference and reserving the next problem share this transaction.
        const saved = await readFoundationCourse(profileId, database);
        const preference = saved.pending ?? saved;
        if (profile.subjectMode === 'vocab' && !preference.course) return { kind: 'course-choice' };
        let subject: 'math' | 'vocab' = profile.subjectMode === 'vocab' ? 'vocab' : 'math';
        if (profile.subjectMode === 'mix' && preference.course) {
            const [math, vocab, logs, plans] = await Promise.all([
                database.memoryMath.where('profileId').equals(profileId).toArray(),
                database.memoryVocab.where('profileId').equals(profileId).toArray(),
                database.logs.where('profileId').equals(profileId).toArray(),
                database.islandPlans.where('profileId').equals(profileId).toArray(),
            ]);
            const previousPlans = plans.filter(p => p.status === 'completed').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 2);
            const latestFoundation = foundations.filter(p => p.status === 'completed').sort((a, b) => b.createdAt - a.createdAt)[0];
            const lastClassicAt = previousPlans[0]?.completedAt ?? 0;
            const foundationAt = latestFoundation?.slots[latestFoundation.slots.length - 1]?.completedAt ?? 0;
            // Foundation counts as the English turn without manufacturing vocab logs.
            subject = foundationAt > lastClassicAt ? 'math' : selectIslandSubject({ profile, island, math: Object.values({ ...profile.mathSkills, ...Object.fromEntries(math.map(m => [m.id, m])) }),
                vocab: Object.values({ ...profile.vocabWords, ...Object.fromEntries(vocab.map(m => [m.id, m])) }), logs, previousPlans, now: Date.now() }).subject;
        }
        if (subject === 'vocab' && preference.course === 'foundation') {
            const plan = await reserveFoundationPlan(profileId, database);
            if (!plan) throw new Error('Foundation course changed');
            return { kind: 'foundation', plan };
        }
        // Consume a queued vocabulary course only with its successful reservation.
        const plan = await startIslandPlan(profileId, database, subject);
        if (saved.pending) await database.foundationCourses.put({ profileId, ...saved.pending });
        return { kind: 'island', plan };
    });
}
