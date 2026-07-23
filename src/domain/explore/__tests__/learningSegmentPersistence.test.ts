import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { DexieOptions } from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { SansuDatabase } from "../../../db";
import type { Problem, UserProfile } from "../../types";
import { createAttemptIdentity } from "../attemptIdentity";
import { createExploreLearningAssignment } from "../learningAssignment";
import {
    projectExploreLearningSegmentGates,
    type ExploreLearningSegmentGateProjection,
} from "../learningSegment";
import {
    createExplorePersistenceRepository,
    ExplorePersistenceConflictError,
} from "../persistenceRepository";
import type {
    ExploreLearningSegment,
    ExploreLearningSegmentSlot,
    ExploreRunRecord,
} from "../persistenceTypes";
import { createExploreActiveCheckpoint } from "../runCheckpoint";
import { exploreReducer } from "../reducer";
import type { ExploreNode, ExploreRunState } from "../types";

const indexedDbOptions: DexieOptions = { indexedDB, IDBKeyRange };
let database: SansuDatabase | undefined;
let databaseSequence = 0;

const profile: UserProfile = {
    id: "profile-1",
    name: "profile-1",
    grade: 1,
    mathStartLevel: 8,
    vocabStartLevel: 1,
    subjectMode: "math",
    soundEnabled: false,
    mathMainLevel: 8,
    mathMaxUnlocked: 8,
    vocabMainLevel: 1,
    vocabMaxUnlocked: 1,
    mathSkills: {},
    vocabWords: {},
    streak: 0,
    todayCount: 0,
};

const createNode = (id: string, depth: number): ExploreNode => ({
    id,
    depth,
    lane: 0,
    x: 50,
    y: 90 - depth * 10,
    kind: depth === 0 ? "start" : "soil",
    title: id,
    hint: id,
});

const createState = (): ExploreRunState => ({
    runId: "run-1",
    profileId: profile.id,
    seed: "run-seed",
    status: "active",
    startedAt: 100,
    currentNodeId: "start",
    energy: 12,
    maxEnergy: 12,
    combo: 0,
    steps: 0,
    incorrectAnswers: 0,
    nodes: [
        createNode("start", 0),
        createNode("q1", 1),
        createNode("q2", 2),
        createNode("q3", 3),
    ],
    edges: [
        { id: "start-q1", from: "start", to: "q1" },
        { id: "q1-q2", from: "q1", to: "q2" },
        { id: "q2-q3", from: "q2", to: "q3" },
    ],
    openedNodeIds: ["start"],
    temporaryFinds: [],
    confirmedFinds: [],
    attempts: [],
    committedAttemptKeys: [],
    pendingProblem: {
        gateId: "run-1:q1",
        nodeId: "q1",
        actionType: "dig",
        attemptCount: 0,
    },
    lastEvent: { type: "node-selected", nodeId: "q1" },
    rescuePending: false,
    config: {
        maxEnergy: 12,
        correctEnergyCost: 1,
        incorrectEnergyCost: 1,
    },
});

const createProblem = (gateId: string, index: number): Problem => ({
    id: `${gateId}:attempt-0`,
    subject: "math",
    categoryId: "add_1d_1_bridge",
    questionText: `${index + 1} + 1`,
    questionVisual: {
        kind: "addition-items",
        prompt: "あわせると？",
        groups: [
            { emoji: "●", label: "ひかり", count: index + 1 },
            { emoji: "●", label: "ひかり", count: 1 },
        ],
    },
    inputType: "number",
    inputConfig: { fields: [{ label: "こたえ", length: 2 }] },
    correctAnswer: String(index + 2),
    displayAnswer: String(index + 2),
    isReview: false,
    isMaintenanceCheck: false,
});

const createSegment = (
    projection: ExploreLearningSegmentGateProjection,
    plannedAt = 150,
): ExploreLearningSegment => {
    const slots: ExploreLearningSegmentSlot[] = projection.slots.map(({ step, gate }, index) => {
        const problem = createProblem(gate.gateId, index);
        const assignment = createExploreLearningAssignment({
            profileId: profile.id,
            runId: "run-1",
            gateId: gate.gateId,
            problemId: problem.id,
            categoryId: problem.categoryId,
            source: "main",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: true,
            reservedAt: plannedAt + index,
        });
        return {
            step,
            slotIndex: step - projection.startStep,
            sequenceOrdinal: step,
            gateId: gate.gateId,
            nodeId: gate.nodeId,
            actionType: gate.actionType,
            attemptCount: gate.attemptCount,
            bridgePlan: gate.bridgePlan,
            problem,
            assignment,
        };
    });
    return {
        schemaVersion: 1,
        segmentId: projection.segmentId,
        segmentKey: projection.segmentKey,
        startStep: projection.startStep,
        endStepExclusive: projection.endStepExclusive,
        plannedFromStep: projection.plannedFromStep,
        plannerVersion: "planner-v1",
        generatorVersion: "generator-v1",
        seed: "segment-seed",
        profileSnapshot: { mathMainLevel: 8, mathMaxUnlocked: 8 },
        plannedAt,
        slots,
    };
};

const setup = async () => {
    database = new SansuDatabase(
        `segment-persistence-${Date.now()}-${databaseSequence += 1}`,
        indexedDbOptions,
    );
    await database.open();
    await database.profiles.put(profile);
    const repository = createExplorePersistenceRepository(database);
    const state = createState();
    const projection = projectExploreLearningSegmentGates(state);
    if (!projection) throw new Error("fixture projection failed");
    const run = await repository.startExploreRun({
        runId: state.runId,
        profileId: profile.id,
        seed: state.seed,
        startedAt: state.startedAt,
        activeCheckpoint: createExploreActiveCheckpoint({ state, updatedAt: 100 }),
    });
    return { database, projection, repository, run, state };
};

const reserveInput = (
    segment: ExploreLearningSegment,
    revision = 0,
) => ({
    runId: "run-1",
    profileId: profile.id,
    expectedCheckpointRevision: revision,
    expectedStartStep: segment.plannedFromStep,
    expectedStartGateId: segment.slots[0].gateId,
    segment,
});

afterEach(async () => {
    if (database) await database.delete();
    database = undefined;
});

describe("reserveExploreLearningSegment", () => {
    it("persists every full Problem and assignment without touching learning state", async () => {
        const { database: db, projection, repository } = await setup();
        const segment = createSegment(projection);
        const profileBefore = await db.profiles.get(profile.id);
        const logCountBefore = await db.logs.count();
        const memoryCountBefore = await db.memoryMath.count();

        const receipt = await repository.reserveExploreLearningSegment(reserveInput(segment));
        const stored = await db.exploreRuns.get("run-1");

        expect(receipt).toEqual(segment);
        expect(stored?.learningSegments?.["0"]).toEqual(segment);
        expect(stored?.learningSegments?.["0"]?.slots[0].problem).toEqual(
            segment.slots[0].problem,
        );
        expect(Object.keys(stored?.learningAssignments || {})).toHaveLength(3);
        expect(await db.profiles.get(profile.id)).toEqual(profileBefore);
        expect(await db.logs.count()).toBe(logCountBefore);
        expect(await db.memoryMath.count()).toBe(memoryCountBefore);
    });

    it("returns the first writer for parallel semantic resends with new timestamps", async () => {
        const { database: db, projection, repository } = await setup();
        const first = createSegment(projection, 150);
        const later = createSegment(projection, 900);

        const receipts = await Promise.all([
            repository.reserveExploreLearningSegment(reserveInput(first)),
            repository.reserveExploreLearningSegment(reserveInput(later)),
            repository.reserveExploreLearningSegment(reserveInput(later)),
        ]);

        expect(receipts).toEqual([first, first, first]);
        expect((await db.exploreRuns.get("run-1"))?.learningSegments?.["0"]).toEqual(first);
    });

    it("rolls back the whole segment when any assignment conflicts", async () => {
        const { database: db, projection, repository } = await setup();
        const segment = createSegment(projection);
        const second = segment.slots[1];
        await repository.reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: "run-1",
            gateId: second.gateId,
            problemId: second.problem.id,
            categoryId: second.problem.categoryId,
            source: "game-only-fallback",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: false,
            reservedAt: 140,
        });

        await expect(repository.reserveExploreLearningSegment(reserveInput(segment)))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        const stored = await db.exploreRuns.get("run-1");
        expect(stored?.learningSegments).toBeUndefined();
        expect(stored?.learningAssignments?.[segment.slots[0].problem.id]).toBeUndefined();
        expect(stored?.learningAssignments?.[second.problem.id]?.source)
            .toBe("game-only-fallback");
        expect(stored?.learningAssignments?.[segment.slots[2].problem.id]).toBeUndefined();
    });

    it("rejects a slot whose reserved full Problem differs from the segment Problem", async () => {
        const { database: db, projection, repository } = await setup();
        const segment = createSegment(projection);
        const first = segment.slots[0];
        first.assignment = createExploreLearningAssignment({
            profileId: first.assignment.profileId,
            runId: first.assignment.runId,
            gateId: first.assignment.gateId,
            problemId: first.assignment.problemId,
            categoryId: first.assignment.categoryId,
            source: first.assignment.source,
            isReview: first.assignment.isReview,
            isMaintenanceCheck: first.assignment.isMaintenanceCheck,
            countsTowardReviewCap: first.assignment.countsTowardReviewCap,
            affectsSrs: first.assignment.affectsSrs,
            reservedAt: first.assignment.reservedAt,
            reservedProblem: {
                ...first.problem,
                correctAnswer: "999",
            },
            reservedEncounterId: first.encounterId,
        });

        await expect(repository.reserveExploreLearningSegment(reserveInput(segment)))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        const stored = await db.exploreRuns.get("run-1");
        expect(stored?.learningSegments).toBeUndefined();
        expect(stored?.learningAssignments).toEqual({});
    });

    it("reserves only the remaining slots for a legacy mid-segment checkpoint", async () => {
        const { database: db, repository, state } = await setup();
        const firstProblem = createProblem("run-1:q1", 0);
        const firstAssignment = await repository.reserveExploreLearningAssignment({
            profileId: profile.id,
            runId: "run-1",
            gateId: "run-1:q1",
            problemId: firstProblem.id,
            categoryId: firstProblem.categoryId,
            source: "game-only-fallback",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: false,
            reservedAt: 120,
        });
        const answerable = exploreReducer(state, {
            type: "SET_PROBLEM",
            problem: firstProblem,
            assignment: firstAssignment,
            encounterId: undefined,
        });
        await repository.saveExploreRunCheckpoint({
            runId: "run-1",
            profileId: profile.id,
            expectedRevision: 0,
            state: answerable,
            openingExperienceId: "classic-v1",
            savedAt: 130,
        });
        await repository.commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: profile.id,
                runId: "run-1",
                gateId: "run-1:q1",
                attemptNumber: 1,
            }),
            problem: firstProblem,
            result: "correct",
            committedAt: 140,
            expectedCheckpointRevision: 1,
        });
        const committed = (await db.exploreRuns.get("run-1"))?.activeCheckpoint;
        expect(committed?.revision).toBe(2);
        expect(committed?.state.steps).toBe(1);
        expect(committed?.state.pendingProblem).toBeUndefined();

        const routed = exploreReducer(committed!.state, { type: "SELECT_NODE", nodeId: "q2" });
        const projection = projectExploreLearningSegmentGates(routed);
        if (!projection) throw new Error("partial fixture projection failed");
        const segment = createSegment(projection, 160);

        const receipt = await repository.reserveExploreLearningSegment(reserveInput(segment, 2));
        const stored = await db.exploreRuns.get("run-1");
        expect(receipt.plannedFromStep).toBe(1);
        expect(receipt.slots.map((slot) => slot.step)).toEqual([1, 2]);
        expect(stored?.learningSegments?.["0"]?.slots).toHaveLength(2);
        expect(stored?.learningAssignments?.[firstProblem.id]).toEqual(firstAssignment);
    });

    it("rejects stale boundaries and immutable content or policy conflicts", async () => {
        const { projection, repository } = await setup();
        const segment = createSegment(projection);

        await expect(repository.reserveExploreLearningSegment(reserveInput(segment, 1)))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(repository.reserveExploreLearningSegment({
            ...reserveInput(segment),
            expectedStartGateId: "run-1:wrong",
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await repository.reserveExploreLearningSegment(reserveInput(segment));
        const changedProblem = structuredClone(segment);
        changedProblem.plannedAt += 100;
        changedProblem.slots[0].assignment.reservedAt += 100;
        changedProblem.slots[0].problem.questionText = "999 + 999";
        await expect(repository.reserveExploreLearningSegment(reserveInput(changedProblem)))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        const invalidPolicy = structuredClone(segment);
        invalidPolicy.slots[0].assignment.affectsSrs = false;
        await expect(repository.reserveExploreLearningSegment(reserveInput(invalidPolicy)))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
    });

    it("fails resume when the checkpoint Problem and stored segment diverge", async () => {
        const { database: db, projection, repository, state } = await setup();
        const segment = createSegment(projection);
        await repository.reserveExploreLearningSegment(reserveInput(segment));
        const first = segment.slots[0];
        const checkpointState = exploreReducer(state, {
            type: "SET_PROBLEM",
            problem: first.problem,
            assignment: first.assignment,
            encounterId: first.encounterId,
        });
        await repository.saveExploreRunCheckpoint({
            runId: "run-1",
            profileId: profile.id,
            expectedRevision: 0,
            state: checkpointState,
            openingExperienceId: "classic-v1",
            savedAt: 200,
        });
        const stored = await db.exploreRuns.get("run-1") as ExploreRunRecord;
        const corrupted = structuredClone(stored);
        corrupted.learningSegments!["0"]!.slots[0].problem.questionText = "corrupted";
        await db.exploreRuns.put(corrupted);

        await expect(repository.getResumableExploreRun(profile.id))
            .rejects.toThrow("learning segment slot");
    });
});
