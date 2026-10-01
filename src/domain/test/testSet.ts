import { Problem, SubjectKey, UserProfile, PeriodicTestSet } from "../types";
import { generateMathProblem } from "../math";
import { generateVocabProblem } from "../english/generator";
import { getSkillsForLevel } from "../math/curriculum";
import { getWordsByLevel } from "../english/words";
import { createSeededRandom } from '../../utils/random';
import { prepareStudyBlockPresentation } from '../math/studyPresentation';
import { getLearningItemMapping } from '../learning/catalog';
import { finishContentKey, isRepresentativeMathContent } from '../finishCoverage';
import { updateProfileAtomically } from "../user/repository";

const SAME_ID_LIMIT = 2;

const getLeastUsedCandidates = (
    candidates: string[],
    blockCounts: Map<string, number>
): string[] => {
    const underSoftLimit = candidates.filter(id => (blockCounts.get(id) || 0) < SAME_ID_LIMIT);
    const pool = underSoftLimit.length > 0 ? underSoftLimit : candidates;
    if (pool.length === 0) return [];

    const minimumCount = Math.min(...pool.map(id => blockCounts.get(id) || 0));
    return pool.filter(id => (blockCounts.get(id) || 0) === minimumCount);
};

export const buildPeriodicTestSet = (
    profile: UserProfile,
    subject: SubjectKey
): PeriodicTestSet => {
    const level = subject === "math" ? (profile.mathMainLevel ?? 1) : (profile.vocabMainLevel ?? 1);
    const blockCounts = new Map<string, number>();
    const problems: Omit<Problem, 'id' | 'subject' | 'isReview'>[] = [];

    const random = createSeededRandom(crypto.randomUUID());

    if (subject === "math") {
        const pool = getSkillsForLevel(level);
        if (!pool.length) throw new Error(`No assessment curriculum for level ${level}`);
        // Every current catalog facet appears; representation variants remain a
        // choice, while borrowing/no-borrowing are both actual content requirements.
        const facets = new Map<string, { id: string; variant: string }>();
        for (const id of pool) {
            const mapping = getLearningItemMapping('math', id);
            for (const variant of mapping?.variants ?? ['default']) {
                const key = `${mapping?.unitId ?? id}/${variant}`;
                if (!facets.has(key)) facets.set(key, { id, variant });
            }
        }
        const mandatory = [...facets.values()];
        const seen = new Map<string, number>();
        for (let i = 0; i < 20; i++) {
            const required = mandatory[i];
            const available = getLeastUsedCandidates(pool, blockCounts);
            const id = required?.id ?? available[Math.floor(random() * available.length)];
            let selected: Omit<Problem, 'id' | 'subject' | 'isReview'> | undefined;
            let selectedUse = Infinity;
            let selectedKey = '';
            for (let attempt = 0; attempt < 80; attempt++) {
                // A finish/confirmation measures the full skill, independent of
                // the learner's adaptive introductory counter.
                const candidate = generateMathProblem(id, { random, preferredLearningVariant: required?.variant });
                if (!isRepresentativeMathContent(id, candidate.questionText)) continue;
                if (required && candidate.learningContext?.variant !== required.variant) continue;
                const key = `${id}:${finishContentKey(candidate)}`;
                const use = seen.get(key) ?? 0;
                if (use < selectedUse) { selected = candidate; selectedUse = use; selectedKey = key; }
                if (use === 0) break;
            }
            if (!selected) throw new Error(`Unable to prepare representative assessment: ${id}`);
            problems.push(selected);
            seen.set(selectedKey, selectedUse + 1);
            blockCounts.set(id, (blockCounts.get(id) ?? 0) + 1);
        }
    } else {
        const pool = getWordsByLevel(level).map(word => word.id);
        if (!pool.length) throw new Error(`No vocabulary assessment curriculum for level ${level}`);
        for (let i = 0; i < 20; i++) {
            const available = getLeastUsedCandidates(pool, blockCounts);
            const id = available[Math.floor(random() * available.length)];
            problems.push(generateVocabProblem(id, { cooldownIds: [], kanjiMode: profile.kanjiMode, random }));
            blockCounts.set(id, (blockCounts.get(id) ?? 0) + 1);
        }
    }
    const frozen = prepareStudyBlockPresentation(problems.map((problem, index) => ({
        ...problem, id: `assessment-${index}`, subject, isReview: false,
    })), profile.hissanModeEnabled ?? true).map(problem => {
        const { id, subject: generatedSubject, isReview, ...content } = problem;
        void id; void generatedSubject; void isReview;
        return content;
    });

    return {
        subject,
        level,
        createdAt: new Date().toISOString(),
        problems: frozen
    };
};

export const ensurePeriodicTestSet = async (
    profile: UserProfile,
    subject: SubjectKey
): Promise<PeriodicTestSet> => {
    const updated = await updateProfileAtomically(profile.id, current => {
        const currentLevel = subject === "math" ? (current.mathMainLevel ?? 1) : (current.vocabMainLevel ?? 1);
        const existing = current.periodicTestSets?.[subject];
        const isPendingAutomaticTest = current.periodicTestState?.[subject]?.isPending === true;
        if (existing?.subject === subject && existing.problems.length === 20
            && (existing.level === currentLevel || isPendingAutomaticTest)) return current;
        return {
            ...current,
            periodicTestSets: { ...current.periodicTestSets, [subject]: buildPeriodicTestSet(current, subject) },
        };
    });
    if (!updated) throw new Error("プロフィールが見つかりません。学習画面を開き直してください。");
    return updated.periodicTestSets![subject]!;
};
