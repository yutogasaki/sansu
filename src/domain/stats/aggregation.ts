import { AttemptLog } from "../../db";
import { MemoryState } from "../types";
import { MATH_CURRICULUM } from "../math/curriculum";
import { getLearningDayStart, toLocaleDateKey } from "../../utils/learningDay";

// ============================================================
// Types
// ============================================================

export interface WeeklyTrendPoint {
    label: string;    // "月"
    count: number;
    correct: number;
    accuracy: number; // 0-100
}

export interface RadarCategoryPoint {
    category: string;    // short label for radar axis
    value: number;       // 0-100 average accuracy
    skillCount: number;  // skills with answers
    totalSkills: number;
}

// ============================================================
// Math Skill Category Mapping
// ============================================================

const EARLY_RADAR_MAX_LEVEL = 12;

const EARLY_RADAR_CATEGORIES: { label: string; skills: string[] }[] = [
    {
        label: "かず",
        skills: [
            "count_5", "count_dot", "count_10", "count_read",
            "same_count_match", "one_to_one_match", "compose_5", "compose_10",
            "which_is_empty", "zero_concept", "share_equal",
        ],
    },
    {
        label: "ならび",
        skills: [
            "count_next_10", "count_back", "count_50", "count_next_20", "count_100",
            "count_fill", "count_order", "ordinal_small", "pattern_copy",
            "spatial_words", "one_more", "one_less", "two_more", "two_less",
        ],
    },
    {
        label: "くらべる",
        skills: [
            "count_which_more", "compare_1d", "compare_2d",
            "length_compare", "height_compare", "weight_compare", "big_small_compare",
            "same_or_different",
        ],
    },
    {
        label: "みつける",
        skills: [
            "count_shape", "count_color", "count_pair", "count_oddone", "sort_by_attribute",
        ],
    },
    {
        label: "たす",
        skills: ["add_tiny", "add_finger", "add_5", "add_1d_1", "add_1d_2"],
    },
    {
        label: "ひく",
        skills: ["sub_tiny", "sub_1d1d_nc", "sub_1d1d_c"],
    },
];

const STANDARD_RADAR_CATEGORIES: { label: string; skills: string[] }[] = [
    {
        label: "かぞえ",
        skills: ["count_5", "count_dot", "count_which_more", "count_read", "count_order", "count_oddone", "count_shape", "count_color", "count_pair", "count_10", "count_50", "count_100", "count_fill", "compare_1d", "compare_2d", "one_more", "two_more", "one_less", "two_less", "ordinal_small", "pattern_copy", "length_compare", "height_compare", "weight_compare", "big_small_compare", "same_or_different", "spatial_words", "one_to_one_match", "sort_by_attribute", "same_count_match", "compose_5", "compose_10", "which_is_empty", "zero_concept", "share_equal"],
    },
    {
        label: "＋−",
        skills: [
            "add_1d_1", "add_1d_2", "add_2d1d_nc", "add_2d1d_c",
            "add_2d2d_nc", "add_2d2d_c", "add_3d3d", "add_4d",
            "sub_1d1d_nc", "sub_1d1d_c", "sub_2d1d_nc", "sub_2d1d_c",
            "sub_2d2d", "sub_3d3d", "sub_4d",
        ],
    },
    {
        label: "×",
        skills: [
            "mul_99_1", "mul_99_2", "mul_99_3", "mul_99_4", "mul_99_5",
            "mul_99_6", "mul_99_7", "mul_99_8", "mul_99_9", "mul_99_rand",
            "mul_2d1d", "mul_3d1d", "mul_2d2d", "mul_3d2d",
        ],
    },
    {
        label: "÷",
        skills: [
            "div_99_rev", "div_2d1d_exact", "div_rem_q1", "div_rem_q2",
            "div_2d2d_exact", "div_3d1d_exact", "div_3d2d_exact",
        ],
    },
    {
        label: "小すう",
        skills: ["dec_add", "dec_sub", "dec_mul_int", "dec_div_int", "dec_mul_dec", "dec_div_dec"],
    },
    {
        label: "分すう",
        skills: [
            "frac_add_same", "frac_sub_same", "frac_add_diff", "frac_sub_diff",
            "frac_mixed", "frac_mixed_sub", "frac_mul_int", "frac_mul_frac",
            "frac_div_int", "frac_div_frac", "scale_10x",
        ],
    },
];

// ============================================================
// Weekly Trend Builder
// ============================================================

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export const buildWeeklyTrend = (
    logs: AttemptLog[],
    todayStart: Date,
    addDaysFn: (date: Date, days: number) => Date
): WeeklyTrendPoint[] => {
    const logsByDay = new Map<string, AttemptLog[]>();
    for (const log of logs) {
        const key = toLocaleDateKey(getLearningDayStart(new Date(log.timestamp)));
        const current = logsByDay.get(key) || [];
        current.push(log);
        logsByDay.set(key, current);
    }

    const week: WeeklyTrendPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
        const day = addDaysFn(todayStart, -offset);
        const key = toLocaleDateKey(day);
        const dayLogs = logsByDay.get(key) || [];
        const count = dayLogs.length;
        const correct = dayLogs.filter(l => l.result === "correct").length;
        week.push({
            label: WEEKDAY_JA[day.getDay()],
            count,
            correct,
            accuracy: count > 0 ? Math.round((correct / count) * 100) : 0,
        });
    }
    return week;
};

// ============================================================
// Radar Data Builder
// ============================================================

const getUnlockedSkills = (maxLevel: number): Set<string> => {
    const skills = new Set<string>();
    for (let lv = 0; lv <= maxLevel; lv++) {
        const lvSkills = MATH_CURRICULUM[lv];
        if (lvSkills) lvSkills.forEach(s => skills.add(s));
    }
    return skills;
};

export const buildRadarData = (
    mathMemory: MemoryState[],
    maxUnlockedLevel: number
): RadarCategoryPoint[] => {
    const memoryMap = new Map<string, MemoryState>();
    for (const m of mathMemory) {
        memoryMap.set(m.id, m);
    }

    const unlocked = getUnlockedSkills(maxUnlockedLevel);
    const radarCategories = maxUnlockedLevel <= EARLY_RADAR_MAX_LEVEL
        ? EARLY_RADAR_CATEGORIES
        : STANDARD_RADAR_CATEGORIES;

    return radarCategories.map(cat => {
        const relevantSkills = cat.skills.filter(s => unlocked.has(s));
        let totalAcc = 0;
        let answeredCount = 0;

        for (const skillId of relevantSkills) {
            const mem = memoryMap.get(skillId);
            if (mem && mem.totalAnswers > 0) {
                totalAcc += (mem.correctAnswers / mem.totalAnswers) * 100;
                answeredCount++;
            }
        }

        return {
            category: cat.label,
            value: answeredCount > 0 ? Math.round(totalAcc / answeredCount) : 0,
            skillCount: answeredCount,
            totalSkills: relevantSkills.length,
        };
    });
};
