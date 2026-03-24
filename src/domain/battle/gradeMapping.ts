import { BattleGrade } from "./types";

/**
 * Maps grade to math curriculum level range.
 * Overlapping ranges allow variety while maintaining grade-appropriate difficulty.
 */
export const GRADE_TO_LEVELS: Record<BattleGrade, { min: number; max: number }> = {
    [-2]: { min: 0, max: 1 },
    [-1]: { min: 0, max: 2 },
    0: { min: 0, max: 3 },
    1: { min: 1, max: 6 },
    2: { min: 4, max: 8 },
    3: { min: 7, max: 11 },
    4: { min: 9, max: 14 },
    5: { min: 12, max: 16 },
    6: { min: 14, max: 20 },
};

/**
 * Skills unsuitable for battle mode because they require non-number input
 * or rely heavily on visual/conceptual scaffolding.
 */
export const EXCLUDED_SKILLS = new Set([
    // choice input
    "count_which_more",
    "count_read",
    "count_oddone",
    "count_shape",
    "count_color",
    "count_pair",
    "one_more",
    "two_more",
    "ordinal_small",
    "pattern_copy",
    "length_compare",
    "height_compare",
    "weight_compare",
    "big_small_compare",
    "same_or_different",
    "spatial_words",
    "one_to_one_match",
    "sort_by_attribute",
    "same_count_match",
    "one_less",
    "two_less",
    "which_is_empty",
    "share_equal",
    "compare_1d",
    "compare_2d",
    // multi-number (quotient + remainder)
    "div_rem_q1",
    "div_rem_q2",
    // multi-number (fractions)
    "frac_add_same",
    "frac_sub_same",
    "frac_add_diff",
    "frac_sub_diff",
    "frac_mixed",
    "frac_mixed_sub",
    "frac_mul_int",
    "frac_mul_frac",
    "frac_div_int",
    "frac_div_frac",
]);
