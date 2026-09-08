import type { AttemptLog } from '../../db';
import { parseISO } from 'date-fns';
import { getLearningDayStart } from '../../utils/learningDay';
import { getEligibleVocabWords } from '../english/selection';
import { getSkillsForLevel, isMathSkillUnlockedForProfile } from '../math/curriculum';
import { parkLearningHistory } from '../park/learningHistory';
import { isNormalReviewEligible } from '../learning/reviewPolicy';
import type { MemoryState, SubjectKey, UserProfile } from '../types';
import { getIslandMathRemediationSkillIds } from './learningChecks';
import type { IslandPlan, IslandRecord } from './types';

interface Options {
    profile: UserProfile;
    island: IslandRecord;
    math: MemoryState[];
    vocab: MemoryState[];
    logs: AttemptLog[];
    /** Newest first, restricted by the repository to this profile's last two reservations. */
    previousPlans: (IslandPlan | undefined)[];
    now: number;
}

function subjectNeeds(options: Options, subject: SubjectKey) {
    const { profile, island, logs, now } = options;
    const memory = subject === 'math' ? options.math : options.vocab;
    const history = parkLearningHistory(subject, memory, logs, now);
    const skipped = new Set(history.skipped);
    const vocab = subject === 'vocab' ? getEligibleVocabWords(profile, history.skipped) : [];
    const vocabIds = new Set(vocab.map(word => word.id));
    const allowed = (id: string) => !skipped.has(id) && (subject === 'math'
        ? isMathSkillUnlockedForProfile(id, profile) : vocabIds.has(id));
    const active = (id: string) => subject !== 'math'
        || !['maintenance', 'retired'].includes(memory.find(state => state.id === id)?.status ?? 'active');
    const main = subject === 'math' ? getSkillsForLevel(profile.mathMainLevel).filter(allowed)
        : vocab.filter(word => word.level === profile.vocabMainLevel).map(word => word.id);
    const due = new Set(history.due.filter(allowed));
    if (subject === 'math') getIslandMathRemediationSkillIds(island.pendingMathChecks, profile)
        .filter(id => allowed(id) && isNormalReviewEligible(memory.find(state => state.id === id) ?? {})).forEach(id => due.add(id));
    const deadlines = memory.filter(state => due.has(state.id)).map(state => parseISO(state.nextReview).getTime()).filter(Number.isFinite);
    return { main: main.filter(active), available: main.length > 0, dueCount: due.size,
        oldest: deadlines.length ? Math.min(...deadlines) : Number.POSITIVE_INFINITY, memory };
}

/** Scheduling is not mastery: no SRS state or completed reservation is changed here. */
export function selectIslandSubject(options: Options): { subject: SubjectKey; practiceItemIds: string[] } {
    const { profile, island, previousPlans, now } = options;
    if (profile.subjectMode !== 'mix') return { subject: profile.subjectMode, practiceItemIds: [] };
    const needs = { math: subjectNeeds(options, 'math'), vocab: subjectNeeds(options, 'vocab') };
    const dayStart = getLearningDayStart(new Date(now)).getTime();
    const currentDayPlan = (plan: IslandPlan | undefined) => plan?.profileId === profile.id
        && plan.status === 'completed' && (plan.completedAt ?? 0) >= dayStart && (plan.completedAt ?? 0) <= now ? plan : undefined;
    const previous = currentDayPlan(previousPlans[0]);
    const beforePrevious = currentDayPlan(previousPlans[1]);
    const practiceItemIds = previous ? [...new Set(previous.introducedItemIds ?? [])].filter(id => {
        const need = needs[previous.subject];
        const successes = need.memory.find(state => state.id === id)?.independentCorrectAnswers;
        return need.main.includes(id) && typeof successes === 'number' && successes > 0 && successes < 3
            && previous.slots.some(slot => slot.problem.categoryId === id && slot.completed
                && !slot.assisted && slot.learningEvidenceAssistance === 'independent');
    }) : [];
    const result = (subject: SubjectKey) => ({ subject, practiceItemIds: previous?.subject === subject ? practiceItemIds : [] });
    if (!needs.math.available && !needs.vocab.available) throw new Error('No learning subject available');
    if (!needs.math.available) return result('vocab');
    if (!needs.vocab.available) return result('math');
    // A request belongs to the exact completed plan, even across the learning-day boundary.
    const choice = island.nextSubjectChoice;
    const last = previousPlans[0];
    if (choice && last?.profileId === profile.id && last.status === 'completed'
        && choice.afterPlanId === last.id && choice.subject === last.subject) return result(choice.subject);
    if (previous && beforePrevious?.subject === previous.subject) return result(previous.subject === 'math' ? 'vocab' : 'math');
    if (previous && practiceItemIds.length) return result(previous.subject);
    if (needs.math.dueCount !== needs.vocab.dueCount) return result(needs.math.dueCount > needs.vocab.dueCount ? 'math' : 'vocab');
    if (needs.math.oldest !== needs.vocab.oldest) return result(needs.math.oldest < needs.vocab.oldest ? 'math' : 'vocab');
    return result(previous?.subject === 'math' ? 'vocab' : 'math');
}
