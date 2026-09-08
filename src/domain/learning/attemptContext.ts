import type { Problem } from '../types';
import type { LearningEvidenceBarrier, LearningEvidenceContext } from './types';
import { createLearningProblemContext, validateLearningEvidenceContext } from './context';

type EvidenceProblem = Pick<Problem, 'learningContext' | 'subject' | 'categoryId' | 'questionText'
    | 'correctAnswer' | 'inputType' | 'inputConfig' | 'questionVisual' | 'hissanOperands'>;
const contextFields = ['catalogVersion', 'subject', 'itemId', 'unitId', 'representation', 'variant', 'inputType', 'problemKey'] as const;

/** A producer must know both the full-problem scope and the support history. */
export function learningEvidenceForProblem(
    problem: EvidenceProblem,
    assistance: LearningEvidenceContext['assistance'],
    wholeProblem: boolean = true,
): LearningEvidenceContext | undefined {
    if (!wholeProblem || !problem.learningContext) return undefined;
    // A valid catalog envelope can still belong to a different equation or
    // presentation. Compare against this saved problem without enriching it.
    try {
        const expected = createLearningProblemContext(problem.subject, problem);
        if (!expected || contextFields.some(field => expected[field] !== problem.learningContext![field])) return undefined;
    } catch { return undefined; }
    return validateLearningEvidenceContext(
        { problem: problem.learningContext, assistance, completion: 'whole-problem' },
        problem.subject, problem.categoryId,
    );
}

export function learningBarrierForProblem(
    problem: EvidenceProblem,
    reason: LearningEvidenceBarrier['reason'],
): LearningEvidenceBarrier | undefined {
    const evidence = learningEvidenceForProblem(problem, 'assisted');
    return evidence ? { problem: evidence.problem, reason } : undefined;
}

/** Study can switch presentation after generation; never attribute that to the reserved mode. */
export function studyLearningEvidence(
    problem: EvidenceProblem,
    assistance: LearningEvidenceContext['assistance'],
    hissanActive: boolean,
    representationChanged: boolean,
): LearningEvidenceContext | undefined {
    if (representationChanged || (hissanActive !== (problem.learningContext?.representation === 'algorithm'))) return undefined;
    return learningEvidenceForProblem(problem, assistance);
}
