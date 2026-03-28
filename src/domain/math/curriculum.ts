import type { MathRepresentationMode, MathSkillMetadata } from "../types";

export const MAX_MATH_LEVEL = 28;
export const MAX_VOCAB_LEVEL = 20;

export const MATH_CURRICULUM: Record<number, string[]> = {
    // --- プリスクール (0-6) ---
    0: ["count_5", "count_dot", "count_read", "one_to_one_match", "same_count_match"],
    1: ["count_shape", "count_color", "count_pair", "same_or_different", "pattern_copy"],
    2: ["one_more", "ordinal_small", "spatial_words", "compose_5", "add_tiny"],
    3: ["count_10", "count_next_10", "count_back", "count_order", "count_which_more"],
    4: ["length_compare", "height_compare", "big_small_compare", "weight_compare", "sort_by_attribute", "count_oddone"],
    5: ["one_less", "two_more", "which_is_empty", "zero_concept", "share_equal", "add_finger"],
    6: ["count_50", "count_next_20", "add_5", "compose_10", "two_less", "sub_tiny"],
    // --- 小学校 (7-24) ---
    7: ["count_100", "count_fill", "compare_1d", "compare_2d"],
    8: ["add_1d_1_bridge", "add_1d_1"],
    9: ["add_1d_2_bridge", "add_1d_2"],
    10: ["sub_1d1d_nc_bridge", "sub_1d1d_nc", "sub_1d1d_c_bridge", "sub_1d1d_c"],
    11: [
        "add_2d1d_nc_bridge", "add_2d1d_mental_nc", "add_2d1d_hissan_nc", "add_2d1d_nc",
        "add_2d1d_c_bridge", "add_2d1d_make10", "add_2d1d_hissan_c", "add_2d1d_c",
        "sub_2d1d_nc_bridge", "sub_2d1d_diff", "sub_2d1d_hissan_nc", "sub_2d1d_nc",
        "sub_2d1d_c_bridge", "sub_2d1d_back_add", "sub_2d1d_hissan_c", "sub_2d1d_c",
        "add_2d2d_nc", "add_2d2d_c", "sub_2d2d"
    ],
    12: ["add_3d3d", "sub_3d3d", "add_4d", "sub_4d"],
    13: ["mul_99_2", "mul_99_3", "mul_99_4", "mul_99_5", "mul_99_1"],
    14: ["mul_99_6", "mul_99_7", "mul_99_8", "mul_99_9", "mul_99_rand"],
    15: ["mul_2d1d", "mul_3d1d"],
    16: ["div_99_rev", "div_2d1d_exact"],
    17: ["div_rem_q1", "div_rem_q2"],
    18: ["mul_2d2d", "mul_3d2d", "div_2d2d_exact", "div_3d1d_exact", "div_3d2d_exact"],
    19: ["dec_add", "dec_sub"],
    20: ["dec_mul_int", "dec_div_int", "dec_mul_dec", "dec_div_dec"],
    21: ["frac_add_same", "frac_sub_same"],
    22: ["frac_add_diff", "frac_sub_diff", "frac_mixed", "frac_mixed_sub"],
    23: ["frac_mul_int", "frac_mul_frac"],
    24: ["frac_div_int", "frac_div_frac", "scale_10x"],
    25: ["large_number_unit", "dec_compare"],
    26: ["frac_compare", "percent_basic"],
    27: ["average_basic", "ratio_basic"],
    28: ["speed_basic"],
};

const FAMILY_GROUPS: { family: string; skills: string[] }[] = [
    {
        family: "count-basic",
        skills: ["count_5", "count_dot", "count_10"],
    },
    {
        family: "count-sequence",
        skills: ["count_next_10", "count_back", "count_50", "count_next_20", "count_100", "count_fill", "count_order", "compare_1d", "compare_2d", "one_more", "one_less", "two_more", "two_less"],
    },
    {
        family: "recognition",
        skills: ["count_read", "count_shape", "count_color", "count_pair"],
    },
    {
        family: "visual-compare",
        skills: ["count_which_more", "length_compare", "height_compare", "weight_compare", "big_small_compare"],
    },
    {
        family: "concept-play",
        skills: ["ordinal_small", "pattern_copy", "same_or_different", "spatial_words", "sort_by_attribute", "count_oddone"],
    },
    {
        family: "quantity-structure",
        skills: ["same_count_match", "one_to_one_match", "compose_5", "compose_10", "which_is_empty", "zero_concept", "share_equal"],
    },
    {
        family: "addition-basic",
        skills: ["add_tiny", "add_finger", "add_5", "add_1d_1_bridge", "add_1d_1", "add_1d_2_bridge", "add_1d_2", "add_2d1d_nc_bridge", "add_2d1d_mental_nc", "add_2d1d_hissan_nc", "add_2d1d_nc", "add_2d1d_c_bridge", "add_2d1d_make10", "add_2d1d_hissan_c", "add_2d1d_c"],
    },
    {
        family: "subtraction-basic",
        skills: ["sub_tiny", "sub_1d1d_nc_bridge", "sub_1d1d_nc", "sub_1d1d_c_bridge", "sub_1d1d_c", "sub_2d1d_nc_bridge", "sub_2d1d_diff", "sub_2d1d_hissan_nc", "sub_2d1d_nc", "sub_2d1d_c_bridge", "sub_2d1d_back_add", "sub_2d1d_hissan_c", "sub_2d1d_c"],
    },
    {
        family: "number-advanced",
        skills: ["large_number_unit"],
    },
    {
        family: "decimal-basic",
        skills: ["dec_compare"],
    },
    {
        family: "fraction-basic",
        skills: ["frac_compare"],
    },
    {
        family: "application",
        skills: ["percent_basic", "average_basic", "ratio_basic", "speed_basic"],
    },
];

const EXPLICIT_MATH_SKILL_METADATA: Record<string, Partial<MathSkillMetadata>> = {
    add_tiny: {
        representation: "concrete",
        sameConceptSkillIds: ["add_finger", "add_1d_1_bridge", "add_1d_1"],
    },
    add_finger: {
        representation: "concrete",
        sameConceptSkillIds: ["add_tiny", "add_1d_1_bridge", "add_1d_1"],
    },
    add_1d_1_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["add_tiny", "add_finger"],
        sameConceptSkillIds: ["add_tiny", "add_finger", "add_1d_1"],
    },
    add_1d_1: {
        representation: "symbol",
        reviewFallbackSkillIds: ["add_1d_1_bridge"],
        sameConceptSkillIds: ["add_1d_1_bridge"],
    },
    add_1d_2_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["add_1d_1_bridge", "add_finger"],
        sameConceptSkillIds: ["add_finger", "add_1d_1_bridge", "add_1d_2"],
    },
    add_1d_2: {
        representation: "symbol",
        reviewFallbackSkillIds: ["add_1d_2_bridge"],
        sameConceptSkillIds: ["add_1d_2_bridge"],
    },
    add_2d1d_nc_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["add_1d_2_bridge"],
        sameConceptSkillIds: ["add_2d1d_mental_nc"],
    },
    add_2d1d_mental_nc: {
        representation: "mental",
        reviewFallbackSkillIds: ["add_2d1d_nc_bridge"],
        sameConceptSkillIds: ["add_2d1d_hissan_nc", "add_2d1d_nc"],
    },
    add_2d1d_hissan_nc: {
        representation: "algorithm",
        reviewFallbackSkillIds: ["add_2d1d_mental_nc"],
        sameConceptSkillIds: ["add_2d1d_nc"],
    },
    add_2d1d_nc: {
        representation: "symbol",
        reviewFallbackSkillIds: ["add_2d1d_nc_bridge"],
    },
    add_2d1d_c_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["add_2d1d_nc_bridge"],
        sameConceptSkillIds: ["add_2d1d_make10"],
    },
    add_2d1d_make10: {
        representation: "strategy",
        reviewFallbackSkillIds: ["add_2d1d_c_bridge"],
        sameConceptSkillIds: ["add_2d1d_hissan_c", "add_2d1d_c"],
    },
    add_2d1d_hissan_c: {
        representation: "algorithm",
        reviewFallbackSkillIds: ["add_2d1d_make10"],
        sameConceptSkillIds: ["add_2d1d_c"],
    },
    add_2d1d_c: {
        representation: "symbol",
        reviewFallbackSkillIds: ["add_2d1d_c_bridge"],
    },
    sub_tiny: {
        representation: "concrete",
        sameConceptSkillIds: ["sub_1d1d_nc_bridge", "sub_1d1d_nc"],
    },
    sub_1d1d_nc_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["sub_tiny"],
        sameConceptSkillIds: ["sub_tiny", "sub_1d1d_nc"],
    },
    sub_1d1d_nc: {
        representation: "symbol",
        reviewFallbackSkillIds: ["sub_1d1d_nc_bridge"],
        sameConceptSkillIds: ["sub_1d1d_nc_bridge"],
    },
    sub_1d1d_c_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["sub_1d1d_nc_bridge"],
        sameConceptSkillIds: ["sub_1d1d_nc_bridge", "sub_1d1d_c"],
    },
    sub_1d1d_c: {
        representation: "symbol",
        reviewFallbackSkillIds: ["sub_1d1d_c_bridge"],
        sameConceptSkillIds: ["sub_1d1d_c_bridge"],
    },
    sub_2d1d_nc_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["sub_1d1d_nc_bridge"],
        sameConceptSkillIds: ["sub_2d1d_diff"],
    },
    sub_2d1d_diff: {
        representation: "strategy",
        reviewFallbackSkillIds: ["sub_2d1d_nc_bridge"],
        sameConceptSkillIds: ["sub_2d1d_hissan_nc", "sub_2d1d_nc"],
    },
    sub_2d1d_hissan_nc: {
        representation: "algorithm",
        reviewFallbackSkillIds: ["sub_2d1d_diff"],
        sameConceptSkillIds: ["sub_2d1d_nc"],
    },
    sub_2d1d_nc: {
        representation: "symbol",
        reviewFallbackSkillIds: ["sub_2d1d_nc_bridge"],
    },
    sub_2d1d_c_bridge: {
        representation: "bridge",
        reviewFallbackSkillIds: ["sub_2d1d_nc_bridge"],
        sameConceptSkillIds: ["sub_2d1d_back_add"],
    },
    sub_2d1d_back_add: {
        representation: "reverse",
        reviewFallbackSkillIds: ["sub_2d1d_c_bridge"],
        sameConceptSkillIds: ["sub_2d1d_hissan_c", "sub_2d1d_c"],
    },
    sub_2d1d_hissan_c: {
        representation: "algorithm",
        reviewFallbackSkillIds: ["sub_2d1d_back_add"],
        sameConceptSkillIds: ["sub_2d1d_c"],
    },
    sub_2d1d_c: {
        representation: "symbol",
        reviewFallbackSkillIds: ["sub_2d1d_c_bridge"],
    },
};

const inferMathSkillRepresentation = (skillId: string): MathRepresentationMode => {
    if (skillId.endsWith("_bridge")) return "bridge";
    if (skillId.includes("_hissan") || skillId.includes("_algorithm")) return "algorithm";
    if (skillId.includes("_mental")) return "mental";
    if (skillId.includes("_reverse") || skillId.includes("_inverse")) return "reverse";
    if (skillId.includes("_strategy") || skillId.includes("_make10") || skillId.includes("_diff")) return "strategy";
    if (skillId.startsWith("count_") || skillId === "compose_5" || skillId === "compose_10" || skillId === "share_equal") {
        return "concrete";
    }
    return "symbol";
};

export const getSkillsForLevel = (level: number): string[] => {
    return MATH_CURRICULUM[level] || [];
};

export const getAvailableSkills = (maxLevel: number): string[] => {
    let skills: string[] = [];
    for (let i = 0; i <= maxLevel; i++) {
        if (MATH_CURRICULUM[i]) {
            skills = skills.concat(MATH_CURRICULUM[i]);
        }
    }
    return skills;
};

export const getLevelForSkill = (skillId: string): number | null => {
    for (const [level, skills] of Object.entries(MATH_CURRICULUM)) {
        if (skills.includes(skillId)) {
            return Number(level);
        }
    }
    return null;
};

export const getMathSkillFamily = (skillId: string): string => {
    const explicit = FAMILY_GROUPS.find(group => group.skills.includes(skillId));
    if (explicit) return explicit.family;

    if (skillId.startsWith("add_")) return "addition";
    if (skillId.startsWith("sub_")) return "subtraction";
    if (skillId.startsWith("mul_")) return "multiplication";
    if (skillId.startsWith("div_")) return "division";
    if (skillId.startsWith("dec_")) return "decimal";
    if (skillId.startsWith("frac_")) return "fraction";
    if (skillId.startsWith("count_")) return "counting";
    if (skillId.startsWith("compare_")) return "comparison";

    return skillId;
};

export const getMathSkillMetadata = (skillId: string): MathSkillMetadata => {
    const explicit = EXPLICIT_MATH_SKILL_METADATA[skillId];
    return {
        family: explicit?.family ?? getMathSkillFamily(skillId),
        representation: explicit?.representation ?? inferMathSkillRepresentation(skillId),
        reviewFallbackSkillIds: explicit?.reviewFallbackSkillIds ?? [],
        sameConceptSkillIds: explicit?.sameConceptSkillIds ?? [],
    };
};
