import type { AttemptLog } from '../db';
import type { Problem, SubjectKey, UserProfile } from './types';
import { getLearningItemMapping } from './learning/catalog';
import { validateLearningEvidenceContext } from './learning/context';
import { getSkillsForLevel } from './math/curriculum';
import { getWordsByLevel } from './english/words';

export const FINISH_EVIDENCE_FRESHNESS_MS = 7 * 86400000;
export interface FinishReadiness {
    coverageReady: boolean;
    missingUnitIds: string[];
    coveredCount: number;
    requiredCount: number;
    recentCount: number;
    recentCorrect: number;
    fresh: boolean;
}
export interface FinishReadinessSnapshot extends FinishReadiness {
    version: 1;
    admittedAt: string;
}

/** Carry/borrow curricula contain easier introductory items under the same ID. */
export function isRepresentativeMathContent(itemId: string, question?: string): boolean {
    if (/^add_1d_2(?:_bridge)?$/.test(itemId)) {
        const match = question?.match(/^\s*(\d+)\s*\+\s*(\d+)\s*=\s*$/);
        return Boolean(match && Number(match[1]) + Number(match[2]) >= 10);
    }
    if (/^sub_1d1d_c(?:_bridge)?$/.test(itemId)) {
        const match = question?.match(/^\s*(\d+)\s*[-−]\s*(\d+)\s*=\s*$/);
        return Boolean(match && Number(match[1]) >= 11 && Number(match[1]) % 10 < Number(match[2]));
    }
    return true;
}

/** Distinct mathematical content; cosmetic visuals and answer-choice order do not create new arithmetic evidence. */
export function finishContentKey(problem: Pick<Problem, 'questionText' | 'correctAnswer' | 'questionVisual' | 'inputType' | 'inputConfig'>): string {
    const numeric = /^\s*[\d\s.+×÷*/−\-=()%:]+\s*$/.test(problem.questionText ?? '')
        || typeof problem.correctAnswer === 'string' && /^\d+$/.test(problem.correctAnswer);
    return JSON.stringify({ question: numeric ? problem.questionText?.replace(/\s+/g, '').replace(/−/g, '-') : problem.questionText,
        answer: problem.correctAnswer,
        ...(numeric ? {} : { visual: problem.questionVisual,
            choices: problem.inputConfig?.choices?.map(choice => JSON.stringify(choice)).sort() }) });
}

/** Verified current-range practice only. No inference from legacy booleans or raw successes. */
export function evaluateFinishCoverage(profile: UserProfile, subject: SubjectKey, logs: readonly AttemptLog[], nowIso = new Date().toISOString()): FinishReadiness {
    const main = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const items = subject === 'math' ? getSkillsForLevel(main) : getWordsByLevel(main).map(word => word.id);
    const itemSet = new Set(items);
    const now = Date.parse(nowIso);
    const verified = logs.flatMap(log => {
        const at = Date.parse(log.timestamp);
        const evidence = validateLearningEvidenceContext(log.learningEvidence, subject, log.itemId);
        return log.profileId === profile.id && log.subject === subject && itemSet.has(log.itemId)
            && !log.isReview && Number.isFinite(at) && at <= now && evidence
            && evidence.assistance !== 'unknown' ? [{ log, evidence, at }] : [];
    });
    const recent = verified.filter(item => item.at >= now - FINISH_EVIDENCE_FRESHNESS_MS)
        .sort((a, b) => a.at - b.at || (a.log.id ?? 0) - (b.log.id ?? 0)).slice(-20);
    const independent = verified.filter(({ log, evidence }) => log.result === 'correct' && !log.skipped && evidence.assistance === 'independent');
    const recentCorrect = recent.filter(({ log, evidence }) => log.result === 'correct' && !log.skipped && evidence.assistance === 'independent').length;
    if (subject === 'vocab') {
        const covered = new Set(independent.map(item => item.log.itemId));
        const requiredCount = Math.ceil(items.length * 0.7);
        return { coverageReady: requiredCount > 0 && covered.size >= requiredCount,
            missingUnitIds: items.filter(id => !covered.has(id)), coveredCount: covered.size, requiredCount,
            recentCount: recent.length, recentCorrect, fresh: recent.length === 20 };
    }
    const facets = new Set(items.flatMap(id => {
        const mapping = getLearningItemMapping('math', id);
        return mapping ? mapping.variants.map(variant => `${mapping.unitId}/${variant}`) : [`unmapped:${id}`];
    }));
    const distinct = new Map<string, Map<string, Set<string>>>();
    for (const { log, evidence } of independent) {
        if (evidence.problem.variant === 'unknown') continue;
        const content = JSON.parse(evidence.problem.problemKey);
        if (!isRepresentativeMathContent(log.itemId, content.question)) continue;
        const key = `${evidence.problem.unitId}/${evidence.problem.variant}`;
        const methods = distinct.get(key) ?? new Map<string, Set<string>>();
        const keys = methods.get(evidence.problem.representation) ?? new Set<string>();
        keys.add(finishContentKey({ questionText: content.question, correctAnswer: content.answer,
            inputType: content.inputType, questionVisual: content.visual, inputConfig: content.input }));
        methods.set(evidence.problem.representation, keys);
        distinct.set(key, methods);
    }
    const missingUnitIds = [...facets].filter(facet => ![...(distinct.get(facet)?.values() ?? [])].some(keys => keys.size >= 3));
    return { coverageReady: facets.size > 0 && missingUnitIds.length === 0, missingUnitIds,
        coveredCount: facets.size - missingUnitIds.length, requiredCount: facets.size,
        recentCount: recent.length, recentCorrect, fresh: recent.length === 20 };
}

export function semanticFinishProblemKey(subject: SubjectKey, problem: Pick<Problem, 'categoryId' | 'questionText' | 'correctAnswer' | 'questionVisual' | 'inputType' | 'inputConfig'>): string {
    return `${subject}:${problem.categoryId}:${finishContentKey(problem)}`;
}
export function semanticFinishEvidenceKey(problemKey: string): string | undefined {
    try {
        const content = JSON.parse(problemKey);
        if (typeof content.item !== 'string' || typeof content.inputType !== 'string') return undefined;
        const subject: SubjectKey = content.inputType === 'choice' && getLearningItemMapping('vocab', content.item) ? 'vocab' : 'math';
        return semanticFinishProblemKey(subject, { categoryId: content.item, questionText: content.question,
            correctAnswer: content.answer, inputType: content.inputType, questionVisual: content.visual, inputConfig: content.input });
    } catch { return undefined; }
}
