import type { Problem } from '../types';
import { createLearningProblemContext } from '../learning/context';
import { generateHissanGrid } from './hissanEngine';
import { isHissanEligible, type HissanGridData } from './hissanTypes';
import { generateWrittenArithmeticGrid } from './writtenArithmetic';

/** The initial display and the new reservation use the same grid decision. */
export function resolveStudyHissanPresentation(problem: Problem | undefined, hissanEnabled: boolean) {
    let gridData: HissanGridData | null = null;
    if (problem?.subject === 'math' && problem.inputType !== 'choice' && problem.questionText
        && (isHissanEligible(problem.categoryId) || ['div_rem_q1', 'div_rem_q2'].includes(problem.categoryId))) {
        const compactDivision = problem.hissanVersion === 3
            || (problem.hissanVersion === undefined && problem.inputType !== 'hissan'
                && problem.questionText.includes('÷'));
        gridData = (/^(mul|div)_/.test(problem.categoryId)
            ? generateWrittenArithmeticGrid(problem.questionText, problem.correctAnswer,
                compactDivision ? { divisionInput: 'compact' } : undefined) : null)
            ?? generateHissanGrid(problem.categoryId, problem.questionText,
                Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join('') : problem.correctAnswer);
    }
    const isForcedHissanSkill = Boolean(gridData)
        && Boolean(problem?.categoryId.includes('_hissan') || problem?.categoryId.includes('_algorithm'));
    const frozen = problem?.studyPresentation?.version === 1
        && typeof problem.studyPresentation.hissan === 'boolean' ? problem.studyPresentation.hissan : undefined;
    return {
        gridData,
        isHissanEligibleSkill: Boolean(gridData),
        isForcedHissanSkill,
        isHissanActive: Boolean(gridData) && (isForcedHissanSkill || (frozen ?? hissanEnabled)),
    };
}

/** Apply only to freshly generated blocks. Saved tests and benchmark problems
 * preserve their exact content and missing provenance. No extra RNG is used. */
export function prepareStudyBlockPresentation(
    problems: Problem[],
    hissanEnabled: boolean,
    preserveReservation = false,
): Problem[] {
    if (preserveReservation) return problems;
    return problems.map(problem => {
        if (problem.subject !== 'math' || problem.studyPresentation) return problem;
        const presentation = resolveStudyHissanPresentation(problem, hissanEnabled);
        const frozen: Problem = {
            ...problem,
            inputType: presentation.isHissanActive ? 'hissan' : problem.inputType,
            studyPresentation: { version: 1, hissan: presentation.isHissanActive },
        };
        if (presentation.isHissanActive && presentation.gridData?.writtenLayout) {
            frozen.hissanVersion = presentation.gridData.writtenLayout.kind === 'division' ? 3 : 2;
        }
        // A missing source context (for example emergency fallback content)
        // stays unknown. New generated context follows the actual initial mode.
        if (problem.learningContext) frozen.learningContext = createLearningProblemContext('math', frozen);
        return frozen;
    });
}

/** A written problem can still use the ordinary input after a visible toggle. */
export const hasStudySingleNumberInput = (problem: Pick<Problem, 'inputType'>): boolean =>
    problem.inputType === 'number' || problem.inputType === 'hissan';
