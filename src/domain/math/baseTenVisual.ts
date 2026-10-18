import type { Problem, ProblemVisual } from '../types';

/** Read a frozen legacy reservation without changing its content or learning evidence. */
export function baseTenVisual(problem: Pick<Problem, 'categoryId' | 'questionVisual'>): Extract<ProblemVisual, { kind: 'base-ten-blocks' }> | undefined {
    const visual = problem.questionVisual;
    if (visual?.kind === 'base-ten-blocks') return visual;
    if (problem.categoryId !== 'foundation_expanded' || visual?.kind !== 'item-order' || visual.groups.length !== 3) return undefined;
    if (!visual.groups.every((group, i) => group.label === ['1こが100', '1こが10', '1こが1'][i]
        && Number.isInteger(group.count) && group.count >= 0 && group.count <= (i === 0 ? 4 : 9))) return undefined;
    const [h, t, o] = visual.groups;
    return { kind: 'base-ten-blocks', prompt: visual.prompt, groups: [{ label: '', blocks: { hundreds: h.count, tens: t.count, ones: o.count } }] };
}
