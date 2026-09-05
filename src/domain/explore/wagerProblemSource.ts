/**
 * かけ探検ラボの出題ソース。
 *
 * ラボは planner / SRS へ接続しない。難易度を「レベル帯」だけで表現し、
 * 札が要求したレベルに実在するテンキー問題を決定論的に選ぶ。
 * 本番の予約集合（19章 §6.2）と Due / weak の扱いは G1 で決める。
 */
import { MATH_GENERATORS, generateMathProblem } from "../math";
import { MAX_MATH_LEVEL } from "../math/curriculum";
import type { Problem } from "../types";
import { createSeededRandom } from "../../utils/random";
import {
    getExploreSkillCandidateGroups,
    isExploreProblemCompatible,
} from "./problemAdapter";

export interface WagerProblemPlan {
    problem: Problem;
    skillId: string;
    level: number;
}

export const clampWagerLevel = (level: number): number => (
    Math.max(0, Math.min(MAX_MATH_LEVEL, Math.round(level)))
);

/**
 * 指定レベルにテンキー問題がなければ、近いレベルへ寄せる。
 * 寄せた事実は plan.level に残し、ラボの診断へ出す。
 */
export const createWagerProblem = (
    seed: string,
    requestedLevel: number,
    problemKey: string,
): WagerProblemPlan => {
    const level = clampWagerLevel(requestedLevel);
    const groups = getExploreSkillCandidateGroups(level);
    const random = createSeededRandom(`${seed}:${problemKey}`);
    const offset = Math.floor(random() * 1000);

    for (const candidates of groups) {
        for (let index = 0; index < candidates.length; index += 1) {
            const skillId = candidates[(offset + index) % candidates.length];
            if (!(skillId in MATH_GENERATORS)) continue;

            try {
                const generated = generateMathProblem(skillId, {
                    random: createSeededRandom(`${seed}:${problemKey}:${skillId}`),
                });
                if (!isExploreProblemCompatible(generated)) continue;

                return {
                    problem: {
                        ...generated,
                        id: `${seed}:${problemKey}`,
                        subject: "math",
                        isReview: false,
                    },
                    skillId,
                    level,
                };
            } catch {
                continue;
            }
        }
    }

    const fallback = generateMathProblem("add_tiny", {
        random: createSeededRandom(`${seed}:${problemKey}:add_tiny`),
    });
    return {
        problem: {
            ...fallback,
            id: `${seed}:${problemKey}`,
            subject: "math",
            isReview: false,
        },
        skillId: "add_tiny",
        level,
    };
};
