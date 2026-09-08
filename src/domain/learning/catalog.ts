import { ENGLISH_ITEM_MAPPINGS, ENGLISH_LEARNING_UNITS } from './englishCatalog';
import { MATH_ITEM_MAPPINGS, MATH_LEARNING_UNITS } from './mathCatalog';
import type { LearningItemMapping, LearningUnitDefinition } from './types';
import type { SubjectKey } from '../types';

export const LEARNING_UNITS: readonly LearningUnitDefinition[] = [
    ...MATH_LEARNING_UNITS, ...ENGLISH_LEARNING_UNITS,
];
export const LEARNING_ITEM_MAPPINGS: readonly LearningItemMapping[] = [
    ...MATH_ITEM_MAPPINGS, ...ENGLISH_ITEM_MAPPINGS,
];

const unitMap = new Map(LEARNING_UNITS.map((unit) => [unit.id, unit]));
const itemMap = new Map(LEARNING_ITEM_MAPPINGS.map((item) => [`${item.subject}:${item.itemId}`, item]));

export const getLearningUnit = (id: string) => unitMap.get(id);
export const getLearningItemMapping = (subject: SubjectKey, itemId: string) => itemMap.get(`${subject}:${itemId}`);

/** Authoring diagnostics; never used as a live unlocking rule. */
export const validateLearningCatalog = (
    units: readonly LearningUnitDefinition[] = LEARNING_UNITS,
    mappings: readonly LearningItemMapping[] = LEARNING_ITEM_MAPPINGS,
): string[] => {
    const errors: string[] = [];
    const byId = new Map<string, LearningUnitDefinition>();
    for (const unit of units) {
        if (byId.has(unit.id)) errors.push(`Duplicate unit: ${unit.id}`);
        byId.set(unit.id, unit);
        if (unit.availability === 'existing' && unit.itemIds.length === 0) errors.push(`Empty existing unit: ${unit.id}`);
        if (new Set(unit.itemIds).size !== unit.itemIds.length) errors.push(`Duplicate item in unit: ${unit.id}`);
    }
    const seen = new Set<string>();
    for (const item of mappings) {
        const key = `${item.subject}:${item.itemId}`;
        if (seen.has(key)) errors.push(`Duplicate mapping: ${key}`);
        seen.add(key);
        const unit = byId.get(item.unitId);
        if (!unit || unit.subject !== item.subject || !unit.itemIds.includes(item.itemId)) errors.push(`Invalid mapping: ${key}`);
    }
    for (const unit of units) {
        for (const itemId of unit.itemIds) {
            if (!mappings.some((item) => item.unitId === unit.id && item.itemId === itemId && item.subject === unit.subject)) {
                errors.push(`Missing mapping: ${unit.id}/${itemId}`);
            }
        }
        for (const id of [...unit.prerequisites, ...unit.suggestedPrerequisites]) {
            const prerequisite = byId.get(id);
            if (!prerequisite || prerequisite.subject !== unit.subject) errors.push(`Invalid prerequisite: ${unit.id}/${id}`);
        }
    }
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string) => {
        if (visiting.has(id)) { errors.push(`Prerequisite cycle: ${id}`); return; }
        if (visited.has(id)) return;
        visiting.add(id);
        const unit = byId.get(id);
        for (const next of unit ? [...unit.prerequisites, ...unit.suggestedPrerequisites] : []) visit(next);
        visiting.delete(id);
        visited.add(id);
    };
    units.forEach((unit) => visit(unit.id));
    return errors;
};
