import type { Problem, ProblemVisualItem } from '../../domain/types';

/** Only the explicit option grid can move to the answer buttons; task examples stay in the prompt. */
export function islandReferenceChoices(problem: Problem): ProblemVisualItem[] | undefined {
    const visual = problem.questionVisual;
    const choices = problem.inputConfig?.choices;
    if (problem.subject !== 'math' || problem.inputType !== 'choice' || visual?.kind !== 'reference-choice-grid'
        || !choices?.length || choices.length !== visual.grid.choices.length) return;

    const normalize = (label: string) => label.trim().replace(/\s+/gu, ' ');
    const matches = choices.every((choice, index) => {
        const item = visual.grid.choices[index];
        return [item.emoji, item.label, `${item.emoji} ${item.label}`].some(label => normalize(choice.label) === normalize(label));
    });
    // Older or unfamiliar saved questions retain their complete shared presentation.
    return matches ? visual.grid.choices : undefined;
}
