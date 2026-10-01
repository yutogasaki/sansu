/** Supporting introductions; these do not add required saved numeric levels. */
export const MATH_FOUNDATIONS = {
    foundation_tens: { level: 11, unit: 'math.place-value-tens', label: '10と1の まとまり' },
    foundation_expanded: { level: 12, unit: 'math.place-value-expanded', label: '100と10と1' },
    foundation_groups: { level: 13, unit: 'math.equal-groups', label: '同じ数の まとまり' },
    foundation_division: { level: 16, unit: 'math.division-meaning', label: '同じに わける' },
    foundation_decimal: { level: 19, unit: 'math.decimal-place-value', label: '小数の 量とくらべ方' },
    foundation_fraction: { level: 21, unit: 'math.fraction-quantity', label: '分数の 量とくらべ方' },
    foundation_equivalence: { level: 21, unit: 'math.fraction-equivalence', label: '同じ量の 分数' },
    foundation_mixed: { level: 22, unit: 'math.fraction-mixed-meaning', label: '整数と 分数の量' },
    foundation_rate: { level: 26, unit: 'math.unit-rate', label: '1あたりの 量' },
} as const;
export type MathFoundationId = keyof typeof MATH_FOUNDATIONS;
export const isMathFoundation = (id: string): id is MathFoundationId => Object.prototype.hasOwnProperty.call(MATH_FOUNDATIONS, id);
