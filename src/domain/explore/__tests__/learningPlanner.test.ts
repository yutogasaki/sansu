import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryState, UserProfile } from "../../types";
import { DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID } from "../openingExperience";
import type { ExploreRunState } from "../types";
import { createAttemptIdentity } from '../attemptIdentity';

Object.assign(globalThis, { indexedDB, IDBKeyRange });

const { db } = await import("../../../db");
const { createInitialProfile } = await import("../../user/profile");
const {
    createInitialExploreState,
    exploreReducer,
    getAvailableExploreNodes,
} = await import("../reducer");
const {
    commitExploreAttempt,
    saveExploreRunCheckpoint,
    startExploreRun,
} = await import("../persistenceRepository");
const { createAndReserveExploreProblemPlan } = await import("../learningPlanner");

const createProfile = (): UserProfile => {
    const profile = createInitialProfile("Explore planner", 1, 7, 1, "math");
    profile.mathMainLevel = 8;
    profile.mathMaxUnlocked = 8;
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

const startRun = async (
    profile: UserProfile,
    seed: string,
): Promise<{ state: ExploreRunState; revision: number }> => {
    const state = {
        ...createInitialExploreState({ seed, now: 100 }),
        profileId: profile.id,
    };
    await startExploreRun({
        runId: state.runId,
        profileId: profile.id,
        seed: state.seed,
        startedAt: state.startedAt,
    });
    const target = getAvailableExploreNodes(state)[0];
    if (!target) throw new Error("Expected an opening explore node");
    let selected = exploreReducer(state, { type: "SELECT_NODE", nodeId: target.id });
    if (selected.pendingProblem?.actionType === "bridge") {
        selected = exploreReducer(selected, { type: "CHOOSE_BRIDGE", plan: "stones" });
    }
    const receipt = await saveExploreRunCheckpoint({
        runId: state.runId,
        profileId: profile.id,
        expectedRevision: 0,
        state: selected,
        openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
        savedAt: 101,
    });
    return { state: selected, revision: receipt.checkpointRevision };
};

const addDueMemory = async (profileId: string, skillId: string) => {
    const due: MemoryState = {
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
    };
    await db.memoryMath.put(due);
};

beforeEach(async () => {
    await db.open();
    for (const table of db.tables) await table.clear();
});

afterAll(async () => {
    await db.delete();
});
afterEach(() => vi.restoreAllMocks());

const reserveShownProblem = async (seed: string) => {
    const profile = createProfile();
    await persistProfile(profile);
    const { state, revision } = await startRun(profile, seed);
    const gate = state.pendingProblem!;
    const plan = await createAndReserveExploreProblemPlan(state, gate, profile, { expectedCheckpointRevision: revision });
    const shown = await saveExploreRunCheckpoint({
        runId: state.runId, profileId: profile.id, expectedRevision: revision,
        state: exploreReducer(state, { type: 'SET_PROBLEM', problem: plan.problem, assignment: plan.assignment, encounterId: plan.encounterId }),
        openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID, savedAt: 102,
    });
    return { profile, state, gate, plan, input: {
        identity: createAttemptIdentity({ profileId: profile.id, runId: state.runId, gateId: gate.gateId, attemptNumber: 1 }),
        problem: { id: plan.problem.id, categoryId: plan.problem.categoryId }, result: 'correct' as const,
        committedAt: Date.now(), expectedCheckpointRevision: shown.checkpointRevision,
    } };
};

describe("createAndReserveExploreProblemPlan", () => {
    it('counts a new frozen first whole answer once, including a receipt replay', async () => {
        const { profile, plan, input } = await reserveShownProblem('independent-first');
        expect(plan.assignment.learningEvidenceAssistance).toBe('independent');
        const [first, replay] = await Promise.all([commitExploreAttempt(input), commitExploreAttempt(input)]);
        expect(replay).toEqual(first);
        expect(await db.logs.count()).toBe(1);
        expect((await db.logs.toArray())[0].learningEvidence).toMatchObject({ assistance: 'independent',
            completion: 'whole-problem', problem: plan.problem.learningContext });
        expect(await db.memoryMath.get([profile.id, plan.problem.categoryId])).toMatchObject({
            totalAnswers: 1, correctAnswers: 1, independentCorrectAnswers: 1,
        });
    });

    it('keeps a real correction as raw success without independent progression after reload', async () => {
        const { profile, plan, input } = await reserveShownProblem('independent-correction');
        await commitExploreAttempt({ ...input, result: 'incorrect' });
        db.close(); await db.open();
        const checkpoint = (await db.exploreRuns.get(input.identity.runId))!.activeCheckpoint!;
        await commitExploreAttempt({ ...input,
            identity: createAttemptIdentity({ ...input.identity, attemptNumber: 2 }),
            committedAt: input.committedAt + 1000, expectedCheckpointRevision: checkpoint.revision,
        });
        expect((await db.logs.toArray()).map(log => [log.result, log.learningEvidence?.assistance]))
            .toEqual([['incorrect', 'independent'], ['correct', 'assisted']]);
        expect(await db.memoryMath.get([profile.id, plan.problem.categoryId])).toMatchObject({
            totalAnswers: 2, correctAnswers: 1, incorrectAnswers: 1, independentCorrectAnswers: 0,
            needsRelearning: true, strength: 1,
        });
    });

    it('does not enrich a legacy reservation even when its saved problem has a valid context', async () => {
        const { profile, plan, input } = await reserveShownProblem('legacy-evidence-unknown');
        const run = (await db.exploreRuns.get(input.identity.runId))!;
        delete run.learningAssignments![plan.problem.id].learningEvidenceAssistance;
        for (const segment of Object.values(run.learningSegments ?? {})) {
            for (const slot of segment.slots) if (slot.problem.id === plan.problem.id) delete slot.assignment.learningEvidenceAssistance;
        }
        delete run.activeCheckpoint!.state.pendingProblem!.learningAssignment!.learningEvidenceAssistance;
        await db.exploreRuns.put(run);
        const before = JSON.stringify(run.learningSegments);
        await commitExploreAttempt(input);
        expect((await db.logs.toArray())[0].learningEvidence).toBeUndefined();
        expect(await db.memoryMath.get([profile.id, plan.problem.categoryId])).toMatchObject({
            correctAnswers: 1, independentCorrectAnswers: 0,
        });
        expect(JSON.stringify((await db.exploreRuns.get(input.identity.runId))!.learningSegments)).toBe(before);
    });

    it('rolls back independent evidence with a failed durable event before retrying once', async () => {
        const { profile, plan, input } = await reserveShownProblem('independent-rollback');
        const before = await db.exploreRuns.get(input.identity.runId);
        const failure = vi.spyOn(db.exploreRunEvents, 'add').mockRejectedValueOnce(new Error('event write failed'));
        await expect(commitExploreAttempt(input)).rejects.toThrow('event write failed');
        failure.mockRestore();
        expect(await db.logs.count()).toBe(0);
        expect(await db.memoryMath.get([profile.id, plan.problem.categoryId])).toBeUndefined();
        expect(await db.exploreRuns.get(input.identity.runId)).toEqual(before);
        await commitExploreAttempt(input);
        expect((await db.memoryMath.get([profile.id, plan.problem.categoryId]))?.independentCorrectAnswers).toBe(1);
    });
    it("prioritizes a compatible Due skill and reserves an SRS assignment", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "add_1d_1_bridge");
        const { state, revision } = await startRun(profile, "due-reservation");
        const gate = state.pendingProblem!;

        const plan = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );

        expect(plan.problem.categoryId).toBe("add_1d_1_bridge");
        expect(plan.assignment).toMatchObject({
            problemId: plan.problem.id,
            categoryId: "add_1d_1_bridge",
            source: "due",
            isReview: true,
            countsTowardReviewCap: true,
            affectsSrs: true,
        });
        const storedRun = await db.exploreRuns.get(state.runId);
        expect(storedRun?.learningSegments?.["0"]?.slots).toHaveLength(3);
        expect(storedRun?.learningAssignments?.[plan.problem.id]).toEqual(plan.assignment);
    });

    it("uses a representation retry after two misses before other planner sources", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "add_1d_1");
        const { state, revision } = await startRun(profile, "representation-retry");
        const gate = state.pendingProblem!;

        const initialPlan = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );
        const problemCheckpoint = await saveExploreRunCheckpoint({
            runId: state.runId,
            profileId: profile.id,
            expectedRevision: revision,
            state: exploreReducer(state, {
                type: "SET_PROBLEM",
                problem: initialPlan.problem,
                assignment: initialPlan.assignment,
                encounterId: initialPlan.encounterId,
            }),
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 102,
        });
        let checkpoint = (await db.exploreRuns.get(state.runId))!.activeCheckpoint!;
        for (const attemptNumber of [1, 2] as const) {
            await commitExploreAttempt({
                identity: {
                    profileId: profile.id,
                    runId: state.runId,
                    gateId: gate.gateId,
                    attemptNumber,
                },
                problem: {
                    id: initialPlan.problem.id,
                    categoryId: initialPlan.problem.categoryId,
                },
                result: "incorrect",
                committedAt: 102 + attemptNumber,
                expectedCheckpointRevision: attemptNumber === 1
                    ? problemCheckpoint.checkpointRevision
                    : checkpoint.revision,
            });
            checkpoint = (await db.exploreRuns.get(state.runId))!.activeCheckpoint!;
        }
        const retryState = exploreReducer(checkpoint.state, {
            type: "ADVANCE_AFTER_INCORRECT",
        });
        const retryGate = retryState.pendingProblem!;
        const plan = await createAndReserveExploreProblemPlan(
            retryState,
            retryGate,
            profile,
            { expectedCheckpointRevision: checkpoint.revision },
        );

        expect(plan.problem.categoryId).toBe("add_1d_1_bridge");
        expect(plan.assignment).toMatchObject({
            source: "representation-retry",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: true,
            learningEvidenceAssistance: 'assisted',
        });
        const shown = await saveExploreRunCheckpoint({
            runId: state.runId, profileId: profile.id, expectedRevision: checkpoint.revision,
            state: exploreReducer(retryState, { type: 'SET_PROBLEM', problem: plan.problem,
                assignment: plan.assignment, encounterId: plan.encounterId }),
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID, savedAt: 105,
        });
        await commitExploreAttempt({
            identity: createAttemptIdentity({ profileId: profile.id, runId: state.runId, gateId: retryGate.gateId, attemptNumber: 3 }),
            problem: { id: plan.problem.id, categoryId: plan.problem.categoryId }, result: 'correct',
            committedAt: 106, expectedCheckpointRevision: shown.checkpointRevision,
        });
        expect((await db.logs.toArray()).at(-1)?.learningEvidence?.assistance).toBe('assisted');
        expect((await db.memoryMath.get([profile.id, plan.problem.categoryId]))?.independentCorrectAnswers).toBe(0);
    });

    it("restores the existing assignment and deterministic problem on the same problem id", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        const { state, revision } = await startRun(profile, "reservation-replay");
        const gate = state.pendingProblem!;

        const first = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );
        const second = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );
        const storedRun = await db.exploreRuns.get(state.runId);

        expect(second).toEqual(first);
        expect(Object.keys(storedRun?.learningAssignments ?? {})).toHaveLength(3);
    });

    it("keeps an encounter from replacing the category already selected by Due", async () => {
        const profile = createProfile();
        await persistProfile(profile);
        await addDueMemory(profile.id, "count_10");
        const { state, revision } = await startRun(profile, "encounter-does-not-replan");
        const gate = state.pendingProblem!;

        const plan = await createAndReserveExploreProblemPlan(
            state,
            gate,
            profile,
            { expectedCheckpointRevision: revision },
        );

        expect(plan.assignment).toMatchObject({
            categoryId: "count_10",
            source: "due",
            affectsSrs: true,
        });
        expect(plan.problem.categoryId).toBe(plan.assignment.categoryId);
        expect(plan.problem.categoryId).not.toMatch(/^add_/);
        expect(plan.encounterId).toBeUndefined();
    });
});
