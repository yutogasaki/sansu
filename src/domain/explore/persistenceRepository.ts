import { db, type SansuDatabase } from "../../db";
import {
    getLearningAttemptTransactionTables,
    writeLearningAttemptInTransaction,
} from "../learningAttemptWriter";
import {
    createAttemptIdentity,
    createAttemptIdentityKey,
} from "./attemptIdentity";
import {
    assignmentsMatch,
    createExploreLearningAssignment,
} from "./learningAssignment";
import type {
    CommitExploreAttemptInput,
    ExploreAttemptCommitReceipt,
    ExploreLearningAssignment,
    ExploreProblemAnsweredEventRecord,
    ExploreRunRecord,
    ExploreRunFinishReceipt,
    FinishExploreRunInput,
    PersistedExploreAttemptResult,
    PersistedExploreRunTerminalStatus,
    ReserveExploreLearningAssignmentInput,
    StartExploreRunInput,
} from "./persistenceTypes";

export class ExplorePersistenceConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ExplorePersistenceConflictError";
    }
}

const assertMatchingRunStart = (
    existing: ExploreRunRecord,
    input: StartExploreRunInput,
) => {
    if (
        existing.profileId !== input.profileId
        || existing.seed !== input.seed
        || existing.startedAt !== input.startedAt
    ) {
        throw new ExplorePersistenceConflictError(
            `runId ${input.runId} is already owned by different start data`,
        );
    }
};

const createRunRecord = (input: StartExploreRunInput): ExploreRunRecord => ({
    runId: input.runId,
    profileId: input.profileId,
    seed: input.seed,
    status: "active",
    startedAt: input.startedAt,
    energyUsed: 0,
    problemsAnswered: 0,
    correctCount: 0,
    incorrectCount: 0,
    skippedCount: 0,
    discoveries: [],
    routeSummary: [],
    learningAssignments: {},
    updatedAt: input.startedAt,
});

const createReceipt = (
    event: ExploreProblemAnsweredEventRecord,
): ExploreAttemptCommitReceipt => ({
    attemptKey: event.attemptKey,
    identity: createAttemptIdentity({
        profileId: event.profileId,
        runId: event.runId,
        gateId: event.gateId,
        attemptNumber: event.attemptNumber,
    }),
    recordedSkillId: event.recordedSkillId,
    result: event.result,
    affectsSrs: event.affectsSrs === true,
    assignmentKey: event.assignmentKey,
    learningSource: event.learningSource,
    learningLogId: event.learningLogId,
    committedAt: event.timestamp,
});

const createFinishReceipt = (run: ExploreRunRecord): ExploreRunFinishReceipt => {
    if (run.status === "active" || run.endedAt === undefined) {
        throw new ExplorePersistenceConflictError(
            `runId ${run.runId} does not have a committed terminal state`,
        );
    }
    return {
        runId: run.runId,
        profileId: run.profileId,
        status: run.status,
        endedAt: run.endedAt,
    };
};

const addRunEndedEvent = async (
    database: SansuDatabase,
    run: ExploreRunRecord,
    status: PersistedExploreRunTerminalStatus,
    endedAt: number,
) => {
    await database.exploreRunEvents.add({
        profileId: run.profileId,
        runId: run.runId,
        timestamp: endedAt,
        type: "run_ended",
        payload: {
            status,
            energyUsed: run.energyUsed,
            discoveries: run.discoveries,
            routeSummary: run.routeSummary,
        },
    });
};

const abandonOtherActiveRuns = async (
    database: SansuDatabase,
    input: StartExploreRunInput,
) => {
    const activeRuns = await database.exploreRuns
        .where("[profileId+status]")
        .equals([input.profileId, "active"])
        .toArray();

    for (const activeRun of activeRuns) {
        if (activeRun.runId === input.runId) continue;
        await addRunEndedEvent(database, activeRun, "abandoned", input.startedAt);
        const updated = await database.exploreRuns.update(activeRun.runId, {
            status: "abandoned",
            endedAt: input.startedAt,
            updatedAt: input.startedAt,
        });
        if (updated !== 1) throw new Error(`Failed to abandon run ${activeRun.runId}`);
    }
};

const assertMatchingAttempt = (
    event: ExploreProblemAnsweredEventRecord,
    input: CommitExploreAttemptInput,
    assignment: ExploreLearningAssignment,
) => {
    if (
        event.profileId !== input.identity.profileId
        || event.runId !== input.identity.runId
        || event.gateId !== input.identity.gateId
        || event.attemptNumber !== input.identity.attemptNumber
        || event.recordedSkillId !== input.problem.categoryId
        || event.result !== input.result
        || event.assignmentKey !== assignment.assignmentKey
        || event.affectsSrs !== assignment.affectsSrs
        || event.learningSource !== assignment.source
    ) {
        throw new ExplorePersistenceConflictError(
            `attemptKey ${event.attemptKey} was already committed with different answer data`,
        );
    }
};

const getAttemptEvent = async (
    database: SansuDatabase,
    attemptKey: string,
): Promise<ExploreProblemAnsweredEventRecord | undefined> => {
    const event = await database.exploreRunEvents
        .where("attemptKey")
        .equals(attemptKey)
        .first();

    if (!event) return undefined;
    if (event.type !== "problem_answered") {
        throw new ExplorePersistenceConflictError(
            `attemptKey ${attemptKey} belongs to a non-answer event`,
        );
    }
    return event;
};

const getAggregateIncrement = (result: PersistedExploreAttemptResult) => ({
    correctCount: result === "correct" ? 1 : 0,
    incorrectCount: result === "incorrect" ? 1 : 0,
    skippedCount: result === "skipped" ? 1 : 0,
});

const isConstraintError = (error: unknown): boolean => (
    error instanceof Error && error.name === "ConstraintError"
);

export interface ExplorePersistenceRepository {
    startExploreRun(input: StartExploreRunInput): Promise<ExploreRunRecord>;
    reserveExploreLearningAssignment(
        input: ReserveExploreLearningAssignmentInput,
        options?: { signal?: AbortSignal },
    ): Promise<ExploreLearningAssignment>;
    commitExploreAttempt(input: CommitExploreAttemptInput): Promise<ExploreAttemptCommitReceipt>;
    finishExploreRun(input: FinishExploreRunInput): Promise<ExploreRunFinishReceipt>;
}

export const createExplorePersistenceRepository = (
    database: SansuDatabase,
): ExplorePersistenceRepository => ({
    startExploreRun: async (input) => database.transaction(
        "rw",
        [database.profiles, database.exploreRuns, database.exploreRunEvents],
        async () => {
            const existing = await database.exploreRuns.get(input.runId);
            if (existing) {
                assertMatchingRunStart(existing, input);
                if (existing.status !== "active") {
                    throw new ExplorePersistenceConflictError(
                        `runId ${input.runId} is already finished`,
                    );
                }
                await abandonOtherActiveRuns(database, input);
                return existing;
            }

            const profile = await database.profiles.get(input.profileId);
            if (!profile) {
                throw new ExplorePersistenceConflictError(
                    `profileId ${input.profileId} does not exist`,
                );
            }

            await abandonOtherActiveRuns(database, input);
            const run = createRunRecord(input);
            await database.exploreRuns.add(run);
            await database.exploreRunEvents.add({
                profileId: input.profileId,
                runId: input.runId,
                timestamp: input.startedAt,
                type: "run_started",
                payload: { seed: input.seed },
            });
            return run;
        },
    ),

    reserveExploreLearningAssignment: async (input, options = {}) => database.transaction(
        "rw",
        database.exploreRuns,
        async () => {
            const assertReservationActive = () => {
                if (!options.signal?.aborted) return;
                const error = options.signal.reason instanceof Error
                    ? options.signal.reason
                    : new Error("Explore assignment reservation was cancelled");
                error.name = "AbortError";
                throw error;
            };
            assertReservationActive();
            const run = await database.exploreRuns.get(input.runId);
            assertReservationActive();
            if (!run) {
                throw new ExplorePersistenceConflictError(
                    `runId ${input.runId} does not exist`,
                );
            }
            if (run.profileId !== input.profileId) {
                throw new ExplorePersistenceConflictError(
                    `runId ${run.runId} belongs to a different profile`,
                );
            }
            if (run.status !== "active") {
                throw new ExplorePersistenceConflictError(
                    `runId ${run.runId} is not active`,
                );
            }
            if (input.source === "game-only-fallback" ? input.affectsSrs : !input.affectsSrs) {
                throw new ExplorePersistenceConflictError(
                    "learning assignment source and affectsSrs do not match",
                );
            }
            if (input.source === "due" && !input.isReview) {
                throw new ExplorePersistenceConflictError(
                    "due assignments must be marked as review",
                );
            }
            if (input.source === "maintenance" && !input.isMaintenanceCheck) {
                throw new ExplorePersistenceConflictError(
                    "maintenance assignments must be marked as maintenance checks",
                );
            }

            const assignment = createExploreLearningAssignment(input);
            const existing = run.learningAssignments?.[input.problemId];
            if (existing) {
                if (!assignmentsMatch(existing, assignment)) {
                    throw new ExplorePersistenceConflictError(
                        `problemId ${input.problemId} already has a different learning assignment`,
                    );
                }
                return existing;
            }

            assertReservationActive();
            const updated = await database.exploreRuns.update(run.runId, {
                learningAssignments: {
                    ...(run.learningAssignments || {}),
                    [input.problemId]: assignment,
                },
                updatedAt: Math.max(run.updatedAt, input.reservedAt),
            });
            if (updated !== 1) {
                throw new Error(`Failed to reserve learning assignment for ${run.runId}`);
            }
            // Throwing inside the Dexie transaction rolls the write back if
            // the deadline elapsed while the update was in flight.
            assertReservationActive();
            return assignment;
        },
    ),

    commitExploreAttempt: async (input) => {
        const attemptKey = createAttemptIdentityKey(input.identity);

        try {
            return await database.transaction(
                "rw",
                [
                    database.exploreRuns,
                    database.exploreRunEvents,
                    ...getLearningAttemptTransactionTables(database),
                ],
                async () => {
                    const run = await database.exploreRuns.get(input.identity.runId);
                    if (!run) {
                        throw new ExplorePersistenceConflictError(
                            `runId ${input.identity.runId} does not exist`,
                        );
                    }
                    if (run.profileId !== input.identity.profileId) {
                        throw new ExplorePersistenceConflictError(
                            `runId ${run.runId} belongs to a different profile`,
                        );
                    }
                    const assignment = run.learningAssignments?.[input.problem.id];
                    if (!assignment) {
                        throw new ExplorePersistenceConflictError(
                            `problemId ${input.problem.id} has no reserved learning assignment`,
                        );
                    }
                    if (
                        assignment.profileId !== input.identity.profileId
                        || assignment.runId !== input.identity.runId
                        || assignment.gateId !== input.identity.gateId
                        || assignment.problemId !== input.problem.id
                        || assignment.categoryId !== input.problem.categoryId
                    ) {
                        throw new ExplorePersistenceConflictError(
                            `problemId ${input.problem.id} does not match its reserved assignment`,
                        );
                    }

                    const existingEvent = await getAttemptEvent(database, attemptKey);
                    if (existingEvent) {
                        assertMatchingAttempt(existingEvent, input, assignment);
                        return createReceipt(existingEvent);
                    }

                    if (run.status !== "active") {
                        throw new ExplorePersistenceConflictError(
                            `runId ${run.runId} is not active`,
                        );
                    }

                    const increment = getAggregateIncrement(input.result);
                    const updated = await database.exploreRuns.update(run.runId, {
                        problemsAnswered: run.problemsAnswered + 1,
                        correctCount: run.correctCount + increment.correctCount,
                        incorrectCount: run.incorrectCount + increment.incorrectCount,
                        skippedCount: run.skippedCount + increment.skippedCount,
                        updatedAt: input.committedAt,
                    });
                    if (updated !== 1) {
                        throw new Error(`Failed to update run ${run.runId}`);
                    }

                    const learningWrite = assignment.affectsSrs
                        ? await writeLearningAttemptInTransaction(database, {
                            profileId: input.identity.profileId,
                            subject: "math",
                            itemId: assignment.categoryId,
                            result: input.result,
                            isReview: assignment.isReview,
                            isMaintenanceCheck: assignment.isMaintenanceCheck,
                            timestamp: new Date(input.committedAt).toISOString(),
                            timeMs: input.timeMs,
                        })
                        : undefined;

                    const event: ExploreProblemAnsweredEventRecord = {
                        profileId: input.identity.profileId,
                        runId: input.identity.runId,
                        attemptKey,
                        timestamp: input.committedAt,
                        type: "problem_answered",
                        gateId: input.identity.gateId,
                        attemptNumber: input.identity.attemptNumber,
                        recordedSkillId: assignment.categoryId,
                        result: input.result,
                        affectsSrs: assignment.affectsSrs,
                        assignmentKey: assignment.assignmentKey,
                        learningSource: assignment.source,
                        isReview: assignment.isReview,
                        isMaintenanceCheck: assignment.isMaintenanceCheck,
                        learningLogId: learningWrite?.logId,
                        payload: null,
                    };
                    await database.exploreRunEvents.add(event);
                    return createReceipt(event);
                },
            );
        } catch (error) {
            if (!isConstraintError(error)) throw error;

            const existingEvent = await getAttemptEvent(database, attemptKey);
            if (!existingEvent) throw error;
            const run = await database.exploreRuns.get(input.identity.runId);
            const assignment = run?.learningAssignments?.[input.problem.id];
            if (!assignment) throw error;
            assertMatchingAttempt(existingEvent, input, assignment);
            return createReceipt(existingEvent);
        }
    },

    finishExploreRun: async (input) => database.transaction(
        "rw",
        [database.exploreRuns, database.exploreRunEvents],
        async () => {
            const run = await database.exploreRuns.get(input.runId);
            if (!run) {
                throw new ExplorePersistenceConflictError(
                    `runId ${input.runId} does not exist`,
                );
            }
            if (run.profileId !== input.profileId) {
                throw new ExplorePersistenceConflictError(
                    `runId ${run.runId} belongs to a different profile`,
                );
            }
            if (run.status !== "active") {
                if (run.status !== input.status) {
                    throw new ExplorePersistenceConflictError(
                        `runId ${run.runId} is already finished as ${run.status}`,
                    );
                }
                return createFinishReceipt(run);
            }

            const terminalRun: ExploreRunRecord = {
                ...run,
                status: input.status,
                endedAt: input.endedAt,
                energyUsed: Math.max(0, Math.round(input.energyUsed)),
                discoveries: input.discoveries,
                routeSummary: input.routeSummary,
                updatedAt: input.endedAt,
            };
            await addRunEndedEvent(
                database,
                terminalRun,
                terminalRun.status as PersistedExploreRunTerminalStatus,
                input.endedAt,
            );
            const updated = await database.exploreRuns.put(terminalRun);
            if (updated !== run.runId) {
                throw new Error(`Failed to finish run ${run.runId}`);
            }
            return createFinishReceipt(terminalRun);
        },
    ),
});

const explorePersistenceRepository = createExplorePersistenceRepository(db);

export const startExploreRun = explorePersistenceRepository.startExploreRun;
export const reserveExploreLearningAssignment = (
    input: ReserveExploreLearningAssignmentInput,
    options?: { signal?: AbortSignal },
) => explorePersistenceRepository.reserveExploreLearningAssignment(input, options);
export const commitExploreAttempt = explorePersistenceRepository.commitExploreAttempt;
export const finishExploreRun = explorePersistenceRepository.finishExploreRun;
