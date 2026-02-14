export const MATH_CURRICULUM: Record<number, string[]> = {
    0: ["count_5", "count_dot", "count_which_more", "count_read", "count_order", "count_oddone", "count_shape", "count_color", "count_pair", "add_tiny"],
    1: ["count_10", "count_next_10", "add_finger", "count_back"],
    2: ["count_50", "count_next_20", "add_5", "sub_tiny"],
    3: ["count_100", "count_fill", "compare_1d", "compare_2d"],
    4: ["add_1d_1"],
    5: ["add_1d_2"],
    6: ["sub_1d1d_nc", "sub_1d1d_c"],
    7: ["add_2d1d_nc", "add_2d1d_c", "sub_2d1d_nc", "sub_2d1d_c", "add_2d2d_nc", "add_2d2d_c", "sub_2d2d"],
    8: ["add_3d3d", "sub_3d3d", "add_4d", "sub_4d"],
    9: ["mul_99_2", "mul_99_3", "mul_99_4", "mul_99_5", "mul_99_1"],
    10: ["mul_99_6", "mul_99_7", "mul_99_8", "mul_99_9", "mul_99_rand"],
    11: ["mul_2d1d", "mul_3d1d"],
    12: ["div_99_rev", "div_2d1d_exact"],
    13: ["div_rem_q1", "div_rem_q2"],
    14: ["mul_2d2d", "mul_3d2d", "div_2d2d_exact", "div_3d1d_exact", "div_3d2d_exact"],
    15: ["dec_add", "dec_sub"],
    16: ["dec_mul_int", "dec_div_int", "dec_mul_dec", "dec_div_dec"],
    17: ["frac_add_same", "frac_sub_same"],
    18: ["frac_add_diff", "frac_sub_diff", "frac_mixed", "frac_mixed_sub"],
    19: ["frac_mul_int", "frac_mul_frac"],
    20: ["frac_div_int", "frac_div_frac", "scale_10x"]
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
