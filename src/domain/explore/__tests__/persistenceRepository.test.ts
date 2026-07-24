import Dexie, { type DexieOptions } from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    SANSU_V4_STORES,
    SansuDatabase,
    type AttemptLog,
} from "../../../db";
import type { AppData, MemoryState, UserProfile } from "../../types";
import { deleteProfileOwnedIndexedDbRows } from "../../user/repository";
import { createAttemptIdentity } from "../attemptIdentity";
import { createExploreLearningAssignment } from "../learningAssignment";
import { DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID } from "../openingExperience";
import {
    createExplorePersistenceRepository,
    ExplorePersistenceConflictError,
    type ExplorePersistenceRepository,
} from "../persistenceRepository";
import type {
    ExploreLearningSource,
    ReserveExploreLearningAssignmentInput,
} from "../persistenceTypes";
import { exploreReducer, createInitialExploreState, getAvailableExploreNodes } from "../reducer";
import { createExploreActiveCheckpoint } from "../runCheckpoint";
import { getLearningDayStart, toLocaleDateKey } from "../../../utils/learningDay";

const indexedDbOptions: DexieOptions = { indexedDB, IDBKeyRange };
let databaseSequence = 0;
let database: SansuDatabase | undefined;

const createDatabaseName = (label: string) => (
    `SansuDatabase-${label}-${Date.now()}-${databaseSequence += 1}`
);

const openVersion5Database = async (label: string) => {
    database = new SansuDatabase(createDatabaseName(label), indexedDbOptions);
    await database.open();
    return database;
};

const profile = (id: string): UserProfile => ({
    id,
    name: id,
    grade: 1,
    mathStartLevel: 8,
    vocabStartLevel: 1,
    subjectMode: "math",
    soundEnabled: false,
    mathMainLevel: 8,
    mathMaxUnlocked: 8,
    vocabMainLevel: 1,
    vocabMaxUnlocked: 1,
    mathLevels: [{
        level: 8,
        unlocked: true,
        enabled: true,
        recentAnswersNonReview: [],
    }],
    mathSkills: {},
    vocabWords: {},
    streak: 0,
    todayCount: 0,
});

const memory = (profileId: string, id: string): MemoryState => ({
    profileId,
    id,
    strength: 2,
    nextReview: "2026-07-21T00:00:00.000Z",
    totalAnswers: 3,
    correctAnswers: 2,
    incorrectAnswers: 1,
    skippedAnswers: 0,
    updatedAt: "2026-07-19T00:00:00.000Z",
    status: "active",
});

const commitInput = (
    runId: string,
    profileId = "profile-1",
    gateId = "gate-1",
    problemId = "problem-1",
    categoryId = "add_1d_1_bridge",
) => ({
    identity: createAttemptIdentity({
        profileId,
        runId,
        gateId,
        attemptNumber: 1,
    }),
    problem: { id: problemId, categoryId },
    result: "correct" as const,
    committedAt: 200,
});

const reserveInput = (
    runId: string,
    profileId = "profile-1",
    gateId = "gate-1",
    problemId = "problem-1",
    categoryId = "add_1d_1_bridge",
    source: ExploreLearningSource = "game-only-fallback",
): ReserveExploreLearningAssignmentInput => ({
    runId,
    profileId,
    gateId,
    problemId,
    categoryId,
    source,
    isReview: source === "due",
    isMaintenanceCheck: source === "maintenance",
    countsTowardReviewCap: source === "due" || source === "maintenance",
    affectsSrs: source !== "game-only-fallback",
    reservedAt: 150,
});

const reserveAssignment = (
    repository: ExplorePersistenceRepository,
    input: ReserveExploreLearningAssignmentInput,
) => repository.reserveExploreLearningAssignment(input);

const createCheckpointPendingProblem = async (
    repository: ExplorePersistenceRepository,
    runId: string,
    state: NonNullable<Awaited<ReturnType<ExplorePersistenceRepository["startExploreRun"]>>["activeCheckpoint"]>["state"],
) => {
    const node = getAvailableExploreNodes(state)[0];
    const selected = exploreReducer(state, { type: "SELECT_NODE", nodeId: node.id });
    const gate = selected.pendingProblem!;
    const problem = {
        id: `${gate.gateId}:attempt-0`,
        subject: "math" as const,
        categoryId: "add_1d_1_bridge",
        questionText: "1 + 1",
        inputType: "number" as const,
        correctAnswer: "2",
        isReview: false,
    };
    const assignment = await reserveAssignment(repository, reserveInput(
        runId,
        state.profileId,
        gate.gateId,
        problem.id,
        problem.categoryId,
    ));
    // Keep this explicit construction aligned with the persisted assignment;
    // it catches accidental mutation of assignment identity in the fixture.
    expect(assignment).toEqual(createExploreLearningAssignment({
        ...reserveInput(
            runId,
            state.profileId,
            gate.gateId,
            problem.id,
            problem.categoryId,
        ),
    }));
    const pending = exploreReducer(selected, {
        type: "SET_PROBLEM",
        problem,
        assignment,
        encounterId: undefined,
    });
    return { assignment, gate, pending, problem };
};

afterEach(async () => {
    if (database) {
        await database.delete();
        database = undefined;
    }
});

describe("SansuDatabase version 5 migration", () => {
    it("keeps every representative version 4 row while adding empty explore stores", async () => {
        const databaseName = createDatabaseName("migration");
        const legacy = new Dexie(databaseName, indexedDbOptions);
        legacy.version(4).stores(SANSU_V4_STORES);
        await legacy.open();

        const legacyProfile = profile("legacy-profile");
        const legacyLog: AttemptLog = {
            id: 1,
            profileId: legacyProfile.id,
            subject: "math",
            itemId: "add_1d_1",
            result: "correct",
            timestamp: "2026-07-19T00:00:00.000Z",
        };
        const legacyMath = memory(legacyProfile.id, "add_1d_1");
        const legacyVocab = { ...memory(legacyProfile.id, "apple"), status: undefined };
        const legacyAppData: AppData & { id: string } = {
            id: "app",
            schemaVersion: 1,
            activeProfileId: legacyProfile.id,
            profiles: { [legacyProfile.id]: legacyProfile },
        };

        await legacy.transaction(
            "rw",
            legacy.table("profiles"),
            legacy.table("logs"),
            legacy.table("memoryMath"),
            legacy.table("memoryVocab"),
            legacy.table("appData"),
            async () => {
                await legacy.table("profiles").put(legacyProfile);
                await legacy.table("logs").put(legacyLog);
                await legacy.table("memoryMath").put(legacyMath);
                await legacy.table("memoryVocab").put(legacyVocab);
                await legacy.table("appData").put(legacyAppData);
            },
        );
        legacy.close();

        database = new SansuDatabase(databaseName, indexedDbOptions);
        await database.open();

        expect(database.verno).toBe(5);
        await expect(database.profiles.get(legacyProfile.id)).resolves.toEqual(legacyProfile);
        await expect(database.logs.get(1)).resolves.toEqual(legacyLog);
        await expect(database.memoryMath.get([legacyProfile.id, legacyMath.id]))
            .resolves.toEqual(legacyMath);
        await expect(database.memoryVocab.get([legacyProfile.id, legacyVocab.id]))
            .resolves.toEqual(legacyVocab);
        await expect(database.appData.get("app")).resolves.toEqual(legacyAppData);
        await expect(database.exploreRuns.count()).resolves.toBe(0);
        await expect(database.exploreRunEvents.count()).resolves.toBe(0);
        await expect(database.exploreDiscoveries.count()).resolves.toBe(0);
    });
});

describe("exploration persistence repository", () => {
    it("does not leave an assignment when a timed-out reservation is aborted", async () => {
        const testDatabase = await openVersion5Database("reservation-abort");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const controller = new AbortController();
        controller.abort(new Error("interaction deadline"));

        await expect(repository.reserveExploreLearningAssignment(
            reserveInput("run-1"),
            { signal: controller.signal },
        )).rejects.toThrow("interaction deadline");
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ learningAssignments: {} }),
        );
    });

    it("rolls back an assignment when cancellation arrives during its update", async () => {
        const testDatabase = await openVersion5Database("reservation-in-flight-abort");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const controller = new AbortController();
        const originalUpdate = testDatabase.exploreRuns.update.bind(testDatabase.exploreRuns);
        vi.spyOn(testDatabase.exploreRuns, "update").mockImplementation(async (key, changes) => {
            const updated = await originalUpdate(key, changes);
            controller.abort(new Error("interaction deadline during update"));
            return updated;
        });

        await expect(repository.reserveExploreLearningAssignment(
            reserveInput("run-1"),
            { signal: controller.signal },
        )).rejects.toThrow("interaction deadline during update");
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ learningAssignments: {} }),
        );
    });

    it("starts a run and its event atomically without touching learning stores", async () => {
        const testDatabase = await openVersion5Database("start");
        const expectedProfile = profile("profile-1");
        await testDatabase.profiles.add(expectedProfile);
        const repository = createExplorePersistenceRepository(testDatabase);

        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: expectedProfile.id,
            seed: "seed-1",
            startedAt: 100,
        });

        await expect(testDatabase.exploreRuns.get(run.runId)).resolves.toEqual(run);
        await expect(testDatabase.exploreRunEvents.toArray()).resolves.toEqual([
            expect.objectContaining({
                profileId: expectedProfile.id,
                runId: run.runId,
                type: "run_started",
                payload: { seed: "seed-1" },
            }),
        ]);
        await expect(testDatabase.logs.count()).resolves.toBe(0);
        await expect(testDatabase.memoryMath.count()).resolves.toBe(0);
        await expect(testDatabase.memoryVocab.count()).resolves.toBe(0);
        await expect(testDatabase.profiles.get(expectedProfile.id)).resolves.toEqual(expectedProfile);
    });

    it("returns the existing run for the same start data without duplicating its event", async () => {
        const testDatabase = await openVersion5Database("start-idempotency");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const input = {
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        };

        const first = await repository.startExploreRun(input);
        const second = await repository.startExploreRun(input);

        expect(second).toEqual(first);
        await expect(testDatabase.exploreRuns.count()).resolves.toBe(1);
        await expect(testDatabase.exploreRunEvents.where("type").equals("run_started").count())
            .resolves.toBe(1);
    });

    it.each([
        ["profile", { profileId: "profile-2" }],
        ["seed", { seed: "seed-2" }],
        ["startedAt", { startedAt: 101 }],
    ] as const)("rejects the same runId with conflicting %s data", async (_label, change) => {
        const testDatabase = await openVersion5Database("start-conflict");
        await testDatabase.profiles.bulkAdd([profile("profile-1"), profile("profile-2")]);
        const repository = createExplorePersistenceRepository(testDatabase);
        const input = {
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        };
        await repository.startExploreRun(input);

        await expect(repository.startExploreRun({ ...input, ...change }))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await expect(testDatabase.exploreRuns.count()).resolves.toBe(1);
        await expect(testDatabase.exploreRunEvents.where("type").equals("run_started").count())
            .resolves.toBe(1);
    });

    it("commits one answer event and run aggregate, using the generated problem category", async () => {
        const testDatabase = await openVersion5Database("commit");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));

        const receipt = await repository.commitExploreAttempt(commitInput("run-1"));

        expect(receipt).toEqual(expect.objectContaining({
            recordedSkillId: "add_1d_1_bridge",
            result: "correct",
            affectsSrs: false,
            committedAt: 200,
        }));
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                problemsAnswered: 1,
                correctCount: 1,
                incorrectCount: 0,
                skippedCount: 0,
                updatedAt: 200,
            }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").first())
            .resolves.toEqual(expect.objectContaining({
                attemptKey: receipt.attemptKey,
                recordedSkillId: "add_1d_1_bridge",
                affectsSrs: false,
            }));
        await expect(testDatabase.logs.count()).resolves.toBe(0);
        await expect(testDatabase.memoryMath.count()).resolves.toBe(0);
        await expect(testDatabase.memoryVocab.count()).resolves.toBe(0);
    });

    it("atomically commits a reserved learning answer to explore and learning state", async () => {
        const testDatabase = await openVersion5Database("learning-commit");
        const expectedProfile = profile("profile-1");
        await testDatabase.profiles.add(expectedProfile);
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: expectedProfile.id,
            seed: "seed-1",
            startedAt: 100,
        });
        const assignment = await reserveAssignment(
            repository,
            reserveInput("run-1", expectedProfile.id, "gate-1", "problem-1", undefined, "main"),
        );

        const receipt = await repository.commitExploreAttempt({
            ...commitInput("run-1"),
            timeMs: 840,
        });

        expect(receipt).toEqual(expect.objectContaining({
            recordedSkillId: "add_1d_1_bridge",
            result: "correct",
            affectsSrs: true,
            assignmentKey: assignment.assignmentKey,
            learningSource: "main",
            learningLogId: expect.any(Number),
        }));
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                problemsAnswered: 1,
                correctCount: 1,
                incorrectCount: 0,
                skippedCount: 0,
            }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").first())
            .resolves.toEqual(expect.objectContaining({
                assignmentKey: assignment.assignmentKey,
                learningSource: "main",
                affectsSrs: true,
                learningLogId: receipt.learningLogId,
            }));
        await expect(testDatabase.logs.toArray()).resolves.toEqual([
            expect.objectContaining({
                id: receipt.learningLogId,
                profileId: expectedProfile.id,
                subject: "math",
                itemId: "add_1d_1_bridge",
                result: "correct",
                isReview: false,
                timestamp: new Date(200).toISOString(),
                timeMs: 840,
            }),
        ]);
        await expect(testDatabase.memoryMath.get([
            expectedProfile.id,
            "add_1d_1_bridge",
        ])).resolves.toEqual(expect.objectContaining({
            profileId: expectedProfile.id,
            id: "add_1d_1_bridge",
            strength: 2,
            totalAnswers: 1,
            correctAnswers: 1,
            incorrectAnswers: 0,
            skippedAnswers: 0,
            status: "active",
        }));
        await expect(testDatabase.memoryVocab.count()).resolves.toBe(0);

        const storedProfile = await testDatabase.profiles.get(expectedProfile.id);
        expect(storedProfile).toEqual(expect.objectContaining({
            streak: 1,
            todayCount: 1,
            lastStudyDate: toLocaleDateKey(getLearningDayStart()),
            recentAttempts: [expect.objectContaining({
                id: receipt.learningLogId?.toString(),
                subject: "math",
                skillId: "add_1d_1_bridge",
                result: "correct",
                timeMs: 840,
            })],
            mathSkills: expect.objectContaining({
                add_1d_1_bridge: expect.objectContaining({ totalAnswers: 1 }),
            }),
        }));
        expect(storedProfile?.mathLevels?.find((level) => level.level === 8))
            .toEqual(expect.objectContaining({ recentAnswersNonReview: [true] }));
        await expect(testDatabase.appData.get("app")).resolves.toEqual(
            expect.objectContaining({
                activeProfileId: expectedProfile.id,
                profiles: expect.objectContaining({
                    [expectedProfile.id]: expect.objectContaining({
                        todayCount: 1,
                        streak: 1,
                    }),
                }),
            }),
        );
    });

    it("does not duplicate learning state for a sequential learning resend", async () => {
        const testDatabase = await openVersion5Database("learning-sequential-idempotency");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(
            repository,
            reserveInput("run-1", "profile-1", "gate-1", "problem-1", undefined, "main"),
        );
        const input = commitInput("run-1");

        const first = await repository.commitExploreAttempt(input);
        const second = await repository.commitExploreAttempt({ ...input, committedAt: 999 });

        expect(second).toEqual(first);
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(1);
        await expect(testDatabase.logs.count()).resolves.toBe(1);
        await expect(testDatabase.memoryMath.get(["profile-1", "add_1d_1_bridge"]))
            .resolves.toEqual(expect.objectContaining({ totalAnswers: 1, correctAnswers: 1 }));
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ problemsAnswered: 1, correctCount: 1 }),
        );
        await expect(testDatabase.profiles.get("profile-1")).resolves.toEqual(
            expect.objectContaining({
                streak: 1,
                todayCount: 1,
                recentAttempts: [expect.objectContaining({
                    id: first.learningLogId?.toString(),
                })],
                mathLevels: [expect.objectContaining({
                    level: 8,
                    recentAnswersNonReview: [true],
                })],
            }),
        );
        await expect(testDatabase.appData.get("app")).resolves.toEqual(
            expect.objectContaining({
                profiles: expect.objectContaining({
                    "profile-1": expect.objectContaining({
                        todayCount: 1,
                        streak: 1,
                        recentAttempts: [expect.objectContaining({
                            id: first.learningLogId?.toString(),
                        })],
                    }),
                }),
            }),
        );
    });

    it("does not duplicate learning state for concurrent learning resends", async () => {
        const testDatabase = await openVersion5Database("learning-parallel-idempotency");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(
            repository,
            reserveInput("run-1", "profile-1", "gate-1", "problem-1", undefined, "main"),
        );
        const input = commitInput("run-1");
        const secondConnection = new SansuDatabase(testDatabase.name, indexedDbOptions);
        await secondConnection.open();
        const secondRepository = createExplorePersistenceRepository(secondConnection);

        const receipts = await (async () => {
            try {
                return await Promise.all(
                    Array.from({ length: 6 }, (_, index) => (
                        index % 2 === 0 ? repository : secondRepository
                    ).commitExploreAttempt(input)),
                );
            } finally {
                secondConnection.close();
            }
        })();

        receipts.forEach((receipt) => expect(receipt).toEqual(receipts[0]));
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(1);
        await expect(testDatabase.logs.count()).resolves.toBe(1);
        await expect(testDatabase.memoryMath.get(["profile-1", "add_1d_1_bridge"]))
            .resolves.toEqual(expect.objectContaining({ totalAnswers: 1, correctAnswers: 1 }));
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ problemsAnswered: 1, correctCount: 1 }),
        );
        await expect(testDatabase.profiles.get("profile-1")).resolves.toEqual(
            expect.objectContaining({
                streak: 1,
                todayCount: 1,
                recentAttempts: [expect.objectContaining({
                    id: receipts[0].learningLogId?.toString(),
                })],
                mathLevels: [expect.objectContaining({
                    level: 8,
                    recentAnswersNonReview: [true],
                })],
            }),
        );
        await expect(testDatabase.appData.get("app")).resolves.toEqual(
            expect.objectContaining({
                profiles: expect.objectContaining({
                    "profile-1": expect.objectContaining({
                        todayCount: 1,
                        streak: 1,
                        recentAttempts: [expect.objectContaining({
                            id: receipts[0].learningLogId?.toString(),
                        })],
                    }),
                }),
            }),
        );
    });

    it("returns the same receipt for a sequential resend without double counting", async () => {
        const testDatabase = await openVersion5Database("sequential-idempotency");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));
        const input = commitInput("run-1");

        const first = await repository.commitExploreAttempt(input);
        const second = await repository.commitExploreAttempt({ ...input, committedAt: 999 });

        expect(second).toEqual(first);
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(1);
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ problemsAnswered: 1, correctCount: 1 }),
        );
    });

    it("rejects a conflicting resend and preserves the first committed answer", async () => {
        const testDatabase = await openVersion5Database("conflicting-resend");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));
        const input = commitInput("run-1");
        await repository.commitExploreAttempt(input);

        await expect(repository.commitExploreAttempt({ ...input, result: "incorrect" }))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(repository.commitExploreAttempt({
            ...input,
            problem: { id: input.problem.id, categoryId: "sub_1d1d_nc_bridge" },
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(1);
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                problemsAnswered: 1,
                correctCount: 1,
                incorrectCount: 0,
            }),
        );
    });

    it.each([
        ["incorrect", { correctCount: 0, incorrectCount: 1, skippedCount: 0 }],
        ["skipped", { correctCount: 0, incorrectCount: 0, skippedCount: 1 }],
    ] as const)("updates only the %s aggregate", async (result, expectedCounts) => {
        const testDatabase = await openVersion5Database(`aggregate-${result}`);
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));

        await repository.commitExploreAttempt({
            ...commitInput("run-1"),
            result,
        });

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                problemsAnswered: 1,
                ...expectedCounts,
            }),
        );
    });

    it("returns one receipt for concurrent resends and increments exactly once", async () => {
        const testDatabase = await openVersion5Database("parallel-idempotency");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));
        const input = commitInput("run-1");
        const secondConnection = new SansuDatabase(testDatabase.name, indexedDbOptions);
        await secondConnection.open();
        const secondRepository = createExplorePersistenceRepository(secondConnection);

        const receipts = await (async () => {
            try {
                return await Promise.all(
                Array.from({ length: 6 }, (_, index) => (
                    index % 2 === 0 ? repository : secondRepository
                ).commitExploreAttempt(input)),
                );
            } finally {
                secondConnection.close();
            }
        })();

        receipts.forEach((receipt) => expect(receipt).toEqual(receipts[0]));
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(1);
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ problemsAnswered: 1, correctCount: 1 }),
        );
    });

    it("rolls back the run aggregate when the answer event cannot be written", async () => {
        const testDatabase = await openVersion5Database("rollback");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));
        const failEventWrite = () => {
            throw new Error("forced event write failure");
        };
        testDatabase.exploreRunEvents.hook("creating", failEventWrite);

        try {
            await expect(repository.commitExploreAttempt(commitInput("run-1")))
                .rejects.toThrow("forced event write failure");
        } finally {
            testDatabase.exploreRunEvents.hook("creating").unsubscribe(failEventWrite);
        }

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ problemsAnswered: 0, correctCount: 0, updatedAt: 150 }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(0);
    });

    it("rolls back explore and learning state when a learning store write fails", async () => {
        const testDatabase = await openVersion5Database("learning-rollback");
        const expectedProfile = profile("profile-1");
        await testDatabase.profiles.add(expectedProfile);
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: expectedProfile.id,
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(
            repository,
            reserveInput("run-1", expectedProfile.id, "gate-1", "problem-1", undefined, "main"),
        );
        const failMemoryWrite = () => {
            throw new Error("forced learning memory failure");
        };
        testDatabase.memoryMath.hook("creating", failMemoryWrite);

        try {
            await expect(repository.commitExploreAttempt(commitInput("run-1")))
                .rejects.toThrow("forced learning memory failure");
        } finally {
            testDatabase.memoryMath.hook("creating").unsubscribe(failMemoryWrite);
        }

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                problemsAnswered: 0,
                correctCount: 0,
                updatedAt: 150,
                learningAssignments: expect.objectContaining({
                    "problem-1": expect.objectContaining({ affectsSrs: true }),
                }),
            }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(0);
        await expect(testDatabase.logs.count()).resolves.toBe(0);
        await expect(testDatabase.memoryMath.count()).resolves.toBe(0);
        await expect(testDatabase.appData.count()).resolves.toBe(0);
        await expect(testDatabase.profiles.get(expectedProfile.id)).resolves.toEqual(expectedProfile);
    });

    it("rejects unreserved or mismatched problems before any answer state is written", async () => {
        const testDatabase = await openVersion5Database("assignment-mismatch");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(
            repository,
            reserveInput("run-1", "profile-1", "gate-1", "problem-1", undefined, "main"),
        );

        await expect(repository.commitExploreAttempt({
            ...commitInput("run-1"),
            problem: { id: "problem-1", categoryId: "sub_1d1d_nc_bridge" },
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(repository.commitExploreAttempt({
            ...commitInput("run-1"),
            problem: { id: "problem-not-reserved", categoryId: "add_1d_1_bridge" },
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(repository.commitExploreAttempt(
            commitInput("run-1", "profile-1", "gate-2"),
        )).rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ problemsAnswered: 0, correctCount: 0 }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(0);
        await expect(testDatabase.logs.count()).resolves.toBe(0);
        await expect(testDatabase.memoryMath.count()).resolves.toBe(0);
    });

    it("rejects a conflicting reservation and keeps the original assignment", async () => {
        const testDatabase = await openVersion5Database("assignment-reservation-conflict");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const input = reserveInput(
            "run-1",
            "profile-1",
            "gate-1",
            "problem-1",
            "add_1d_1_bridge",
            "main",
        );
        const first = await reserveAssignment(repository, input);

        await expect(reserveAssignment(repository, {
            ...input,
            categoryId: "sub_1d1d_nc_bridge",
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(reserveAssignment(repository, {
            ...input,
            source: "game-only-fallback",
            affectsSrs: false,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                learningAssignments: { "problem-1": first },
                problemsAnswered: 0,
            }),
        );
    });

    it("rejects caller-controlled affectsSrs values that contradict the reserved source", async () => {
        const testDatabase = await openVersion5Database("assignment-source-contract");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });

        await expect(reserveAssignment(repository, {
            ...reserveInput("run-1", "profile-1", "gate-1", "problem-1", undefined, "main"),
            affectsSrs: false,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(reserveAssignment(repository, {
            ...reserveInput("run-1"),
            affectsSrs: true,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ learningAssignments: {} }),
        );
    });

    it("rejects cross-profile attempts before writing an event or aggregate", async () => {
        const testDatabase = await openVersion5Database("ownership");
        await testDatabase.profiles.bulkAdd([profile("profile-1"), profile("profile-2")]);
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1", "profile-1"));

        await expect(repository.commitExploreAttempt(commitInput("run-1", "profile-2")))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ profileId: "profile-1", problemsAnswered: 0 }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("problem_answered").count())
            .resolves.toBe(0);
    });

    it("finishes a run atomically with its terminal snapshot and event", async () => {
        const testDatabase = await openVersion5Database("finish");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1"));
        await repository.commitExploreAttempt(commitInput("run-1"));
        const discoveries = [{
            id: "discovery-1",
            kind: "crystal" as const,
            name: "あおい水晶",
            rarity: "common" as const,
            nodeId: "node-1",
        }];

        const receipt = await repository.finishExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            status: "returned",
            endedAt: 300,
            energyUsed: 1,
            discoveries,
            routeSummary: ["start", "node-1"],
        });

        expect(receipt).toEqual({
            runId: "run-1",
            profileId: "profile-1",
            status: "returned",
            endedAt: 300,
        });
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({
                status: "returned",
                endedAt: 300,
                energyUsed: 1,
                discoveries,
                routeSummary: ["start", "node-1"],
                problemsAnswered: 1,
                correctCount: 1,
            }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("run_ended").first())
            .resolves.toEqual(expect.objectContaining({
                runId: "run-1",
                timestamp: 300,
                payload: expect.objectContaining({
                    status: "returned",
                    energyUsed: 1,
                    routeSummary: ["start", "node-1"],
                }),
            }));
    });

    it("returns the first finish for the same status and rejects another terminal status", async () => {
        const testDatabase = await openVersion5Database("finish-idempotency");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const input = {
            runId: "run-1",
            profileId: "profile-1",
            status: "rescued" as const,
            endedAt: 300,
            energyUsed: 12,
            discoveries: [],
            routeSummary: ["start"],
        };

        const first = await repository.finishExploreRun(input);
        const second = await repository.finishExploreRun({
            ...input,
            endedAt: 999,
            energyUsed: 99,
        });

        expect(second).toEqual(first);
        await expect(testDatabase.exploreRunEvents.where("type").equals("run_ended").count())
            .resolves.toBe(1);
        await expect(repository.finishExploreRun({ ...input, status: "returned" }))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ status: "rescued", endedAt: 300, energyUsed: 12 }),
        );
    });

    it("rejects finishing a run through another profile", async () => {
        const testDatabase = await openVersion5Database("finish-ownership");
        await testDatabase.profiles.bulkAdd([profile("profile-1"), profile("profile-2")]);
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });

        await expect(repository.finishExploreRun({
            runId: "run-1",
            profileId: "profile-2",
            status: "abandoned",
            endedAt: 200,
            energyUsed: 0,
            discoveries: [],
            routeSummary: ["start"],
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ status: "active" }),
        );
    });

    it("abandons an older active run when starting a new run for the same profile", async () => {
        const testDatabase = await openVersion5Database("single-active");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });

        const current = await repository.startExploreRun({
            runId: "run-2",
            profileId: "profile-1",
            seed: "seed-2",
            startedAt: 200,
        });

        expect(current.status).toBe("active");
        await expect(testDatabase.exploreRuns.where("[profileId+status]")
            .equals(["profile-1", "active"]).toArray()).resolves.toEqual([
            expect.objectContaining({ runId: "run-2", status: "active" }),
        ]);
        await expect(testDatabase.exploreRuns.get("run-1")).resolves.toEqual(
            expect.objectContaining({ status: "abandoned", endedAt: 200 }),
        );
        await expect(testDatabase.exploreRunEvents.where("type").equals("run_ended").first())
            .resolves.toEqual(expect.objectContaining({
                runId: "run-1",
                payload: expect.objectContaining({ status: "abandoned" }),
            }));
    });

    it("starts with a versioned checkpoint and returns the same active run for resume", async () => {
        const testDatabase = await openVersion5Database("checkpoint-start");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);

        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const resumable = await repository.getResumableExploreRun("profile-1");

        expect(run.activeCheckpoint).toEqual(expect.objectContaining({
            schemaVersion: 1,
            revision: 0,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            state: expect.objectContaining({
                runId: "run-1",
                profileId: "profile-1",
                seed: "seed-1",
            }),
        }));
        expect(resumable).toEqual({ run, checkpoint: run.activeCheckpoint });
        await expect(testDatabase.exploreRunEvents.where("type").equals("run_started").count())
            .resolves.toBe(1);
    });

    it("keeps a saved classic opening on its active run while new runs use the new default", async () => {
        const testDatabase = await openVersion5Database("checkpoint-classic-preservation");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const legacyState = {
            ...createInitialExploreState({ seed: "seed-1", now: 100 }),
            runId: "run-1",
            profileId: "profile-1",
        };
        const run = await repository.startExploreRun({
            runId: legacyState.runId,
            profileId: legacyState.profileId,
            seed: legacyState.seed,
            startedAt: legacyState.startedAt,
            activeCheckpoint: createExploreActiveCheckpoint({
                state: legacyState,
                openingExperienceId: "classic-v1",
            }),
        });

        const saved = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: legacyState,
            openingExperienceId: "classic-v1",
            savedAt: 120,
        });
        expect(run.activeCheckpoint?.openingExperienceId).toBe("classic-v1");
        await expect(repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: saved.checkpointRevision,
            state: legacyState,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 121,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
    });

    it("saves checkpoints with revision compare-and-swap", async () => {
        const testDatabase = await openVersion5Database("checkpoint-cas");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const state = run.activeCheckpoint!.state;
        const node = getAvailableExploreNodes(state)[0];
        const selected = exploreReducer(state, { type: "SELECT_NODE", nodeId: node.id });

        const receipt = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: selected,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 120,
        });

        expect(receipt.checkpointRevision).toBe(1);
        await expect(repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: selected,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 121,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
    });

    it("commits an answer and reducer checkpoint atomically when revision is supplied", async () => {
        const testDatabase = await openVersion5Database("checkpoint-commit");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const fixture = await createCheckpointPendingProblem(
            repository,
            run.runId,
            run.activeCheckpoint!.state,
        );
        const saved = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: fixture.pending,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 160,
        });
        const identity = createAttemptIdentity({
            profileId: run.profileId,
            runId: run.runId,
            gateId: fixture.gate.gateId,
            attemptNumber: 1,
        });

        const receipt = await repository.commitExploreAttempt({
            identity,
            problem: {
                id: fixture.problem.id,
                categoryId: fixture.problem.categoryId,
            },
            result: "correct",
            committedAt: 200,
            expectedCheckpointRevision: saved.checkpointRevision,
        });
        const stored = await testDatabase.exploreRuns.get(run.runId);

        expect(receipt.checkpointRevision).toBe(2);
        expect(stored).toEqual(expect.objectContaining({
            problemsAnswered: 1,
            correctCount: 1,
            activeCheckpoint: expect.objectContaining({
                revision: 2,
                state: expect.objectContaining({
                    steps: 1,
                    committedAttemptKeys: [receipt.attemptKey],
                    pendingProblem: undefined,
                }),
            }),
        }));
        await expect(testDatabase.exploreRunEvents.where("attemptKey")
            .equals(receipt.attemptKey).count()).resolves.toBe(1);

        const discoveryId = stored!.activeCheckpoint!.state.temporaryFinds[0].id;
        const acknowledged = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: receipt.checkpointRevision!,
            state: stored!.activeCheckpoint!.state,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            acknowledgedDiscoveryId: discoveryId,
            savedAt: 210,
        });
        expect(acknowledged.checkpointRevision).toBe(3);
        await expect(repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: acknowledged.checkpointRevision,
            state: stored!.activeCheckpoint!.state,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            acknowledgedDiscoveryId: undefined,
            savedAt: 220,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
    });

    it("rejects an old idempotent answer resend after a later checkpoint", async () => {
        const testDatabase = await openVersion5Database("checkpoint-stale-resend");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const fixture = await createCheckpointPendingProblem(
            repository,
            run.runId,
            run.activeCheckpoint!.state,
        );
        const pendingReceipt = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: fixture.pending,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 160,
        });
        const request = {
            identity: createAttemptIdentity({
                profileId: run.profileId,
                runId: run.runId,
                gateId: fixture.gate.gateId,
                attemptNumber: 1,
            }),
            problem: {
                id: fixture.problem.id,
                categoryId: fixture.problem.categoryId,
            },
            result: "correct" as const,
            committedAt: 200,
            expectedCheckpointRevision: pendingReceipt.checkpointRevision,
        };
        const committed = await repository.commitExploreAttempt(request);
        const stored = (await testDatabase.exploreRuns.get(run.runId))!;
        const discoveryId = stored.activeCheckpoint!.state.temporaryFinds[0].id;
        await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: committed.checkpointRevision!,
            state: stored.activeCheckpoint!.state,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            acknowledgedDiscoveryId: discoveryId,
            savedAt: 210,
        });

        await expect(repository.commitExploreAttempt(request))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(testDatabase.exploreRunEvents.where("attemptKey")
            .equals(committed.attemptKey).count()).resolves.toBe(1);
    });

    it("rejects skipped attempts at a checkpointed reducer boundary", async () => {
        const testDatabase = await openVersion5Database("checkpoint-skip");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const fixture = await createCheckpointPendingProblem(
            repository,
            run.runId,
            run.activeCheckpoint!.state,
        );
        const pendingReceipt = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: fixture.pending,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 160,
        });

        await expect(repository.commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: run.profileId,
                runId: run.runId,
                gateId: fixture.gate.gateId,
                attemptNumber: 1,
            }),
            problem: {
                id: fixture.problem.id,
                categoryId: fixture.problem.categoryId,
            },
            result: "skipped",
            committedAt: 200,
            expectedCheckpointRevision: pendingReceipt.checkpointRevision,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
        await expect(testDatabase.exploreRunEvents.where("type")
            .equals("problem_answered").count()).resolves.toBe(0);
    });

    it("checks terminal retry revisions and persists checkpoint-owned discoveries", async () => {
        const testDatabase = await openVersion5Database("checkpoint-finish-integrity");
        await testDatabase.profiles.add(profile("profile-1"));
        const repository = createExplorePersistenceRepository(testDatabase);
        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const fixture = await createCheckpointPendingProblem(
            repository,
            run.runId,
            run.activeCheckpoint!.state,
        );
        const pendingReceipt = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: fixture.pending,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 160,
        });
        const committed = await repository.commitExploreAttempt({
            identity: createAttemptIdentity({
                profileId: run.profileId,
                runId: run.runId,
                gateId: fixture.gate.gateId,
                attemptNumber: 1,
            }),
            problem: {
                id: fixture.problem.id,
                categoryId: fixture.problem.categoryId,
            },
            result: "correct",
            committedAt: 200,
            expectedCheckpointRevision: pendingReceipt.checkpointRevision,
        });
        const active = (await testDatabase.exploreRuns.get(run.runId))!;
        const checkpoint = active.activeCheckpoint!;
        const canonicalDiscovery = checkpoint.state.temporaryFinds[0];
        const finishInput = {
            runId: run.runId,
            profileId: run.profileId,
            status: "returned" as const,
            endedAt: 300,
            energyUsed: checkpoint.state.maxEnergy - checkpoint.state.energy,
            discoveries: [{ ...canonicalDiscovery, name: "tampered-name" }],
            routeSummary: [...checkpoint.state.openedNodeIds],
            expectedCheckpointRevision: committed.checkpointRevision,
        };

        await repository.finishExploreRun(finishInput);
        await expect(testDatabase.exploreRuns.get(run.runId)).resolves.toEqual(
            expect.objectContaining({
                discoveries: [canonicalDiscovery],
            }),
        );
        await expect(repository.finishExploreRun({
            ...finishInput,
            expectedCheckpointRevision: committed.checkpointRevision! + 1,
        })).rejects.toBeInstanceOf(ExplorePersistenceConflictError);
    });

    it("folds one legacy answer tail during resume and rejects checkpoint-less legacy rows", async () => {
        const testDatabase = await openVersion5Database("checkpoint-tail");
        await testDatabase.profiles.bulkAdd([profile("profile-1"), profile("profile-2")]);
        const repository = createExplorePersistenceRepository(testDatabase);
        const run = await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        const fixture = await createCheckpointPendingProblem(
            repository,
            run.runId,
            run.activeCheckpoint!.state,
        );
        const saved = await repository.saveExploreRunCheckpoint({
            runId: run.runId,
            profileId: run.profileId,
            expectedRevision: 0,
            state: fixture.pending,
            openingExperienceId: DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
            savedAt: 160,
        });
        const identity = createAttemptIdentity({
            profileId: run.profileId,
            runId: run.runId,
            gateId: fixture.gate.gateId,
            attemptNumber: 1,
        });
        const committed = await repository.commitExploreAttempt({
            identity,
            problem: {
                id: fixture.problem.id,
                categoryId: fixture.problem.categoryId,
            },
            result: "correct",
            committedAt: 200,
            // Deliberately omit expectedCheckpointRevision to model a row
            // written by the transitional client.
        });
        expect(committed.checkpointRevision).toBeUndefined();

        const resumed = await repository.getResumableExploreRun(run.profileId);
        expect(resumed?.checkpoint).toEqual(expect.objectContaining({
            revision: saved.checkpointRevision + 1,
            state: expect.objectContaining({
                steps: 1,
                committedAttemptKeys: [committed.attemptKey],
            }),
        }));

        const firstEvent = await testDatabase.exploreRunEvents
            .where("attemptKey")
            .equals(committed.attemptKey)
            .first();
        if (!firstEvent || firstEvent.type !== "problem_answered") {
            throw new Error("Expected the committed answer event");
        }
        await testDatabase.exploreRunEvents.bulkAdd([
            {
                ...firstEvent,
                id: undefined,
                attemptKey: "unapplied-tail-2",
                attemptNumber: createAttemptIdentity({
                    profileId: run.profileId,
                    runId: run.runId,
                    gateId: fixture.gate.gateId,
                    attemptNumber: 2,
                }).attemptNumber,
                timestamp: 210,
            },
            {
                ...firstEvent,
                id: undefined,
                attemptKey: "unapplied-tail-3",
                attemptNumber: createAttemptIdentity({
                    profileId: run.profileId,
                    runId: run.runId,
                    gateId: fixture.gate.gateId,
                    attemptNumber: 3,
                }).attemptNumber,
                timestamp: 220,
            },
        ]);
        await testDatabase.exploreRuns.update(run.runId, {
            problemsAnswered: 3,
            correctCount: 3,
            updatedAt: 220,
        });
        await expect(repository.getResumableExploreRun(run.profileId))
            .rejects.toBeInstanceOf(ExplorePersistenceConflictError);

        const legacy = await repository.startExploreRun({
            runId: "run-legacy",
            profileId: "profile-2",
            seed: "seed-legacy",
            startedAt: 300,
        });
        await testDatabase.exploreRuns.put({ ...legacy, activeCheckpoint: undefined });
        await expect(repository.getResumableExploreRun("profile-2")).resolves.toBeUndefined();
    });

    it("isolates profiles and deletes only the selected profile's explore rows", async () => {
        const testDatabase = await openVersion5Database("profile-delete");
        await testDatabase.profiles.bulkAdd([profile("profile-1"), profile("profile-2")]);
        const repository = createExplorePersistenceRepository(testDatabase);
        await repository.startExploreRun({
            runId: "run-1",
            profileId: "profile-1",
            seed: "seed-1",
            startedAt: 100,
        });
        await repository.startExploreRun({
            runId: "run-2",
            profileId: "profile-2",
            seed: "seed-2",
            startedAt: 100,
        });
        await reserveAssignment(repository, reserveInput("run-1", "profile-1"));
        await reserveAssignment(repository, reserveInput("run-2", "profile-2"));
        await repository.commitExploreAttempt(commitInput("run-1", "profile-1"));
        await repository.commitExploreAttempt(commitInput("run-2", "profile-2"));
        await testDatabase.exploreDiscoveries.bulkAdd([
            {
                profileId: "profile-1",
                discoveryId: "shared-discovery",
                kind: "flower",
                name: "ひかりの花",
                rarity: "rare",
                firstFoundAt: 200,
                count: 1,
                lastFoundAt: 200,
            },
            {
                profileId: "profile-2",
                discoveryId: "shared-discovery",
                kind: "flower",
                name: "ひかりの花",
                rarity: "rare",
                firstFoundAt: 200,
                count: 1,
                lastFoundAt: 200,
            },
        ]);

        await testDatabase.transaction(
            "rw",
            [
                testDatabase.profiles,
                testDatabase.logs,
                testDatabase.memoryMath,
                testDatabase.memoryVocab,
                testDatabase.exploreRuns,
                testDatabase.exploreRunEvents,
                testDatabase.exploreDiscoveries,
            ],
            () => deleteProfileOwnedIndexedDbRows(testDatabase, "profile-1"),
        );

        await expect(testDatabase.exploreRuns.where("profileId").equals("profile-1").count())
            .resolves.toBe(0);
        await expect(testDatabase.exploreRunEvents.where("profileId").equals("profile-1").count())
            .resolves.toBe(0);
        await expect(testDatabase.exploreDiscoveries.where("profileId").equals("profile-1").count())
            .resolves.toBe(0);
        await expect(testDatabase.profiles.get("profile-1")).resolves.toBeUndefined();

        await expect(testDatabase.exploreRuns.where("profileId").equals("profile-2").count())
            .resolves.toBe(1);
        await expect(testDatabase.exploreRunEvents.where("profileId").equals("profile-2").count())
            .resolves.toBe(2);
        await expect(testDatabase.exploreDiscoveries.get(["profile-2", "shared-discovery"]))
            .resolves.toEqual(expect.objectContaining({ profileId: "profile-2" }));
        await expect(testDatabase.profiles.get("profile-2"))
            .resolves.toEqual(expect.objectContaining({ id: "profile-2" }));
    });
});
