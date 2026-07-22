import { db } from "../../db";
import { createSeededRandom } from "../../utils/random";
import {
    getMaintenanceMathSkillIds,
    getRecentAttempts,
    getRetiredMathSkillIds,
    getReviewItems,
    getSkippedItemsToday,
    getWeakMathSkillIds,
} from "../learningRepository";
import {
    planMathProblems,
    type MathProblemPlanItem,
} from "../math";
import {
    getAvailableSkills,
    getMathSkillMetadata,
} from "../math/curriculum";
import type { UserProfile } from "../types";
import { getProfile } from "../user/repository";
import {
    getExploreBenchmarkE2EOptions,
    waitForExploreProblemPlanE2E,
} from "./persistenceClient";
import { getExploreAssistCandidates } from "./problemAdapter";
import {
    createExploreProblemPlan,
    createExploreProblemPlanForSkill,
    type ExploreProblemPlan,
} from "./problemAdapter";
import { reserveExploreLearningAssignment } from "./persistenceRepository";
import type {
    ExploreLearningAssignment,
    ExploreLearningSource,
} from "./persistenceTypes";
import type { ExploreProblemGate, ExploreRunState } from "./types";
import {
    COLD_OPEN_FIXED_TEN_ID,
    createColdOpenFixedTenProblem,
} from "../benchmark/coldOpenFixedTen";
import { resolveExploreEncounterId } from "./encounters";

const EXPLORE_PLAN_WINDOW = 10;
const EXPLORE_COOLDOWN_WINDOW = 5;
const EXPLORE_REVIEW_CAP = 0.6;
const EXPLORE_WEAK_LIMIT = 3;
const EXPLORE_PLUS_ONE_LIMIT = 3;

export interface ReservedExploreProblemPlan extends ExploreProblemPlan {
    assignment: ExploreLearningAssignment;
}

export interface CreateAndReserveExploreProblemPlanOptions {
    signal?: AbortSignal;
}

const assertPlannerActive = (signal?: AbortSignal) => {
    if (!signal?.aborted) return;
    const error = signal.reason instanceof Error
        ? signal.reason
        : new Error("Explore problem planning was cancelled");
    error.name = "AbortError";
    throw error;
};

const toExploreLearningSource = (
    source: MathProblemPlanItem["source"],
): ExploreLearningSource => source === "retry" ? "representation-retry" : source;

const sortAssignments = (
    assignments: readonly ExploreLearningAssignment[],
): ExploreLearningAssignment[] => [...assignments].sort((left, right) => (
    left.reservedAt - right.reservedAt
    || left.problemId.localeCompare(right.problemId)
));

export const canAddExploreReviewAssignment = (
    assignments: readonly Pick<ExploreLearningAssignment, "countsTowardReviewCap">[],
    windowSize: number,
): boolean => {
    const safeWindowSize = Math.max(1, Math.floor(windowSize));
    const existing = assignments
        .slice(-Math.max(0, safeWindowSize - 1))
        .map((assignment) => assignment.countsTowardReviewCap);
    const totalAfterCandidate = existing.length + 1;
    const reviewCountAfterCandidate = existing.filter(Boolean).length + 1;
    const allowedReviewCount = Math.max(
        1,
        Math.floor(totalAfterCandidate * EXPLORE_REVIEW_CAP),
    );
    return reviewCountAfterCandidate <= allowedReviewCount;
};

const countAssignments = (
    assignments: readonly ExploreLearningAssignment[],
): Map<string, number> => {
    const counts = new Map<string, number>();
    assignments.forEach((assignment) => {
        counts.set(assignment.categoryId, (counts.get(assignment.categoryId) || 0) + 1);
    });
    return counts;
};

const getRetrySkillIds = (gate: ExploreProblemGate): string[] => {
    if (gate.attemptCount < 2 || !gate.skillId) return [];
    const configured = getMathSkillMetadata(gate.skillId).reviewFallbackSkillIds ?? [];
    return [...new Set([
        ...configured,
        ...getExploreAssistCandidates(gate.skillId),
    ])];
};

const reservePlan = async (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    plan: ExploreProblemPlan,
    selection: Omit<MathProblemPlanItem, "skillId" | "source"> & {
        source: ExploreLearningSource;
        affectsSrs: boolean;
    },
    signal?: AbortSignal,
): Promise<ReservedExploreProblemPlan> => {
    if (!state.profileId) throw new Error("Explore run is not bound to a profile");
    assertPlannerActive(signal);
    const assignment = await reserveExploreLearningAssignment({
        profileId: state.profileId,
        runId: state.runId,
        gateId: gate.gateId,
        problemId: plan.problem.id,
        categoryId: plan.problem.categoryId,
        source: selection.source,
        isReview: selection.isReview,
        isMaintenanceCheck: selection.isMaintenanceCheck,
        countsTowardReviewCap: selection.countsTowardReviewCap,
        affectsSrs: selection.affectsSrs,
        reservedAt: Date.now(),
    }, { signal });
    return { ...plan, assignment };
};

const restoreReservedPlan = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    profile: UserProfile,
    assignment: ExploreLearningAssignment,
): ReservedExploreProblemPlan => {
    const plan = createExploreProblemPlanForSkill(
        state,
        gate,
        assignment.categoryId,
        profile,
        {
            isReview: assignment.isReview,
            isMaintenanceCheck: assignment.isMaintenanceCheck,
        },
    );
    if (!plan || plan.problem.id !== assignment.problemId) {
        throw new Error(`Reserved exploration problem ${assignment.problemId} cannot be restored`);
    }
    return { ...plan, assignment };
};

export const createFixedTenExploreBenchmarkPlan = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    startIndex: number,
): ExploreProblemPlan | undefined => {
    const fixtureIndex = startIndex + state.steps;
    const problem = createColdOpenFixedTenProblem(
        fixtureIndex,
        `${gate.gateId}:benchmark-${fixtureIndex}:attempt-${gate.attemptCount}`,
    );
    if (!problem) return undefined;

    return {
        problem,
        encounterId: resolveExploreEncounterId(state, gate, problem),
    };
};

/**
 * Selects with the shared Study planner, reserves the immutable learning
 * assignment, and only then returns a problem that the Explore UI may display.
 */
export const createAndReserveExploreProblemPlan = async (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    profileSnapshot?: UserProfile,
    options: CreateAndReserveExploreProblemPlanOptions = {},
): Promise<ReservedExploreProblemPlan> => {
    if (!state.profileId) throw new Error("Explore run is not bound to a profile");

    await waitForExploreProblemPlanE2E(options.signal);
    assertPlannerActive(options.signal);

    const run = await db.exploreRuns.get(state.runId);
    if (!run || run.profileId !== state.profileId || run.status !== "active") {
        throw new Error(`Active exploration run ${state.runId} was not found`);
    }
    const profile = await getProfile(state.profileId) ?? profileSnapshot;
    if (!profile || profile.id !== state.profileId) {
        throw new Error(`Profile ${state.profileId} was not found`);
    }
    assertPlannerActive(options.signal);

    // This lane compares presentation throughput only. It deliberately does
    // not claim planner authenticity: the same fixed category appears ten
    // times, so every reservation is game-only and excluded from SRS.
    const benchmark = getExploreBenchmarkE2EOptions();
    const benchmarkPlan = benchmark.fixtureId === COLD_OPEN_FIXED_TEN_ID
        && benchmark.startIndex !== undefined
        ? createFixedTenExploreBenchmarkPlan(state, gate, benchmark.startIndex)
        : undefined;
    if (benchmarkPlan) {
        return reservePlan(state, gate, benchmarkPlan, {
            source: "game-only-fallback",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: false,
        }, options.signal);
    }

    const problemId = `${gate.gateId}:attempt-${gate.attemptCount}`;
    const existingAssignment = run.learningAssignments?.[problemId];
    if (existingAssignment) {
        return restoreReservedPlan(state, gate, profile, existingAssignment);
    }

    const [due, weak, maintenance, retired, skippedToday, recentAttempts] = await Promise.all([
        getReviewItems(profile.id, "math"),
        getWeakMathSkillIds(profile.id),
        getMaintenanceMathSkillIds(profile.id),
        getRetiredMathSkillIds(profile.id),
        getSkippedItemsToday(profile.id, "math"),
        getRecentAttempts(profile.id, 20),
    ]);
    assertPlannerActive(options.signal);
    const assignments = sortAssignments(Object.values(run.learningAssignments || {}));
    const planWindow = assignments.slice(-EXPLORE_PLAN_WINDOW);
    const recentAssignmentIds = assignments
        .slice(-EXPLORE_COOLDOWN_WINDOW)
        .map((assignment) => assignment.categoryId);
    const recentLogIds = recentAttempts
        .filter((attempt) => attempt.subject === "math")
        .map((attempt) => attempt.itemId)
        .slice(0, EXPLORE_COOLDOWN_WINDOW);
    const availableSkills = new Set(getAvailableSkills(profile.mathMaxUnlocked));
    const compatiblePlans = new Map<string, ExploreProblemPlan | null>();
    const getCompatiblePlan = (skillId: string) => {
        if (!compatiblePlans.has(skillId)) {
            compatiblePlans.set(
                skillId,
                createExploreProblemPlanForSkill(state, gate, skillId, profile),
            );
        }
        return compatiblePlans.get(skillId) ?? null;
    };

    const [selection] = planMathProblems({
        profile,
        count: 1,
        dueSkillIds: due.map((item) => item.id),
        weakSkillIds: weak.filter((skillId) => availableSkills.has(skillId)),
        maintenanceSkillIds: maintenance,
        retiredSkillIds: retired,
        retrySkillIds: getRetrySkillIds(gate),
        retryLimit: 1,
        cooldownIds: [...new Set([...recentLogIds, ...recentAssignmentIds])],
        recentIds: recentAssignmentIds,
        skippedTodayIds: skippedToday,
        blockCounts: countAssignments(planWindow),
        canAddReview: canAddExploreReviewAssignment(
            assignments,
            profile.dailyGoal ?? 20,
        ),
        currentWeakCount: planWindow.filter((item) => item.source === "weak").length,
        weakLimit: EXPLORE_WEAK_LIMIT,
        plusOneCount: planWindow.filter((item) => item.source === "plus-one").length,
        plusOneLimit: EXPLORE_PLUS_ONE_LIMIT,
        sameSkillLimit: 2,
        recentWindow: EXPLORE_COOLDOWN_WINDOW,
        maintenanceRate: 0.01,
        weakRate: 0.3,
        plusOneRate: 0.3,
        isSkillEligible: (skillId) => getCompatiblePlan(skillId) !== null,
        random: createSeededRandom(JSON.stringify([
            "explore-learning-plan-v1",
            state.seed,
            gate.gateId,
            gate.attemptCount,
        ])),
    });

    if (selection) {
        const exactPlan = createExploreProblemPlanForSkill(
            state,
            gate,
            selection.skillId,
            profile,
            {
                isReview: selection.isReview,
                isMaintenanceCheck: selection.isMaintenanceCheck,
            },
        );
        if (exactPlan) {
            return reservePlan(state, gate, exactPlan, {
                source: toExploreLearningSource(selection.source),
                isReview: selection.isReview,
                isMaintenanceCheck: selection.isMaintenanceCheck,
                countsTowardReviewCap: selection.countsTowardReviewCap,
                affectsSrs: true,
            }, options.signal);
        }
    }

    // Unsupported answer/input types remain playable but must not influence SRS.
    return reservePlan(state, gate, createExploreProblemPlan(state, gate, profile), {
        source: "game-only-fallback",
        isReview: false,
        isMaintenanceCheck: false,
        countsTowardReviewCap: false,
        affectsSrs: false,
    }, options.signal);
};
