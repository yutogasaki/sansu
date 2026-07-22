import { generateMathProblem, MATH_GENERATORS } from "../math";
import {
    getLevelForSkill,
    getMathSkillMetadata,
    getSkillsForLevel,
    MAX_MATH_LEVEL,
} from "../math/curriculum";
import type { Problem, UserProfile } from "../types";
import { createSeededRandom, type RandomSource } from "../../utils/random";
import {
    getPreferredExploreEncounterSkillCandidates,
    getRequestedExploreEncounterId,
    resolveExploreEncounterId,
} from "./encounters";
import { hashExploreSeed } from "./generator";
import type { ExploreEncounterId, ExploreProblemGate, ExploreRunState } from "./types";

const clampMathLevel = (level: number) => Math.max(0, Math.min(MAX_MATH_LEVEL, Math.round(level)));

const unique = (values: string[]) => [...new Set(values)];
const EXPLORE_NUMERIC_ANSWER_PATTERN = /^\d+(?:\.\d+)?$/;
export const EXPLORE_MAX_PROFILE_LEVEL_DISTANCE = 2;

type ExploreInputProblem = Pick<Problem, "inputType" | "correctAnswer">;

export const isExploreProblemCompatible = (problem: ExploreInputProblem): boolean => (
    problem.inputType === "number"
    && typeof problem.correctAnswer === "string"
    && problem.correctAnswer.length <= 8
    && EXPLORE_NUMERIC_ANSWER_PATTERN.test(problem.correctAnswer)
);

export const exploreProblemUsesDecimal = (problem: ExploreInputProblem): boolean => (
    isExploreProblemCompatible(problem)
    && (problem.correctAnswer as string).includes(".")
);

/**
 * MVP-1 supports the existing single-field numeric input only. Candidates stay
 * as close as possible to the profile's current curriculum level, falling back
 * to a neighboring level only when that level has no compatible generator.
 */
export const getExploreSkillCandidateGroups = (level: number): string[][] => {
    const currentLevel = clampMathLevel(level);
    const orderedLevels: number[] = [];

    for (let distance = 0; distance <= EXPLORE_MAX_PROFILE_LEVEL_DISTANCE; distance += 1) {
        const lower = currentLevel - distance;
        const upper = currentLevel + distance;
        if (lower >= 0) orderedLevels.push(lower);
        if (distance > 0 && upper <= MAX_MATH_LEVEL) orderedLevels.push(upper);
    }

    return orderedLevels
        .map((candidateLevel) => unique(getSkillsForLevel(candidateLevel))
            .filter((skillId) => skillId in MATH_GENERATORS))
        .filter((group) => group.length > 0);
};

export const getExploreSkillCandidates = (level: number): string[] => (
    getExploreSkillCandidateGroups(level).flat()
);

const rotate = <T,>(values: T[], offset: number) => (
    values.length === 0
        ? values
        : [...values.slice(offset % values.length), ...values.slice(0, offset % values.length)]
);

const ASSIST_REPRESENTATION_PRIORITY = [
    "concrete",
    "bridge",
    "strategy",
    "symbol",
    "reverse",
    "mental",
    "algorithm",
] as const;

const getRepresentationPriority = (skillId: string) => {
    const representation = getMathSkillMetadata(skillId).representation;
    const index = ASSIST_REPRESENTATION_PRIORITY.indexOf(representation);
    return index < 0 ? ASSIST_REPRESENTATION_PRIORITY.length : index;
};

const normalizeAssistFamily = (skillId: string, family: string) => {
    if (skillId.startsWith("frac_") || family === "fraction-basic") return "fraction";
    if (skillId.startsWith("dec_") || skillId === "scale_10x" || family === "decimal-basic") {
        return "decimal";
    }
    // "application" groups unrelated word-problem concepts for curriculum
    // display. Treat each one as its own concept when choosing an assist.
    if (family === "application") return skillId;
    return family;
};

const EXPLORE_ASSIST_PREREQUISITES: Record<string, string[]> = {
    count_100: ["count_50", "count_10"],
    mul_2d1d: ["mul_99_rand"],
    mul_3d1d: ["mul_2d1d", "mul_99_rand"],
    mul_2d2d: ["mul_2d1d", "mul_99_rand"],
    mul_3d2d: ["mul_2d1d", "mul_99_rand"],
    div_rem_q1: ["div_99_rev"],
    div_rem_q2: ["div_99_rev"],
    div_2d2d_exact: ["div_2d1d_exact", "div_99_rev"],
    div_3d1d_exact: ["div_2d1d_exact", "div_99_rev"],
    div_3d2d_exact: ["div_2d1d_exact", "div_99_rev"],
    dec_mul_dec: ["dec_mul_int"],
    dec_div_dec: ["dec_div_int"],
    scale_10x: ["dec_div_int"],
    average_basic: ["div_2d1d_exact"],
    ratio_basic: ["mul_99_rand"],
    speed_basic: ["mul_2d1d", "div_2d1d_exact"],
};

export const getExploreAssistCandidates = (skillId: string): string[] => {
    const originMetadata = getMathSkillMetadata(skillId);
    const originFamily = normalizeAssistFamily(skillId, originMetadata.family);
    const originLevel = getLevelForSkill(skillId) ?? MAX_MATH_LEVEL;
    const curriculumSkills = Array.from({ length: MAX_MATH_LEVEL + 1 }, (_, level) => (
        getSkillsForLevel(level)
    )).flat();
    const sameConcept = (originMetadata.sameConceptSkillIds ?? [])
        .filter((candidate) => candidate in MATH_GENERATORS)
        .filter((candidate) => (getLevelForSkill(candidate) ?? MAX_MATH_LEVEL) <= originLevel);
    const lowerSameFamily = unique(curriculumSkills)
        .filter((candidate) => candidate !== skillId && candidate in MATH_GENERATORS)
        .filter((candidate) => {
            const metadata = getMathSkillMetadata(candidate);
            return normalizeAssistFamily(candidate, metadata.family) === originFamily;
        })
        .filter((candidate) => (getLevelForSkill(candidate) ?? MAX_MATH_LEVEL) < originLevel);

    const sortedLowerSameFamily = lowerSameFamily.sort((left, right) => {
        const representationDifference = getRepresentationPriority(left) - getRepresentationPriority(right);
        if (representationDifference !== 0) return representationDifference;
        const leftDistance = Math.abs((getLevelForSkill(left) ?? originLevel) - originLevel);
        const rightDistance = Math.abs((getLevelForSkill(right) ?? originLevel) - originLevel);
        return leftDistance - rightDistance;
    });

    return unique([
        ...(EXPLORE_ASSIST_PREREQUISITES[skillId] ?? []),
        ...sameConcept,
        ...sortedLowerSameFamily,
    ]);
};

const generateFirstNumericProblem = (
    candidates: string[],
    offset: number,
    profile?: UserProfile,
    createRandom?: (skillId: string) => RandomSource,
) => {
    for (const skillId of rotate(candidates, offset)) {
        const generated = generateMathProblem(skillId, {
            profile,
            random: createRandom?.(skillId),
        });
        if (isExploreProblemCompatible(generated)) {
            return generated;
        }
    }
    return null;
};

const generateNearestNumericProblem = (
    candidateGroups: string[][],
    offset: number,
    profile: UserProfile | undefined,
    requestedEncounterId: ExploreEncounterId | undefined,
    createRandom: (skillId: string) => RandomSource,
) => {
    for (let groupIndex = 0; groupIndex < candidateGroups.length; groupIndex += 1) {
        const candidates = candidateGroups[groupIndex];
        const encounterCandidates = requestedEncounterId
            ? getPreferredExploreEncounterSkillCandidates(requestedEncounterId, candidates)
            : [];
        const encounterProblem = generateFirstNumericProblem(
            encounterCandidates,
            offset + groupIndex,
            profile,
            createRandom,
        );
        if (encounterProblem) return encounterProblem;

        const standardProblem = generateFirstNumericProblem(
            candidates,
            offset + groupIndex,
            profile,
            createRandom,
        );
        if (standardProblem) return standardProblem;
    }

    return null;
};

export interface ExploreProblemPlan {
    problem: Problem;
    encounterId?: ExploreEncounterId;
}

export const createExploreProblemRandomKey = (
    state: Pick<ExploreRunState, "seed">,
    gate: Pick<ExploreProblemGate, "gateId" | "attemptCount">,
    skillId: string,
): string => JSON.stringify([
    "explore-problem-v1",
    state.seed,
    gate.gateId,
    gate.attemptCount,
    skillId,
]);

/**
 * Generates the exact skill reserved by the learning planner. Encounter art may
 * adapt to the problem, but it must never replace the reserved category.
 */
export const createExploreProblemPlanForSkill = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    skillId: string,
    profile?: UserProfile,
    metadata: Pick<Problem, "isReview" | "isMaintenanceCheck"> = {
        isReview: false,
        isMaintenanceCheck: false,
    },
): ExploreProblemPlan | null => {
    if (!(skillId in MATH_GENERATORS)) return null;

    try {
        const generated = generateMathProblem(skillId, {
            profile,
            random: createSeededRandom(createExploreProblemRandomKey(state, gate, skillId)),
        });
        if (!isExploreProblemCompatible(generated)) return null;

        const problem: Problem = {
            ...generated,
            id: `${gate.gateId}:attempt-${gate.attemptCount}`,
            subject: "math",
            isReview: metadata.isReview,
            isMaintenanceCheck: metadata.isMaintenanceCheck,
        };
        return {
            problem,
            encounterId: resolveExploreEncounterId(state, gate, problem),
        };
    } catch {
        return null;
    }
};

export const createExploreProblemPlan = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    profile?: UserProfile,
): ExploreProblemPlan => {
    const level = profile?.mathMainLevel ?? 8;
    const standardCandidateGroups = getExploreSkillCandidateGroups(level);
    const offset = hashExploreSeed(`${state.seed}:${gate.gateId}:${gate.attemptCount}`);
    const createRandom = (skillId: string) => createSeededRandom(
        createExploreProblemRandomKey(state, gate, skillId),
    );

    const configuredAssistCandidates = gate.attemptCount >= 2 && gate.skillId
        ? (getMathSkillMetadata(gate.skillId).reviewFallbackSkillIds ?? [])
            .filter((skillId) => skillId in MATH_GENERATORS)
        : [];
    const genericAssistCandidates = gate.attemptCount >= 2 && gate.skillId
        ? getExploreAssistCandidates(gate.skillId)
            .filter((skillId) => !configuredAssistCandidates.includes(skillId))
        : [];
    const requestedEncounterId = getRequestedExploreEncounterId(state, gate);

    const generated = generateFirstNumericProblem(
        configuredAssistCandidates,
        offset,
        profile,
        createRandom,
    )
        ?? generateFirstNumericProblem(genericAssistCandidates, 0, profile, createRandom)
        ?? generateNearestNumericProblem(
            standardCandidateGroups,
            offset,
            profile,
            requestedEncounterId,
            createRandom,
        )
        ?? generateMathProblem("add_tiny", {
            profile,
            random: createRandom("add_tiny"),
        });

    const problem: Problem = {
        ...generated,
        id: `${gate.gateId}:attempt-${gate.attemptCount}`,
        subject: "math",
        isReview: false,
    };

    return {
        problem,
        encounterId: resolveExploreEncounterId(state, gate, problem),
    };
};

export const createExploreProblem = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    profile?: UserProfile,
): Problem => {
    return createExploreProblemPlan(state, gate, profile).problem;
};

export const isExploreAnswerCorrect = (problem: Problem, answer: string): boolean => (
    isExploreProblemCompatible(problem)
    && answer === problem.correctAnswer
);
