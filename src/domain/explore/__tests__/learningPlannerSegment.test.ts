import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryState, UserProfile } from "../../types";
import type { ReservedExploreProblemPlan } from "../learningPlanner";
import { DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID } from "../openingExperience";
import type { ExploreLearningSegment, ExploreRunRecord } from "../persistenceTypes";
import type { ExploreRunState } from "../types";

Object.assign(globalThis, { indexedDB, IDBKeyRange });

const { db } = await import("../../../db");
const { createInitialProfile } = await import("../../user/profile");
const { saveProfile } = await import("../../user/repository");
const { createAttemptIdentity } = await import("../attemptIdentity");
const {
    createInitialExploreState,
    exploreReducer,
    getAvailableExploreNodes,
} = await import("../reducer");
const {
    commitExploreAttempt,
    getResumableExploreRun,
    reserveExploreLearningAssignment,
    saveExploreRunCheckpoint,
    startExploreRun,
} = await import("../persistenceRepository");
const { createAndReserveExploreProblemPlan } = await import("../learningPlanner");
const { createExploreProblemPlanForSkill } = await import("../problemAdapter");
const {
    EXPLORE_RAPID_FALLBACK_CATEGORY_ID,
    isRapidLoopEligibleProblem,
} = await import("../rapidLoopEligibility");

interface RoutedRunFixture {
    state: ExploreRunState;
    revision: number;
}

const createProfile = (): UserProfile => {
    const profile = createInitialProfile("Segment planner", 1, 7, 1, "math");
    profile.mathMainLevel = 8;
    profile.mathMaxUnlocked = 8;
    profile.dailyGoal = 20;
    return profile;
};

const persistProfile = async (profile: UserProfile) => {
    await db.profiles.put(profile);
    await db.appData.put({
        id: "app",
        schemaVersion: 1,
        activeProfileId: profile.id,
        profiles: { [profile.id]: profile },
    });
};

const createMemory = (
    profileId: string,
    skillId: string,
    overrides: Partial<MemoryState> = {},
): MemoryState => ({
    profileId,
    id: skillId,
    strength: 2,
    nextReview: "2000-01-01T00:00:00.000Z",
    totalAnswers: 3,
    correctAnswers: 2,
    incorrectAnswers: 1,
    skippedAnswers: 0,
    updatedAt: "2000-01-01T00:00:00.000Z",
    status: "active",
    isWeak: false,
    ...overrides,
});

const addDueSkills = async (profileId: string, skillIds: readonly string[]) => {
    await db.memoryMath.bulkPut(skillIds.map((skillId, index) => createMemory(
        profileId,
        skillId,
        { nextReview: `2000-01-0${index + 1}T00:00:00.000Z` },
    )));
};

const startRoutedRun = async (
    profile: UserProfile,
    seed: string,
): Promise<RoutedRunFixture> => {
    const initial = {
        ...createInitialExploreState({ seed, now: 100 }),
        profileId: profile.id,
    };
    const run = await startExploreRun({
        runId: initial.runId,
        profileId: profile.id,
        seed: initial.seed,
        startedAt: initial.startedAt,
    });
    const target = getAvailableExploreNodes(initial)[0];
    if (!target) throw new Error("Expected an opening explore node");

    let routed = exploreReducer(initial, { type: "SELECT_NODE", nodeId: target.id });
    if (routed.pendingProblem?.actionType === "bridge") {
        routed = exploreReducer(routed, { type: "CHOOSE_BRIDGE", plan: "stones" });
    }
    const saved = await saveExploreRunCheckpoint({
        runId: initial.runId,
        profileId: profile.id,
        expectedRevision: run.activeCheckpoint?.revision ?? 0,
        state: routed,
        openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
        savedAt: 101,
    });
    return { state: routed, revision: saved.checkpointRevision };
};

const reserveOpeningSegment = async (
    profile: UserProfile,
    fixture: RoutedRunFixture,
): Promise<ReservedExploreProblemPlan> => {
    const gate = fixture.state.pendingProblem;
    if (!gate) throw new Error("Expected an opening problem gate");
    return createAndReserveExploreProblemPlan(
        fixture.state,
        gate,
        profile,
        { expectedCheckpointRevision: fixture.revision },
    );
};

const getOpeningSegment = async (runId: string): Promise<{
    run: ExploreRunRecord;
    segment: ExploreLearningSegment;
}> => {
    const run = await db.exploreRuns.get(runId);
    const segment = run?.learningSegments?.["0"];
    if (!run || !segment) throw new Error("Expected a reserved opening segment");
    return { run, segment };
};

const savePendingProblem = async (
    profile: UserProfile,
    fixture: RoutedRunFixture,
    plan: ReservedExploreProblemPlan,
) => {
    const pending = exploreReducer(fixture.state, {
        type: "SET_PROBLEM",
        problem: plan.problem,
        assignment: plan.assignment,
        encounterId: plan.encounterId,
    });
    return saveExploreRunCheckpoint({
        runId: fixture.state.runId,
        profileId: profile.id,
        expectedRevision: fixture.revision,
        state: pending,
        openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
        savedAt: 102,
    });
};

beforeEach(async () => {
    await db.open();
    for (const table of db.tables) await table.clear();
});

afterAll(async () => {
    await db.delete();
});

describe("Explore immutable learning-segment planner integration", () => {
    it("atomically reserves three full Problems while applying the review cap per candidate", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueSkills(profile.id, [
            "add_1d_1_bridge",
            "sub_1d1d_nc_bridge",
            "count_10",
        ]);
        const fixture = await startRoutedRun(profile, "segment-atomic-review-cap");

        const plan = await reserveOpeningSegment(profile, fixture);
        const { run, segment } = await getOpeningSegment(fixture.state.runId);

        expect(plan.learningSegment).toEqual(segment);
        expect(segment).toMatchObject({
            startStep: 0,
            endStepExclusive: 3,
            plannedFromStep: 0,
            profileSnapshot: {
                mathMainLevel: 8,
                mathMaxUnlocked: 8,
            },
        });
        expect(segment.slots).toHaveLength(3);
        expect(segment.slots.map((slot) => slot.step)).toEqual([0, 1, 2]);
        expect(segment.slots.every((slot) => (
            slot.problem.id.length > 0
            && slot.problem.subject === "math"
            && slot.problem.categoryId === slot.assignment.categoryId
            && slot.problem.id === slot.assignment.problemId
            && run.learningAssignments?.[slot.problem.id]?.assignmentKey
                === slot.assignment.assignmentKey
        ))).toBe(true);

        const reviewCapAssignments = segment.slots.filter(
            (slot) => slot.assignment.countsTowardReviewCap,
        );
        expect(reviewCapAssignments).toHaveLength(1);
        expect(reviewCapAssignments[0]?.assignment.source).toBe("due");
        await expect(db.memoryMath.where("profileId").equals(profile.id).count())
            .resolves.toBe(3);
    });

    it("fills a rapid-ineligible segment with a separate game-only identity without consuming Due", async () => {
        const profile = createProfile();
        profile.mathMainLevel = 28;
        profile.mathMaxUnlocked = 28;
        await persistProfile(profile);
        await addDueSkills(profile.id, ["large_number_unit"]);
        const profileBefore = structuredClone(
            (await db.appData.get("app"))?.profiles[profile.id],
        );
        const logCountBefore = await db.logs.count();
        const dueBefore = structuredClone(
            await db.memoryMath.get([profile.id, "large_number_unit"]),
        );
        const fixture = await startRoutedRun(profile, "segment-rapid-safe-fallback");

        const plan = await reserveOpeningSegment(profile, fixture);
        const { run, segment } = await getOpeningSegment(fixture.state.runId);

        expect(segment.slots).toHaveLength(3);
        expect(segment.slots.every((slot) => (
            slot.problem.categoryId === EXPLORE_RAPID_FALLBACK_CATEGORY_ID
            && slot.assignment.categoryId === EXPLORE_RAPID_FALLBACK_CATEGORY_ID
            && slot.assignment.source === "game-only-fallback"
            && slot.assignment.affectsSrs === false
            && isRapidLoopEligibleProblem(slot.problem)
        ))).toBe(true);
        expect(Object.values(run.learningAssignments || {}).some(
            (assignment) => assignment.categoryId === "large_number_unit",
        )).toBe(false);
        expect(await db.memoryMath.get([profile.id, "large_number_unit"]))
            .toEqual(dueBefore);

        const problemCheckpoint = await savePendingProblem(profile, fixture, plan);
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected the fallback gate");
        const receipt = await commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: profile.id,
                runId: fixture.state.runId,
                gateId: gate.gateId,
                attemptNumber: 1,
            }),
            problem: {
                id: plan.problem.id,
                categoryId: plan.problem.categoryId,
            },
            result: "correct",
            committedAt: 103,
            expectedCheckpointRevision: problemCheckpoint.checkpointRevision,
        });

        expect(receipt.learningLogId).toBeUndefined();
        expect(await db.logs.count()).toBe(logCountBefore);
        expect(await db.memoryMath.get([profile.id, "large_number_unit"]))
            .toEqual(dueBefore);
        expect((await db.appData.get("app"))?.profiles[profile.id]).toEqual(profileBefore);
    });

    it("leaves a rapid-safe but locked Due untouched while reserving unlocked slots", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueSkills(profile.id, ["add_1d_2_bridge"]);
        const dueBefore = structuredClone(
            await db.memoryMath.get([profile.id, "add_1d_2_bridge"]),
        );
        const fixture = await startRoutedRun(profile, "segment-locked-due");

        await reserveOpeningSegment(profile, fixture);
        const { run, segment } = await getOpeningSegment(fixture.state.runId);

        expect(segment.slots).toHaveLength(3);
        expect(segment.slots.every(
            (slot) => slot.problem.categoryId !== "add_1d_2_bridge",
        )).toBe(true);
        expect(Object.values(run.learningAssignments || {}).some(
            (assignment) => assignment.categoryId === "add_1d_2_bridge",
        )).toBe(false);
        expect(await db.memoryMath.get([profile.id, "add_1d_2_bridge"]))
            .toEqual(dueBefore);
    });

    it("rolls back all segment slots and assignments when the single run-row write fails", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "segment-atomic-rollback");
        const put = vi.spyOn(db.exploreRuns, "put")
            .mockRejectedValueOnce(new Error("injected segment write failure"));

        try {
            await expect(reserveOpeningSegment(profile, fixture))
                .rejects.toThrow("injected segment write failure");
        } finally {
            put.mockRestore();
        }

        const stored = await db.exploreRuns.get(fixture.state.runId);
        expect(stored?.learningSegments).toBeUndefined();
        expect(stored?.learningAssignments).toEqual({});
    });

    it("restores Q2 byte-for-byte from the saved slot after profile progression changes", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "segment-profile-freeze");
        const q1 = await reserveOpeningSegment(profile, fixture);
        const { segment } = await getOpeningSegment(fixture.state.runId);
        const savedQ2 = structuredClone(segment.slots[1]);
        if (!savedQ2) throw new Error("Expected a saved Q2 slot");

        const changedProfile: UserProfile = {
            ...profile,
            mathMainLevel: 1,
            mathMaxUnlocked: 1,
            mathSkills: {
                ...profile.mathSkills,
                [savedQ2.problem.categoryId]: createMemory(
                    profile.id,
                    savedQ2.problem.categoryId,
                    {
                        totalAnswers: 999,
                        correctAnswers: 998,
                        incorrectAnswers: 1,
                    },
                ),
            },
        };
        await saveProfile(changedProfile);

        const problemCheckpoint = await savePendingProblem(profile, fixture, q1);
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected the Q1 gate");
        const committed = await commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: profile.id,
                runId: fixture.state.runId,
                gateId: gate.gateId,
                attemptNumber: 1,
            }),
            problem: {
                id: q1.problem.id,
                categoryId: q1.problem.categoryId,
            },
            result: "correct",
            committedAt: 103,
            expectedCheckpointRevision: problemCheckpoint.checkpointRevision,
        });
        const afterAnswer = await db.exploreRuns.get(fixture.state.runId);
        const committedState = afterAnswer?.activeCheckpoint?.state;
        if (!committedState || committed.checkpointRevision === undefined) {
            throw new Error("Expected the committed Q1 checkpoint");
        }

        let routedQ2 = exploreReducer(committedState, {
            type: "SELECT_NODE",
            nodeId: savedQ2.nodeId,
        });
        if (routedQ2.pendingProblem?.actionType === "bridge") {
            routedQ2 = exploreReducer(routedQ2, {
                type: "CHOOSE_BRIDGE",
                plan: savedQ2.bridgePlan ?? "stones",
            });
        }
        const routeCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: committed.checkpointRevision,
            state: routedQ2,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 104,
        });
        const q2Gate = routedQ2.pendingProblem;
        if (!q2Gate) throw new Error("Expected the routed Q2 gate");

        const restoredQ2 = await createAndReserveExploreProblemPlan(
            routedQ2,
            q2Gate,
            changedProfile,
            { expectedCheckpointRevision: routeCheckpoint.checkpointRevision },
        );

        expect(restoredQ2.problem).toEqual(savedQ2.problem);
        expect(restoredQ2.assignment).toEqual(savedQ2.assignment);
        expect(restoredQ2.encounterId).toBe(savedQ2.encounterId);
        expect(restoredQ2.learningSegment).toEqual(segment);
        expect((await db.exploreRuns.get(fixture.state.runId))?.learningSegments?.["0"])
            .toEqual(segment);
    });

    it("rejects a stale expected checkpoint revision without reserving anything", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "segment-stale-cas");
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected an opening gate");

        await expect(createAndReserveExploreProblemPlan(
            fixture.state,
            gate,
            profile,
            { expectedCheckpointRevision: fixture.revision - 1 },
        )).rejects.toThrow(/expected checkpoint/);

        const stored = await db.exploreRuns.get(fixture.state.runId);
        expect(stored?.activeCheckpoint?.revision).toBe(fixture.revision);
        expect(stored?.learningSegments).toBeUndefined();
        expect(stored?.learningAssignments).toEqual({});
    });

    it("does not let future Q2/Q3 assignments cool down Q1's representation retry", async () => {
        const profile = createProfile();
        profile.mathMaxUnlocked = 9;
        await persistProfile(profile);
        // The Q1 Due target is one level above main. The remaining level-8
        // slots therefore reserve both add_1d_1 representations, including
        // the preferred bridge retry, before Q1 is answered.
        await addDueSkills(profile.id, ["add_1d_2_bridge"]);
        const fixture = await startRoutedRun(profile, "segment-future-cooldown");
        const q1 = await reserveOpeningSegment(profile, fixture);
        const { segment } = await getOpeningSegment(fixture.state.runId);

        expect(q1.problem.categoryId).toBe("add_1d_2_bridge");
        expect(segment.slots.slice(1).map((slot) => slot.problem.categoryId))
            .toContain("add_1d_1_bridge");

        const problemCheckpoint = await savePendingProblem(profile, fixture, q1);
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected the Q1 gate");
        let checkpointRevision = problemCheckpoint.checkpointRevision;
        for (const attemptNumber of [1, 2] as const) {
            const receipt = await commitExploreAttempt({
                identity: createAttemptIdentity({
                    profileId: profile.id,
                    runId: fixture.state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                }),
                problem: {
                    id: q1.problem.id,
                    categoryId: q1.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 102 + attemptNumber,
                expectedCheckpointRevision: checkpointRevision,
            });
            if (receipt.checkpointRevision === undefined) {
                throw new Error("Expected an incorrect-answer checkpoint");
            }
            checkpointRevision = receipt.checkpointRevision;
        }
        const checkpoint = (await db.exploreRuns.get(fixture.state.runId))?.activeCheckpoint;
        if (!checkpoint) throw new Error("Expected the Q1 retry checkpoint");
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem;
        if (!retryGate) throw new Error("Expected a representation retry gate");

        const retry = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpointRevision },
        );

        expect(retry.assignment.source).toBe("representation-retry");
        expect(retry.problem.categoryId).toBe("add_1d_1_bridge");
    });

    it("uses a separate rapid-safe game-only identity when a new retry has no eligible learning candidate", async () => {
        const profile = createProfile();
        profile.mathMainLevel = 25;
        profile.mathMaxUnlocked = 25;
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "retry-rapid-safe-fallback");
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected a legacy current gate");
        const legacyPlan = createExploreProblemPlanForSkill(
            fixture.state,
            gate,
            "large_number_unit",
            profile,
            { isReview: false, isMaintenanceCheck: false },
        );
        if (!legacyPlan) throw new Error("Expected a legacy high-load Problem");
        const legacyAssignment = await reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: fixture.state.runId,
            gateId: gate.gateId,
            problemId: legacyPlan.problem.id,
            categoryId: legacyPlan.problem.categoryId,
            source: "main",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: true,
            reservedAt: 105,
        });
        const visibleState = exploreReducer(fixture.state, {
            type: "SET_PROBLEM",
            problem: legacyPlan.problem,
            assignment: legacyAssignment,
            encounterId: legacyPlan.encounterId,
        });
        const visibleCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: fixture.revision,
            state: visibleState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 106,
        });
        await createAndReserveExploreProblemPlan(
            visibleState,
            visibleState.pendingProblem!,
            profile,
            { expectedCheckpointRevision: visibleCheckpoint.checkpointRevision },
        );

        let checkpointRevision = visibleCheckpoint.checkpointRevision;
        for (const attemptNumber of [1, 2] as const) {
            const receipt = await commitExploreAttempt({
                identity: createAttemptIdentity({
                    profileId: profile.id,
                    runId: fixture.state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                }),
                problem: {
                    id: legacyPlan.problem.id,
                    categoryId: legacyPlan.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 106 + attemptNumber,
                expectedCheckpointRevision: checkpointRevision,
            });
            if (receipt.checkpointRevision === undefined) {
                throw new Error("Expected an incorrect-answer checkpoint");
            }
            checkpointRevision = receipt.checkpointRevision;
        }
        const checkpoint = (await db.exploreRuns.get(fixture.state.runId))?.activeCheckpoint;
        if (!checkpoint) throw new Error("Expected the retry checkpoint");
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem;
        if (!retryGate) throw new Error("Expected a retry planning gate");

        const retry = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpointRevision },
        );

        expect(retry.problem.categoryId).toBe(EXPLORE_RAPID_FALLBACK_CATEGORY_ID);
        expect(isRapidLoopEligibleProblem(retry.problem)).toBe(true);
        expect(retry.assignment).toMatchObject({
            categoryId: EXPLORE_RAPID_FALLBACK_CATEGORY_ID,
            source: "game-only-fallback",
            affectsSrs: false,
        });
        expect((await db.exploreRuns.get(fixture.state.runId))
            ?.learningAssignments?.[legacyPlan.problem.id]).toEqual(legacyAssignment);

        const displayedRetryState = exploreReducer(retryState, {
            type: "SET_PROBLEM",
            problem: retry.problem,
            assignment: retry.assignment,
            encounterId: retry.encounterId,
        });
        const displayedRetryCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: checkpointRevision,
            state: displayedRetryState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 109,
        });
        const resumed = await getResumableExploreRun(profile.id);

        expect(resumed?.checkpoint.state.pendingProblem?.problem).toEqual(retry.problem);
        expect(resumed?.checkpoint.state.pendingProblem?.learningAssignment)
            .toEqual(retry.assignment);

        const fallbackReceipt = await commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: profile.id,
                runId: fixture.state.runId,
                gateId: retryGate.gateId,
                attemptNumber: 3,
            }),
            problem: {
                id: retry.problem.id,
                categoryId: retry.problem.categoryId,
            },
            result: "correct",
            committedAt: 110,
            expectedCheckpointRevision: displayedRetryCheckpoint.checkpointRevision,
        });

        expect(fallbackReceipt.learningLogId).toBeUndefined();
    });

    it("checkpoints and resumes a full-reserved retry selected from the main source", async () => {
        const profile = createProfile();
        profile.mathMainLevel = 13;
        profile.mathMaxUnlocked = 13;
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "retry-main-source-checkpoint");
        const initial = await reserveOpeningSegment(profile, fixture);
        expect(initial.problem.categoryId).toMatch(/^mul_99_/);
        const problemCheckpoint = await savePendingProblem(profile, fixture, initial);
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected the original multiplication gate");

        let checkpointRevision = problemCheckpoint.checkpointRevision;
        for (const attemptNumber of [1, 2] as const) {
            const receipt = await commitExploreAttempt({
                identity: createAttemptIdentity({
                    profileId: profile.id,
                    runId: fixture.state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                }),
                problem: {
                    id: initial.problem.id,
                    categoryId: initial.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 140 + attemptNumber,
                expectedCheckpointRevision: checkpointRevision,
            });
            if (receipt.checkpointRevision === undefined) {
                throw new Error("Expected an incorrect-answer checkpoint");
            }
            checkpointRevision = receipt.checkpointRevision;
        }

        const checkpoint = (await db.exploreRuns.get(fixture.state.runId))?.activeCheckpoint;
        if (!checkpoint) throw new Error("Expected the retry checkpoint");
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem;
        if (!retryGate) throw new Error("Expected a refreshed retry gate");
        const retry = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpointRevision },
        );

        expect(retry.assignment.source).toBe("main");
        expect(retry.assignment.reservedProblem).toEqual(retry.problem);

        const displayed = exploreReducer(retryState, {
            type: "SET_PROBLEM",
            problem: retry.problem,
            assignment: retry.assignment,
            encounterId: retry.encounterId,
        });
        const saved = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: checkpointRevision,
            state: displayed,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 143,
        });
        const resumed = await getResumableExploreRun(profile.id);

        expect(saved.checkpointRevision).toBe(checkpointRevision + 1);
        expect(resumed?.checkpoint.state.pendingProblem?.problem).toEqual(retry.problem);
        expect(resumed?.checkpoint.state.pendingProblem?.learningAssignment)
            .toEqual(retry.assignment);
    });

    it("writes no retry assignment when its expected checkpoint revision is stale", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueSkills(profile.id, ["add_1d_1"]);
        const fixture = await startRoutedRun(profile, "retry-stale-cas-no-write");
        const q1 = await reserveOpeningSegment(profile, fixture);
        const problemCheckpoint = await savePendingProblem(profile, fixture, q1);
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected the Q1 gate");

        let checkpointRevision = problemCheckpoint.checkpointRevision;
        for (const attemptNumber of [1, 2] as const) {
            const receipt = await commitExploreAttempt({
                identity: createAttemptIdentity({
                    profileId: profile.id,
                    runId: fixture.state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                }),
                problem: {
                    id: q1.problem.id,
                    categoryId: q1.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 104 + attemptNumber,
                expectedCheckpointRevision: checkpointRevision,
            });
            if (receipt.checkpointRevision === undefined) {
                throw new Error("Expected an incorrect-answer checkpoint");
            }
            checkpointRevision = receipt.checkpointRevision;
        }

        const checkpoint = (await db.exploreRuns.get(fixture.state.runId))?.activeCheckpoint;
        if (!checkpoint) throw new Error("Expected the retry checkpoint");
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem;
        if (!retryGate) throw new Error("Expected the retry gate");
        const retryProblemId = `${retryGate.gateId}:attempt-${retryGate.attemptCount}`;
        const assignmentsBefore = structuredClone(
            (await db.exploreRuns.get(fixture.state.runId))?.learningAssignments,
        );

        await expect(createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpointRevision - 1 },
        )).rejects.toThrow(/expected checkpoint/);

        const stored = await db.exploreRuns.get(fixture.state.runId);
        expect(stored?.learningAssignments).toEqual(assignmentsBefore);
        expect(stored?.learningAssignments?.[retryProblemId]).toBeUndefined();
    });

    it("restores a retry's full Problem and visual after mathSkills changes at the same revision", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueSkills(profile.id, ["add_1d_1"]);
        const fixture = await startRoutedRun(profile, "retry-full-problem-freeze");
        const q1 = await reserveOpeningSegment(profile, fixture);
        const problemCheckpoint = await savePendingProblem(profile, fixture, q1);
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected the Q1 gate");

        let checkpointRevision = problemCheckpoint.checkpointRevision;
        for (const attemptNumber of [1, 2] as const) {
            const receipt = await commitExploreAttempt({
                identity: createAttemptIdentity({
                    profileId: profile.id,
                    runId: fixture.state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                }),
                problem: {
                    id: q1.problem.id,
                    categoryId: q1.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 107 + attemptNumber,
                expectedCheckpointRevision: checkpointRevision,
            });
            if (receipt.checkpointRevision === undefined) {
                throw new Error("Expected an incorrect-answer checkpoint");
            }
            checkpointRevision = receipt.checkpointRevision;
        }

        const checkpoint = (await db.exploreRuns.get(fixture.state.runId))?.activeCheckpoint;
        if (!checkpoint) throw new Error("Expected the retry checkpoint");
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem;
        if (!retryGate) throw new Error("Expected the retry gate");

        const first = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpointRevision },
        );
        expect(first.assignment.reservedProblem).toEqual(first.problem);

        const currentProfile = (await db.appData.get("app"))?.profiles[profile.id];
        if (!currentProfile) throw new Error("Expected the persisted profile");
        const changedProfile: UserProfile = {
            ...currentProfile,
            mathSkills: {
                ...currentProfile.mathSkills,
                [first.problem.categoryId]: createMemory(
                    profile.id,
                    first.problem.categoryId,
                    {
                        totalAnswers: 1_000,
                        correctAnswers: 999,
                        incorrectAnswers: 1,
                    },
                ),
            },
        };
        await saveProfile(changedProfile);

        const restored = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            changedProfile,
            { expectedCheckpointRevision: checkpointRevision },
        );

        expect(restored.problem).toEqual(first.problem);
        expect(restored.problem.questionVisual).toEqual(first.problem.questionVisual);
        expect(restored.assignment).toEqual(first.assignment);
        expect(restored).toEqual(first);
        expect((await db.exploreRuns.get(fixture.state.runId))
            ?.learningAssignments?.[first.problem.id]?.reservedProblem).toEqual(first.problem);
    });

    it("adopts a legacy pending full Problem as the fixed current slot without changing it", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "legacy-current-slot-adoption");
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected a legacy current gate");
        const legacyPlan = createExploreProblemPlanForSkill(
            fixture.state,
            gate,
            "add_1d_1_bridge",
            profile,
            { isReview: false, isMaintenanceCheck: false },
        );
        if (!legacyPlan) throw new Error("Expected a compatible legacy Problem");
        const legacyAssignment = await reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: fixture.state.runId,
            gateId: gate.gateId,
            problemId: legacyPlan.problem.id,
            categoryId: legacyPlan.problem.categoryId,
            source: "main",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: true,
            reservedAt: 110,
            // Deliberately omit reservedProblem: this models a row created
            // before immutable learning segments and retry Problem snapshots.
        });
        const legacyState = exploreReducer(fixture.state, {
            type: "SET_PROBLEM",
            problem: legacyPlan.problem,
            assignment: legacyAssignment,
            encounterId: legacyPlan.encounterId,
        });
        const legacyCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: fixture.revision,
            state: legacyState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 111,
        });
        expect((await db.exploreRuns.get(fixture.state.runId))?.learningSegments)
            .toBeUndefined();

        const adopted = await createAndReserveExploreProblemPlan(
            legacyState,
            legacyState.pendingProblem!,
            profile,
            { expectedCheckpointRevision: legacyCheckpoint.checkpointRevision },
        );
        const { run, segment } = await getOpeningSegment(fixture.state.runId);

        expect(segment.slots).toHaveLength(3);
        expect(segment.slots[0]?.problem).toEqual(legacyPlan.problem);
        expect(segment.slots[0]?.assignment).toEqual(legacyAssignment);
        expect(segment.slots.slice(1)).toHaveLength(2);
        expect(adopted.problem).toEqual(legacyPlan.problem);
        expect(adopted.assignment).toEqual(legacyAssignment);
        expect(legacyState.pendingProblem?.problem).toEqual(legacyPlan.problem);
        expect(run.learningAssignments?.[legacyPlan.problem.id]).toEqual(legacyAssignment);
    });

    it("restores a saved v2 segment byte-for-byte without retroactively rejecting its current Problem", async () => {
        const profile = createProfile();
        profile.mathMainLevel = 25;
        profile.mathMaxUnlocked = 25;
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "legacy-v2-rapid-policy-boundary");
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected a legacy current gate");
        const legacyPlan = createExploreProblemPlanForSkill(
            fixture.state,
            gate,
            "large_number_unit",
            profile,
            { isReview: true, isMaintenanceCheck: false },
        );
        if (!legacyPlan) throw new Error("Expected a legacy high-load Problem");
        expect(isRapidLoopEligibleProblem(legacyPlan.problem)).toBe(false);
        const legacyAssignment = await reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: fixture.state.runId,
            gateId: gate.gateId,
            problemId: legacyPlan.problem.id,
            categoryId: legacyPlan.problem.categoryId,
            source: "due",
            isReview: true,
            isMaintenanceCheck: false,
            countsTowardReviewCap: true,
            affectsSrs: true,
            reservedAt: 115,
        });
        const legacyState = exploreReducer(fixture.state, {
            type: "SET_PROBLEM",
            problem: legacyPlan.problem,
            assignment: legacyAssignment,
            encounterId: legacyPlan.encounterId,
        });
        const legacyCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: fixture.revision,
            state: legacyState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 116,
        });

        await createAndReserveExploreProblemPlan(
            legacyState,
            legacyState.pendingProblem!,
            profile,
            { expectedCheckpointRevision: legacyCheckpoint.checkpointRevision },
        );
        const stored = await db.exploreRuns.get(fixture.state.runId);
        const newlyAdopted = stored?.learningSegments?.["0"];
        if (!stored || !newlyAdopted) throw new Error("Expected an adopted segment");
        const savedV2Segment: ExploreLearningSegment = {
            ...structuredClone(newlyAdopted),
            plannerVersion: "explore-learning-planner-v2",
        };
        stored.learningSegments = {
            ...stored.learningSegments,
            "0": savedV2Segment,
        };
        await db.exploreRuns.put(stored);

        const restored = await createAndReserveExploreProblemPlan(
            legacyState,
            legacyState.pendingProblem!,
            profile,
            { expectedCheckpointRevision: legacyCheckpoint.checkpointRevision },
        );

        expect(restored.problem).toEqual(legacyPlan.problem);
        expect(restored.assignment).toEqual(legacyAssignment);
        expect(restored.learningSegment).toEqual(savedV2Segment);
        expect((await db.exploreRuns.get(fixture.state.runId))?.learningSegments?.["0"])
            .toEqual(savedV2Segment);
    });

    it("adopts a legacy current Problem after one incorrect attempt before reserving later slots", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const fixture = await startRoutedRun(profile, "legacy-attempt-one-adoption");
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected a legacy current gate");
        const legacyPlan = createExploreProblemPlanForSkill(
            fixture.state,
            gate,
            "add_1d_1_bridge",
            profile,
            { isReview: false, isMaintenanceCheck: false },
        );
        if (!legacyPlan) throw new Error("Expected a compatible legacy Problem");
        const legacyAssignment = await reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: fixture.state.runId,
            gateId: gate.gateId,
            problemId: legacyPlan.problem.id,
            categoryId: legacyPlan.problem.categoryId,
            source: "main",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: true,
            reservedAt: 120,
        });
        const legacyState = exploreReducer(fixture.state, {
            type: "SET_PROBLEM",
            problem: legacyPlan.problem,
            assignment: legacyAssignment,
            encounterId: legacyPlan.encounterId,
        });
        const pendingCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: fixture.revision,
            state: legacyState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 121,
        });
        const incorrect = await commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: profile.id,
                runId: fixture.state.runId,
                gateId: gate.gateId,
                attemptNumber: 1,
            }),
            problem: {
                id: legacyPlan.problem.id,
                categoryId: legacyPlan.problem.categoryId,
            },
            result: "incorrect",
            committedAt: 122,
            expectedCheckpointRevision: pendingCheckpoint.checkpointRevision,
        });
        const legacyRetryState = (await db.exploreRuns.get(fixture.state.runId))
            ?.activeCheckpoint?.state;
        if (!legacyRetryState || incorrect.checkpointRevision === undefined) {
            throw new Error("Expected a saved legacy retry boundary");
        }
        expect(legacyRetryState.pendingProblem?.attemptCount).toBe(1);
        expect((await db.exploreRuns.get(fixture.state.runId))?.learningSegments)
            .toBeUndefined();

        const adopted = await createAndReserveExploreProblemPlan(
            legacyRetryState,
            legacyRetryState.pendingProblem!,
            profile,
            { expectedCheckpointRevision: incorrect.checkpointRevision },
        );
        const { segment } = await getOpeningSegment(fixture.state.runId);

        expect(segment.slots[0]?.attemptCount).toBe(1);
        expect(segment.slots[0]?.problem).toEqual(legacyPlan.problem);
        expect(segment.slots[0]?.assignment).toEqual(legacyAssignment);
        expect(segment.slots.slice(1)).toHaveLength(2);
        expect(adopted.problem).toEqual(legacyPlan.problem);
        expect(adopted.assignment).toEqual(legacyAssignment);
    });

    it("adopts a displayed legacy retry only when its reserved full Problem stays exact", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueSkills(profile.id, ["add_1d_2_bridge"]);
        const fixture = await startRoutedRun(profile, "legacy-displayed-retry-adoption");
        const gate = fixture.state.pendingProblem;
        if (!gate) throw new Error("Expected a legacy current gate");
        const legacyPlan = createExploreProblemPlanForSkill(
            fixture.state,
            gate,
            "add_1d_2_bridge",
            profile,
            { isReview: true, isMaintenanceCheck: false },
        );
        if (!legacyPlan) throw new Error("Expected a compatible legacy Problem");
        const legacyAssignment = await reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: fixture.state.runId,
            gateId: gate.gateId,
            problemId: legacyPlan.problem.id,
            categoryId: legacyPlan.problem.categoryId,
            source: "due",
            isReview: true,
            isMaintenanceCheck: false,
            countsTowardReviewCap: true,
            affectsSrs: true,
            reservedAt: 130,
        });
        const legacyState = exploreReducer(fixture.state, {
            type: "SET_PROBLEM",
            problem: legacyPlan.problem,
            assignment: legacyAssignment,
            encounterId: legacyPlan.encounterId,
        });
        const pendingCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: fixture.revision,
            state: legacyState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 131,
        });

        let checkpointRevision = pendingCheckpoint.checkpointRevision;
        for (const attemptNumber of [1, 2] as const) {
            const receipt = await commitExploreAttempt({
                identity: createAttemptIdentity({
                    profileId: profile.id,
                    runId: fixture.state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                }),
                problem: {
                    id: legacyPlan.problem.id,
                    categoryId: legacyPlan.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 131 + attemptNumber,
                expectedCheckpointRevision: checkpointRevision,
            });
            if (receipt.checkpointRevision === undefined) {
                throw new Error("Expected an incorrect-answer checkpoint");
            }
            checkpointRevision = receipt.checkpointRevision;
        }

        const committedState = (await db.exploreRuns.get(fixture.state.runId))
            ?.activeCheckpoint?.state;
        if (!committedState) throw new Error("Expected the second incorrect boundary");
        const refreshState = exploreReducer(committedState, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const refreshGate = refreshState.pendingProblem;
        if (!refreshGate) throw new Error("Expected a retry planning gate");
        const retry = await createAndReserveExploreProblemPlan(
            refreshState,
            refreshGate,
            profile,
            { expectedCheckpointRevision: checkpointRevision },
        );
        expect(retry.assignment.reservedProblem).toEqual(retry.problem);

        const displayedRetryState = exploreReducer(refreshState, {
            type: "SET_PROBLEM",
            problem: retry.problem,
            assignment: retry.assignment,
            encounterId: retry.encounterId,
        });
        const displayedRetryCheckpoint = await saveExploreRunCheckpoint({
            runId: fixture.state.runId,
            profileId: profile.id,
            expectedRevision: checkpointRevision,
            state: displayedRetryState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 134,
        });
        expect((await db.exploreRuns.get(fixture.state.runId))?.learningSegments)
            .toBeUndefined();

        const adopted = await createAndReserveExploreProblemPlan(
            displayedRetryState,
            displayedRetryState.pendingProblem!,
            profile,
            { expectedCheckpointRevision: displayedRetryCheckpoint.checkpointRevision },
        );
        const { segment } = await getOpeningSegment(fixture.state.runId);

        expect(segment.slots[0]?.attemptCount).toBe(2);
        expect(segment.slots[0]?.problem).toEqual(retry.problem);
        expect(segment.slots[0]?.encounterId).toBe(retry.encounterId);
        expect(segment.slots[0]?.assignment).toEqual(retry.assignment);
        expect(adopted.problem).toEqual(retry.problem);
        expect(adopted.assignment).toEqual(retry.assignment);
    });
});
