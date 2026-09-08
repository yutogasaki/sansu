import { MATH_ITEM_MAPPINGS, MATH_LV11_UNIT_IDS } from './mathCatalog';
import { getMathUnitRequiredVariants, MATH_PILOT_POLICY } from './evidence';
import type { evaluateMathLevel11Pilot, MathUnitPilotEvaluation } from './evidence';
import type { LearningRepresentation } from './types';
import { isHissanEligible } from '../math/hissanTypes';

export type MathUnitPracticePriority = 'recheck' | 'due' | 'unconfirmed' | 'practice';
export const MATH_UNIT_PRACTICE_ORDER: Record<MathUnitPracticePriority, number> = {
    recheck: 0, due: 1, unconfirmed: 2, practice: 3,
};

export interface MathUnitPracticeTarget {
    unitId: string;
    itemIds: string[];
    representation: LearningRepresentation;
    variant: string;
    priority: MathUnitPracticePriority;
    nextCheckAt: string | null;
}

export interface MathUnitPracticePreference {
    unitId: string;
    itemIds: string[];
    preferredItemIds: string[];
    priority: MathUnitPracticePriority;
    preferredVariants: string[];
    requiredVariants: readonly string[];
    targets: MathUnitPracticeTarget[];
}

/** Keep the method with the strongest existing coverage; do not require every method. */
function unitPreference(unit: MathUnitPilotEvaluation, asOf: number): MathUnitPracticePreference {
    const mappings = MATH_ITEM_MAPPINGS.filter(mapping => mapping.unitId === unit.unitId);
    const requiredVariants = getMathUnitRequiredVariants(unit.unitId);
    const convertibleItems = mappings.filter(mapping => mapping.representation === 'symbol' && isHissanEligible(mapping.itemId));
    const methods = (['symbol', 'algorithm'] as const).filter(method => mappings.some(mapping => mapping.representation === method)
        || (method === 'algorithm' && convertibleItems.length > 0 && unit.facets.some(facet => facet.representation === method)));
    const score = (method: LearningRepresentation) => requiredVariants.reduce((sum, variant) => {
        const facet = unit.facets.find(candidate => candidate.representation === method && candidate.variant === variant);
        return sum + Math.min(facet?.independentProblemCount ?? 0, MATH_PILOT_POLICY.distinctIndependentProblems);
    }, 0);
    const method = methods.slice().sort((a, b) => score(b) - score(a))[0] ?? 'symbol';
    const dedicatedItems = mappings.filter(mapping => mapping.representation === method);
    // Some current IDs acquire their algorithm representation when the surface
    // creates a written reservation. Preserve evidence from that actual mode;
    // re-use the existing convertible ID without changing the parent's setting.
    const methodItems = (dedicatedItems.length ? dedicatedItems : method === 'algorithm' ? convertibleItems : [])
        .map(mapping => mapping.itemId);
    const targets = requiredVariants.map((variant): MathUnitPracticeTarget => {
        const facet = unit.facets.find(candidate => candidate.representation === method && candidate.variant === variant);
        const due = facet?.nextCheckAt !== null && facet?.nextCheckAt !== undefined
            && Date.parse(facet.nextCheckAt) <= asOf;
        // A recently recovered facet may await its spaced check. Do not keep
        // selecting it ahead of untouched units while that interval is pending.
        const priority: MathUnitPracticePriority = unit.uncertainty || (facet?.needsRecheck && !facet.ready)
            ? 'recheck' : due ? 'due' : !facet?.ready ? 'unconfirmed' : 'practice';
        return { unitId: unit.unitId, itemIds: methodItems, representation: method, variant,
            priority, nextCheckAt: facet?.nextCheckAt ?? null };
    });
    const priority = targets.map(target => target.priority)
        .sort((a, b) => MATH_UNIT_PRACTICE_ORDER[a] - MATH_UNIT_PRACTICE_ORDER[b])[0];
    const preferred = targets.filter(target => target.priority === priority);
    return {
        unitId: unit.unitId, itemIds: mappings.map(mapping => mapping.itemId),
        preferredItemIds: [...new Set(preferred.flatMap(target => target.itemIds))],
        priority, preferredVariants: preferred.map(target => target.variant), requiredVariants, targets,
    };
}

/**
 * Ranking/coverage hints only. The caller still owns parent range, skip, Due
 * budget, support and rendering guards. Planned prerequisites never block this.
 */
export function getMathLevel11Practice(evaluation: ReturnType<typeof evaluateMathLevel11Pilot>) {
    const missingUnitIds = MATH_LV11_UNIT_IDS.filter(id => {
        const unit = evaluation.units.find(candidate => candidate.unitId === id);
        return !unit || unit.readiness !== 'ready' || unit.uncertainty;
    });
    return {
        evaluatedAt: evaluation.asOf,
        coverageReady: missingUnitIds.length === 0,
        missingUnitIds,
        priorities: evaluation.units.map(unit => unitPreference(unit, Date.parse(evaluation.asOf)))
            .sort((a, b) => MATH_UNIT_PRACTICE_ORDER[a.priority] - MATH_UNIT_PRACTICE_ORDER[b.priority]),
    };
}

export type MathLevel11Practice = ReturnType<typeof getMathLevel11Practice>;
