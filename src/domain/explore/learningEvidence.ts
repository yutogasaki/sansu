import { learningEvidenceForProblem } from '../learning/attemptContext';
import { assignmentsMatch } from './learningAssignment';
import type { CommitExploreAttemptInput, ExploreActiveCheckpoint, ExploreLearningAssignment } from './persistenceTypes';

/** Evidence comes from the saved whole numeric problem and the committed gate
 * history, never from an answer caller's metadata or an enriched old plan. */
export function resolveExploreLearningEvidence(
    assignment: ExploreLearningAssignment,
    input: CommitExploreAttemptInput,
    checkpoint: ExploreActiveCheckpoint | undefined,
) {
    if (!assignment.affectsSrs || !assignment.learningEvidenceAssistance || !checkpoint) return undefined;
    const gate = checkpoint.state.pendingProblem;
    const problem = gate?.problem;
    if (!gate || !problem || !gate.learningAssignment
        || !assignmentsMatch(gate.learningAssignment, assignment)
        || gate.gateId !== input.identity.gateId || problem.id !== input.problem.id
        || problem.categoryId !== input.problem.categoryId
        || gate.attemptCount + 1 !== input.identity.attemptNumber
        || problem.inputType !== 'number' || typeof problem.correctAnswer !== 'string') return undefined;
    const independent = assignment.learningEvidenceAssistance === 'independent'
        && gate.attemptCount === 0 && input.identity.attemptNumber === 1
        && !checkpoint.state.attempts.some(attempt => attempt.gateId === gate.gateId);
    return learningEvidenceForProblem(problem, independent ? 'independent' : 'assisted');
}
