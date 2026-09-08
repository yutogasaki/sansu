import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../utils/random";
import { createInitialProfile } from "../user/profile";
import { getMathSkillProgress } from "./core";
import { generateMathProblem } from "./index";
import { createMathProgressProfile } from "./testFixtures";

const pacedSkills = [
    "count_5", "count_dot", "count_which_more", "one_more", "count_read", "count_order",
    "ordinal_small", "pattern_copy", "length_compare", "height_compare", "weight_compare",
    "one_to_one_match", "sort_by_attribute", "big_small_compare", "same_or_different",
    "spatial_words", "count_shape", "count_color", "count_pair", "same_count_match",
    "compose_5", "add_tiny", "count_10", "count_next_10", "add_finger", "count_back",
    "two_more", "one_less", "zero_concept", "which_is_empty", "share_equal", "count_50",
    "count_next_20", "add_5", "compose_10", "two_less", "sub_tiny", "count_100", "count_fill",
    "compare_1d", "compare_2d", "add_1d_1_bridge", "add_1d_1", "add_1d_2_bridge",
    "add_1d_2", "sub_1d1d_nc_bridge", "sub_1d1d_nc", "sub_1d1d_c_bridge", "sub_1d1d_c",
];

describe("profile-backed math progression", () => {
    it("distinguishes a new learner from profile-free content inspection", () => {
        const profile = createInitialProfile("New learner", 1, 0, 1, "math");
        expect(getMathSkillProgress("count_5", { profile })).toBe(0);
        expect(getMathSkillProgress("count_5")).toBeUndefined();
        expect(getMathSkillProgress("count_5", {})).toBeUndefined();
        expect(generateMathProblem("count_5", { profile, random: () => 0.999 }).correctAnswer).toBe("1");
        expect(generateMathProblem("count_5", { random: () => 0.999 }).correctAnswer).toBe("5");
    });

    it.each([Number.NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        "treats malformed correctAnswers %s as an introductory sequence",
        correctAnswers => {
            const profile = createMathProgressProfile("add_tiny", correctAnswers);
            expect(getMathSkillProgress("add_tiny", { profile })).toBe(0);
            expect(generateMathProblem("add_tiny", { profile }).correctAnswer).toBe("2");
        },
    );

    it("safely restarts an old memory row with a missing correctAnswers field", () => {
        const profile = createMathProgressProfile("add_tiny", 12);
        Reflect.deleteProperty(profile.mathSkills.add_tiny, "correctAnswers");
        expect(getMathSkillProgress("add_tiny", { profile })).toBe(0);
        expect(generateMathProblem("add_tiny", { profile }).correctAnswer).toBe("2");
    });

    it.each(pacedSkills)("%s stays at its introduction after errors and skips", skillId => {
        const newProfile = createInitialProfile("New learner", 1, 0, 1, "math");
        const failedProfile = createMathProgressProfile(skillId, 0, {
            totalAnswers: 80, incorrectAnswers: 40, skippedAnswers: 40,
        });
        const generate = (profile: typeof newProfile) => generateMathProblem(skillId, {
            profile, random: createSeededRandom(`progress/${skillId}`),
        });
        expect(generate(failedProfile)).toEqual(generate(newProfile));
    });

    it.each([
        ["count_read", 8], ["count_next_10", 3], ["count_fill", 20], ["compare_2d", 20],
        ["add_tiny", 3], ["add_1d_2_bridge", 12], ["add_1d_2", 12],
        ["sub_tiny", 4], ["sub_1d1d_nc", 8], ["sub_1d1d_c_bridge", 8],
    ] as const)("%s advances with %s correct answers despite intervening errors", (skillId, correctAnswers) => {
        const generate = (correct: number, failed = 0) => generateMathProblem(skillId, {
            profile: createMathProgressProfile(skillId, correct, {
                totalAnswers: correct + failed * 2,
                incorrectAnswers: failed,
                skippedAnswers: failed,
            }),
            random: createSeededRandom(`success/${skillId}`),
        });
        expect(generate(correctAnswers, 40)).toEqual(generate(correctAnswers));
        expect(generate(correctAnswers)).not.toEqual(generate(0));
    });
});
