import type { SubjectKey } from '../types';
import { ISLAND_LEARNING_KEEPSAKES, isIslandLearningKeepsakeAvailable, IslandLearningKeepsakeConflict, type IslandLearningKeepsakeId } from './learningKeepsakes';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

export interface IslandLearningKeepsakeSummary {
    keepsakeId: IslandLearningKeepsakeId;
    available: boolean;
    completedSets: number;
    requiredCompletedSets: number;
    completedAt?: number;
    recordScope: 'complete' | 'partial' | 'count-only';
    verifiedCompletedSets: number;
    /** Unique reserved problems in verified completed plans; retries are not problems. */
    problemCount?: number;
    subjects: { subject: SubjectKey; problemCount: number }[];
    examples: { subject: SubjectKey; questionText: string }[];
}
export const learningKeepsakePlanId = (profileId: string, ordinal: number) => JSON.stringify(['island-plan-v1', profileId, ordinal]);
/** At most 25 records. Large milestones use just their actual completion record,
 * not a scan of every preceding section; the summary labels that evidence partial. */
export function learningKeepsakeHistoryOrdinals(completedSets: number, requiredCompletedSets: number): number[] {
    if (requiredCompletedSets > 25) return completedSets >= requiredCompletedSets ? [requiredCompletedSets - 1] : [];
    return Array.from({ length: Math.min(completedSets, requiredCompletedSets) }, (_, ordinal) => ordinal);
}
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function completedPlan(plan: IslandPlan | undefined, profileId: string, id: string): plan is IslandPlan {
    return Boolean(plan && plan.id === id && plan.profileId === profileId && plan.schemaVersion === 1
        && plan.plannerVersion === 'island-learning-v1' && plan.status === 'completed'
        && (plan.subject === 'math' || plan.subject === 'vocab') && Number.isInteger(plan.revision) && plan.revision >= 0
        && time(plan.startedAt) && Array.isArray(plan.slots) && plan.slots.length > 0 && plan.cursor === plan.slots.length
        && plan.slots.every(slot => slot && slot.completed === true && slot.problem && slot.problem.subject === plan.subject
            && typeof slot.problem.id === 'string' && slot.problem.id.length > 0));
}
function completionEvent(event: IslandEvent | undefined, profileId: string, id: string): event is IslandEvent {
    return Boolean(event && event.id === `${id}:completed` && event.profileId === profileId && event.planId === id
        && event.type === 'plan_completed' && time(event.timestamp));
}
/** Reads only a bounded milestone sample. Missing or contradictory history is
 * never replaced by today's date, answer counts, or another person's records. */
export function summarizeIslandLearningKeepsake(island: Pick<IslandRecord, 'profileId' | 'completedSets'>, keepsakeId: IslandLearningKeepsakeId,
    plans: readonly (IslandPlan | undefined)[], events: readonly (IslandEvent | undefined)[]): IslandLearningKeepsakeSummary {
    const item = ISLAND_LEARNING_KEEPSAKES.find(item => item.id === keepsakeId);
    if (!item) throw new IslandLearningKeepsakeConflict('invalid-action', 'きねんの しなを えらびなおしてね');
    if (!Number.isSafeInteger(island.completedSets) || island.completedSets < 0) throw new IslandLearningKeepsakeConflict('invalid-state', 'がくしゅうの きろくを たしかめてね');
    const available = isIslandLearningKeepsakeAvailable(island, keepsakeId);
    let verifiedCompletedSets = 0, detailedPlans = 0, completedAt: number | undefined;
    const seenProblems = new Set<string>(), seenExamples = new Set<string>();
    const counts: Record<SubjectKey, number> = { math: 0, vocab: 0 }, examples: IslandLearningKeepsakeSummary['examples'] = [];
    for (const ordinal of learningKeepsakeHistoryOrdinals(island.completedSets, item.requiredCompletedSets)) {
        const id = learningKeepsakePlanId(island.profileId, ordinal);
        const matchingPlans = plans.filter(plan => plan?.id === id), matchingEvents = events.filter(event => event?.id === `${id}:completed`);
        // Duplicate identical input references do not add credit; conflicting copies supply no evidence.
        const rawPlan = matchingPlans[0], rawEvent = matchingEvents[0];
        const plan = matchingPlans.every(value => JSON.stringify(value) === JSON.stringify(rawPlan)) && completedPlan(rawPlan, island.profileId, id) ? rawPlan : undefined;
        const event = matchingEvents.every(value => JSON.stringify(value) === JSON.stringify(rawEvent)) && completionEvent(rawEvent, island.profileId, id) ? rawEvent : undefined;
        if (plan || event) verifiedCompletedSets++;
        if (plan) {
            detailedPlans++;
            for (const slot of plan.slots) {
                if (seenProblems.has(slot.problem.id)) continue;
                seenProblems.add(slot.problem.id); counts[plan.subject]++;
                const questionText = slot.problem.questionText;
                const key = JSON.stringify([plan.subject, slot.problem.categoryId, questionText]);
                if (typeof questionText === 'string' && questionText.trim() && !seenExamples.has(key) && examples.length < 3) {
                    seenExamples.add(key); examples.push({ subject: plan.subject, questionText });
                }
            }
        }
        if (available && ordinal === item.requiredCompletedSets - 1) {
            const planTime = plan && time(plan.completedAt) && plan.completedAt >= plan.startedAt ? plan.completedAt : undefined;
            // A present but malformed/active/conflicting record is not silently overridden by another source.
            const contradictsPlan = matchingPlans.length > 0 && (!plan || (plan.completedAt !== undefined && planTime === undefined));
            const contradictsEvent = matchingEvents.length > 0 && !event;
            if (!contradictsPlan && !contradictsEvent && !(planTime !== undefined && event && planTime !== event.timestamp)
                && !(plan && event && event.timestamp < plan.startedAt)) completedAt = planTime ?? event?.timestamp;
        }
    }
    return { keepsakeId, available, completedSets: island.completedSets, requiredCompletedSets: item.requiredCompletedSets,
        ...(completedAt === undefined ? {} : { completedAt }),
        recordScope: detailedPlans === item.requiredCompletedSets ? 'complete' : verifiedCompletedSets ? 'partial' : 'count-only',
        verifiedCompletedSets, ...(detailedPlans ? { problemCount: seenProblems.size } : {}),
        subjects: (['math', 'vocab'] as const).filter(subject => counts[subject] > 0).map(subject => ({ subject, problemCount: counts[subject] })), examples };
}
