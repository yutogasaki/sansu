import type { Problem, SubjectKey } from '../types';
import { getLearningItemMapping } from './catalog';
import { LEARNING_CATALOG_VERSION } from './types';
import type { LearningEvidenceContext, LearningProblemContext } from './types';

type ContextProblem = Pick<Problem,
    'categoryId' | 'questionText' | 'correctAnswer' | 'inputType' | 'inputConfig' | 'questionVisual' | 'hissanOperands'>;

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        return `{${Object.entries(value).filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => compare(a, b))
            .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
};

const getVariant = (problem: ContextProblem, variants: readonly string[]): string => {
    if (problem.categoryId === 'sub_2d2d') {
        // Classify the actual reserved equation, never the last learner answer.
        const match = problem.questionText?.match(/^\s*(\d{2})\s*[-−]\s*(\d{2})\s*=\s*$/);
        if (!match) return 'unknown';
        const a = Number(match[1]);
        const b = Number(match[2]);
        if (a < 10 || b < 10 || a < b || String(a - b) !== problem.correctAnswer) return 'unknown';
        return a % 10 < b % 10 ? 'regroup' : 'no-regroup';
    }
    return variants.length === 1 ? variants[0] : 'unknown';
};

/** Additive, deterministic metadata. Does not consume RNG, time or profile state. */
export const createLearningProblemContext = (
    subject: SubjectKey,
    problem: ContextProblem,
): LearningProblemContext | undefined => {
    const mapping = getLearningItemMapping(subject, problem.categoryId);
    if (!mapping) return undefined;
    const choices = problem.inputConfig?.choices;
    const problemKey = canonical({
        item: problem.categoryId,
        question: problem.questionText,
        answer: problem.correctAnswer,
        inputType: problem.inputType,
        input: choices ? {
            ...problem.inputConfig,
            // Reordering the same choices is not a different problem.
            choices: [...choices].sort((a, b) => compare(canonical(a), canonical(b))),
        } : problem.inputConfig,
        visual: problem.questionVisual,
        operands: problem.hissanOperands,
    });
    return {
        catalogVersion: LEARNING_CATALOG_VERSION,
        subject,
        itemId: mapping.itemId,
        unitId: mapping.unitId,
        representation: subject === 'math' && problem.inputType === 'hissan' ? 'algorithm' : mapping.representation,
        variant: getVariant(problem, mapping.variants),
        inputType: problem.inputType,
        problemKey,
    };
};

const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/** Unknown/old/mismatched context cannot be upgraded into confirmed evidence. */
export const validateLearningEvidenceContext = (
    value: unknown,
    subject: SubjectKey,
    itemId: string,
): LearningEvidenceContext | undefined => {
    if (!record(value) || value.completion !== 'whole-problem'
        || !['independent', 'assisted', 'unknown'].includes(String(value.assistance))
        || !record(value.problem)) return undefined;
    const problem = value.problem;
    const mapping = getLearningItemMapping(subject, itemId);
    if (!mapping || problem.catalogVersion !== LEARNING_CATALOG_VERSION
        || problem.subject !== subject || problem.itemId !== itemId
        || !['number', 'multi-number', 'choice', 'hissan'].includes(String(problem.inputType))
        || problem.unitId !== mapping.unitId
        || problem.representation !== (subject === 'math' && problem.inputType === 'hissan' ? 'algorithm' : mapping.representation)
        || typeof problem.variant !== 'string'
        || (problem.variant !== 'unknown' && !mapping.variants.includes(problem.variant))
        || typeof problem.problemKey !== 'string' || problem.problemKey.length === 0
        || problem.problemKey.length > 32768) return undefined;
    // Bind metadata to the frozen content. Membership alone would let the same
    // no-borrow equation masquerade as both borrowing variants.
    try {
        const content: unknown = JSON.parse(problem.problemKey);
        if (!record(content) || content.item !== itemId || content.inputType !== problem.inputType
            || (subject === 'vocab' && content.inputType !== 'choice')
            || (content.question !== undefined && typeof content.question !== 'string')
            || !(typeof content.answer === 'string' || (Array.isArray(content.answer)
                && content.answer.every((part) => typeof part === 'string')))) return undefined;
        const rebuilt = createLearningProblemContext(subject, {
            categoryId: itemId,
            questionText: content.question as string | undefined,
            correctAnswer: content.answer as string | string[],
            inputType: content.inputType as Problem['inputType'],
            inputConfig: content.input as Problem['inputConfig'],
            questionVisual: content.visual as Problem['questionVisual'],
            hissanOperands: content.operands as Problem['hissanOperands'],
        });
        if (!rebuilt || rebuilt.problemKey !== problem.problemKey || rebuilt.variant !== problem.variant
            || rebuilt.representation !== problem.representation) return undefined;
    } catch { return undefined; }
    // Copy only known fields so callers cannot retain/mutate arbitrary metadata.
    return {
        completion: 'whole-problem',
        assistance: value.assistance as LearningEvidenceContext['assistance'],
        problem: {
            catalogVersion: LEARNING_CATALOG_VERSION, subject, itemId,
            unitId: mapping.unitId, representation: problem.representation as LearningProblemContext['representation'],
            inputType: problem.inputType as LearningProblemContext['inputType'],
            variant: problem.variant, problemKey: problem.problemKey,
        },
    };
};
