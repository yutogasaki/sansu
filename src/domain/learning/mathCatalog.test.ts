import { describe, expect, it } from 'vitest';
import { MATH_CURRICULUM } from '../math/curriculum';
import { generateMathProblem, MATH_GENERATORS } from '../math';
import { createSeededRandom } from '../../utils/random';
import { MATH_ITEM_MAPPINGS, MATH_LEARNING_UNITS, MATH_LV11_UNIT_IDS } from './mathCatalog';

const mappings = new Map(MATH_ITEM_MAPPINGS.map(mapping => [mapping.itemId, mapping]));
const units = new Map(MATH_LEARNING_UNITS.map(unit => [unit.id, unit]));

describe('math unit catalog', () => {
    it('maps all 118 existing items exactly once without changing any of the 29 saved levels', () => {
        const legacyItems = Object.values(MATH_CURRICULUM).flat();
        expect(Object.keys(MATH_CURRICULUM)).toHaveLength(29);
        expect(legacyItems).toHaveLength(118);
        expect(MATH_ITEM_MAPPINGS).toHaveLength(118);
        expect(mappings.size).toBe(118);
        expect([...mappings.keys()].sort()).toEqual([...legacyItems].sort());
        expect([...mappings.keys()].sort()).toEqual(Object.keys(MATH_GENERATORS).sort());

        for (const [level, itemIds] of Object.entries(MATH_CURRICULUM)) {
            for (const itemId of itemIds) {
                expect(mappings.get(itemId)?.legacyLevel, itemId).toBe(Number(level));
            }
        }
    });

    it('has unique unit ids, valid references, consistent membership, and no dependency cycle', () => {
        expect(units.size).toBe(MATH_LEARNING_UNITS.length);
        for (const unit of MATH_LEARNING_UNITS) {
            expect(unit.id).toMatch(/^math\.[a-z][a-z-]+$/);
            expect(unit.subject).toBe('math');
            const refs = [...unit.prerequisites, ...unit.suggestedPrerequisites];
            expect(new Set(refs).size, unit.id).toBe(refs.length);
            refs.forEach(ref => expect(units.has(ref), `${unit.id} -> ${ref}`).toBe(true));
            expect(unit.itemIds.length > 0, unit.id).toBe(unit.availability === 'existing');
            const mappedItems = MATH_ITEM_MAPPINGS.filter(item => item.unitId === unit.id).map(item => item.itemId);
            expect([...unit.itemIds].sort()).toEqual(mappedItems.sort());
        }
        for (const mapping of MATH_ITEM_MAPPINGS) {
            expect(mapping.subject).toBe('math');
            expect(units.get(mapping.unitId)?.availability).toBe('existing');
            expect(mapping.variants.length).toBeGreaterThan(0);
            expect(new Set(mapping.variants).size).toBe(mapping.variants.length);
        }

        const complete = new Set<string>();
        const visit = (id: string, path: readonly string[]) => {
            expect(path, `dependency cycle through ${id}`).not.toContain(id);
            if (complete.has(id)) return;
            const unit = units.get(id)!;
            [...unit.prerequisites, ...unit.suggestedPrerequisites].forEach(ref => visit(ref, [...path, id]));
            complete.add(id);
        };
        MATH_LEARNING_UNITS.forEach(unit => visit(unit.id, []));
    });

    it('splits the 19 Lv11 ids into seven concepts while preserving their prompted representations', () => {
        expect(MATH_LV11_UNIT_IDS).toHaveLength(7);
        const lv11 = MATH_ITEM_MAPPINGS.filter(item => item.legacyLevel === 11);
        expect(new Set(lv11.map(item => item.unitId))).toEqual(new Set(MATH_LV11_UNIT_IDS));
        expect(MATH_LV11_UNIT_IDS.map(id => units.get(id)?.itemIds.length)).toEqual([4, 4, 4, 4, 1, 1, 1]);
        expect(lv11.map(item => item.itemId).sort()).toEqual([...MATH_CURRICULUM[11]].sort());
        expect(lv11.filter(item => item.representation === 'algorithm')).toHaveLength(4);
        expect(mappings.get('add_2d1d_mental_nc')?.representation).toBe('mental');
        expect(mappings.get('add_2d1d_make10')?.representation).toBe('strategy');
        expect(mappings.get('sub_2d1d_diff')?.representation).toBe('strategy');
        expect(mappings.get('sub_2d1d_back_add')?.representation).toBe('reverse');
        expect(mappings.get('sub_2d2d')?.variants).toEqual(['no-regroup', 'regroup']);
    });

    it('checks the actual two-digit generator forms and both subtraction variants', () => {
        const observed = new Set<string>();
        const random = createSeededRandom('math-unit-catalog-forms');
        for (let index = 0; index < 80; index += 1) {
            for (const itemId of ['add_2d2d_nc', 'add_2d2d_c', 'sub_2d2d']) {
                const problem = generateMathProblem(itemId, { random });
                expect(problem.inputType).toBe('number');
                expect(problem.questionVisual).toBeUndefined();
                expect(mappings.get(itemId)?.representation).toBe('symbol');
                if (itemId === 'sub_2d2d') {
                    const [a, b] = problem.questionText.match(/\d+/g)!.map(Number);
                    observed.add(a % 10 < b % 10 ? 'regroup' : 'no-regroup');
                }
            }
        }
        expect([...observed].sort()).toEqual([...mappings.get('sub_2d2d')!.variants].sort());
    });

    it('does not infer strategy, reverse, or cardinal counting from misleading legacy ids', () => {
        expect(mappings.get('frac_add_diff')?.representation).toBe('symbol');
        expect(mappings.get('frac_sub_diff')?.representation).toBe('symbol');
        expect(mappings.get('div_99_rev')?.representation).toBe('symbol');
        expect(mappings.get('count_50')?.unitId).toBe('math.successor');
        expect(mappings.get('count_100')?.unitId).toBe('math.successor');
        expect(mappings.get('count_order')?.unitId).toBe('math.smallest-number');
        const mentalProblem = generateMathProblem('add_2d1d_mental_nc', { random: createSeededRandom('mental') });
        expect(mentalProblem.questionVisual).toBeDefined();
        expect(units.get('math.add-two-one-no-regroup')?.notes).toContain('数直線の補助');
    });

    it('keeps language/color outside arithmetic prerequisites and marks missing foundations as planned', () => {
        for (const unit of MATH_LEARNING_UNITS) {
            expect([...unit.prerequisites, ...unit.suggestedPrerequisites]).not.toContain('math.color-recognition');
            expect([...unit.prerequisites, ...unit.suggestedPrerequisites]).not.toContain('math.number-reading');
        }
        for (const id of ['math.place-value-tens', 'math.decimal-place-value', 'math.fraction-quantity', 'math.fraction-equivalence']) {
            expect(units.get(id)?.availability).toBe('planned');
            expect(units.get(id)?.itemIds).toEqual([]);
        }
        expect(units.get('math.decimal-compare')?.prerequisites).toContain('math.decimal-place-value');
        expect(units.get('math.fraction-compare')?.prerequisites).toContain('math.fraction-quantity');
        expect(units.get('math.decimal-add')?.suggestedPrerequisites).toContain('math.decimal-compare');
        expect(units.get('math.fraction-add-same')?.suggestedPrerequisites).toContain('math.fraction-compare');
        expect(units.get('math.fraction-compare')?.prerequisites).not.toContain('math.fraction-divide-fraction');
    });
});
