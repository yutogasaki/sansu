import { db, type SansuDatabase } from "../../db";
import {
    getLearningAttemptTransactionTables,
    writeLearningAttemptInTransaction,
} from "../learningAttemptWriter";
import {
    createAttemptIdentityKey,
} from "./attemptIdentity";
import {
    assertExploreActiveCheckpointForRun,
    assertExploreCheckpointMatchesRunAggregates,
    createExploreActiveCheckpoint,
    createExploreReceiptFromEvent,
    foldExploreAnswerTail,
} from "./runCheckpoint";
import {
    assignmentsMatch,
    createExploreLearningAssignment,
} from "./learningAssignment";
import { createInitialExploreState } from "./reducer";
import type {
    CommitExploreAttemptInput,
    ExploreActiveCheckpoint,
    ExploreAttemptCommitReceipt,
    ExploreLearningAssignment,
    ExploreProblemAnsweredEventRecord,
    ExploreRunCheckpointSaveReceipt,
    ExploreRunRecord,
    ExploreRunFinishReceipt,
    FinishExploreRunInput,
    PersistedExploreAttemptResult,
    PersistedExploreRunTerminalStatus,
    ResumableExploreRun,
    ReserveExploreLearningAssignmentInput,
    SaveExploreRunCheckpointInput,
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

const createInitialCheckpoint = (input: StartExploreRunInput): ExploreActiveCheckpoint => {
    const supplied = input.activeCheckpoint;
    if (supplied && supplied.revision !== 0) {
        throw new ExplorePersistenceConflictError(
            "a newly started exploration run must use checkpoint revision 0",
        );
    }
    const initialState = supplied?.state ?? createInitialExploreState({
        seed: input.seed,
        now: input.startedAt,
    });
    if (
        initialState.runId !== input.runId
        && supplied
    ) {
        throw new ExplorePersistenceConflictError(
            `checkpoint runId ${initialState.runId} does not match ${input.runId}`,
        );
    }
    if (
        initialState.seed !== input.seed
        || initialState.startedAt !== input.startedAt
        || initialState.status !== "active"
        || (initialState.profileId !== undefined && initialState.profileId !== input.profileId)
    ) {
        throw new ExplorePersistenceConflictError(
            `checkpoint does not match start data for ${input.runId}`,
        );
    }

    return createExploreActiveCheckpoint({
        state: {
            ...initialState,
            runId: input.runId,
            profileId: input.profileId,
        },
        openingExperienceId: supplied?.openingExperienceId,
        acknowledgedDiscoveryId: supplied?.acknowledgedDiscoveryId,
        revision: supplied?.revision ?? 0,
        updatedAt: supplied?.updatedAt ?? input.startedAt,
    });
};

const createRunRecord = (input: StartExploreRunInput): ExploreRunRecord => {
    const run: ExploreRunRecord = {
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
        activeCheckpoint: createInitialCheckpoint(input),
        updatedAt: input.startedAt,
    };
    assertExploreActiveCheckpointForRun(run.activeCheckpoint!, run);
    assertExploreCheckpointMatchesRunAggregates(run.activeCheckpoint!, run);
    return run;
};

const createReceipt = (
    event: ExploreProblemAnsweredEventRecord,
    checkpointRevision?: number,
): ExploreAttemptCommitReceipt => ({
    ...createExploreReceiptFromEvent(event),
    checkpointRevision,
});

const createFinishReceipt = (
    run: ExploreRunRecord,
    checkpointRevision?: number,
): ExploreRunFinishReceipt => {
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
        checkpointRevision,
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

const assertExpectedCheckpointRevision = (
    run: ExploreRunRecord,
    expectedRevision: number,
): ExploreActiveCheckpoint => {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new ExplorePersistenceConflictError(
            "expected checkpoint revision must be a non-negative safe integer",
        );
    }
    const checkpoint = run.activeCheckpoint;
    if (!checkpoint || checkpoint.revision !== expectedRevision) {
        throw new ExplorePersistenceConflictError(
            `runId ${run.runId} checkpoint revision does not match ${expectedRevision}`,
        );
    }
    assertExploreActiveCheckpointForRun(checkpoint, run);
    return checkpoint;
};

const assertDiscoveryCursorDoesNotRegress = (
    previous: ExploreActiveCheckpoint,
    next: ExploreActiveCheckpoint,
) => {
    const previousId = previous.acknowledgedDiscoveryId;
    const nextId = next.acknowledgedDiscoveryId;
    if (!previousId && !nextId) return;
    if (previousId && !nextId) {
        throw new ExplorePersistenceConflictError("discovery cursor cannot move backwards");
    }
    const previousIndex = previousId
        ? next.state.temporaryFinds.findIndex((find) => find.id === previousId)
        : -1;
    const nextIndex = next.state.temporaryFinds.findIndex((find) => find.id === nextId);
    if (
        (previousId !== undefined && previousIndex < 0)
        || nextIndex < previousIndex
        || nextIndex > previousIndex + 1
    ) {
        throw new ExplorePersistenceConflictError(
            "discovery cursor must advance through saved finds in order",
        );
    }
};

const getRunAnswerEvents = async (
    database: SansuDatabase,
    profileId: string,
    runId: string,
): Promise<ExploreProblemAnsweredEventRecord[]> => {
    const events = await database.exploreRunEvents
        .where("[profileId+runId]")
        .equals([profileId, runId])
        .toArray();
    return events
        .filter((event): event is ExploreProblemAnsweredEventRecord => (
            event.type === "problem_answered"
        ))
        .sort((left, right) => (left.id ?? 0) - (right.id ?? 0));
};

const getAppliedCheckpointRevision = (
    run: ExploreRunRecord | undefined,
    attemptKey: string,
) => run?.activeCheckpoint?.state.committedAttemptKeys.includes(attemptKey)
    ? run.activeCheckpoint.revision
    : undefined;

const assertIdempotentCheckpointRevision = (
    input: CommitExploreAttemptInput,
    appliedRevision: number | undefined,
) => {
    const expectedRevision = input.expectedCheckpointRevision;
    if (
        expectedRevision !== undefined
        && appliedRevision !== expectedRevision + 1
    ) {
        throw new ExplorePersistenceConflictError(
            `attempt checkpoint does not follow revision ${expectedRevision}`,
        );
    }
};

export interface ExplorePersistenceRepository {
    startExploreRun(input: StartExploreRunInput): Promise<ExploreRunRecord>;
    getResumableExploreRun(profileId: string): Promise<ResumableExploreRun | undefined>;
    saveExploreRunCheckpoint(
        input: SaveExploreRunCheckpointInput,
    ): Promise<ExploreRunCheckpointSaveReceipt>;
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

    getResumableExploreRun: async (profileId) => database.transaction(
        "rw",
        [database.exploreRuns, database.exploreRunEvents],
        async () => {
            const activeRuns = await database.exploreRuns
                .where("[profileId+status]")
                .equals([profileId, "active"])
                .toArray();
            if (activeRuns.length === 0) return undefined;
            if (activeRuns.length !== 1) {
                throw new ExplorePersistenceConflictError(
                    `profileId ${profileId} has more than one active exploration run`,
                );
            }

            const run = activeRuns[0];
            const checkpoint = run.activeCheckpoint;
            // Rows written before MVP-2c are intentionally not guessed from
            // aggregate counters. The caller may close them through the
            // existing start-new-run compatibility path.
            if (!checkpoint) return undefined;
            assertExploreActiveCheckpointForRun(checkpoint, run);

            const answerEvents = await getRunAnswerEvents(database, profileId, run.runId);
            const eventKeys = new Set(answerEvents.map((event) => event.attemptKey));
            if (checkpoint.state.committedAttemptKeys.some((key) => !eventKeys.has(key))) {
                throw new ExplorePersistenceConflictError(
                    `runId ${run.runId} checkpoint references a missing answer event`,
                );
            }
            const tail = answerEvents.filter((event) => (
                !checkpoint.state.committedAttemptKeys.includes(event.attemptKey)
            ));
            if (tail.length > 1) {
                throw new ExplorePersistenceConflictError(
                    `runId ${run.runId} has more than one unapplied answer event`,
                );
            }

            const reconciled = tail.length === 1
                ? foldExploreAnswerTail({ checkpoint, event: tail[0] })
                : checkpoint;
            const reconciledRun: ExploreRunRecord = {
                ...run,
                activeCheckpoint: reconciled,
                updatedAt: Math.max(run.updatedAt, reconciled.updatedAt),
            };
            assertExploreActiveCheckpointForRun(reconciled, reconciledRun);
            assertExploreCheckpointMatchesRunAggregates(reconciled, reconciledRun);

            if (reconciled !== checkpoint) {
                const updated = await database.exploreRuns.put(reconciledRun);
                if (updated !== run.runId) {
                    throw new Error(`Failed to reconcile checkpoint for ${run.runId}`);
                }
            }
            return { run: reconciledRun, checkpoint: reconciled };
        },
    ),

    saveExploreRunCheckpoint: async (input) => database.transaction(
        "rw",
        database.exploreRuns,
        async () => {
            const run = await database.exploreRuns.get(input.runId);
            if (!run) {
                throw new ExplorePersistenceConflictError(
                    `runId ${input.runId} does not exist`,
                );
            }
            if (run.profileId !== input.profileId || run.status !== "active") {
                throw new ExplorePersistenceConflictError(
                    `runId ${input.runId} is not an active run for ${input.profileId}`,
                );
            }
            const previous = assertExpectedCheckpointRevision(run, input.expectedRevision);
            if (input.savedAt < previous.updatedAt) {
                throw new ExplorePersistenceConflictError(
                    "checkpoint savedAt cannot move backwards",
                );
            }
            if (input.openingExperienceId !== previous.openingExperienceId) {
                throw new ExplorePersistenceConflictError(
                    "opening experience cannot change inside an active run",
                );
            }
            const next = createExploreActiveCheckpoint({
                state: input.state,
                openingExperienceId: input.openingExperienceId,
                acknowledgedDiscoveryId: input.acknowledgedDiscoveryId,
                revision: previous.revision + 1,
                updatedAt: input.savedAt,
            });
            assertDiscoveryCursorDoesNotRegress(previous, next);
            const nextRun: ExploreRunRecord = {
                ...run,
                activeCheckpoint: next,
                updatedAt: Math.max(run.updatedAt, input.savedAt),
            };
            assertExploreActiveCheckpointForRun(next, nextRun);
            assertExploreCheckpointMatchesRunAggregates(next, nextRun);

            const updated = await database.exploreRuns.put(nextRun);
            if (updated !== run.runId) {
                throw new Error(`Failed to save checkpoint for ${run.runId}`);
            }
            return {
                runId: run.runId,
                profileId: run.profileId,
                checkpointRevision: next.revision,
                savedAt: input.savedAt,
            };
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
        if (
            input.expectedCheckpointRevision !== undefined
            && input.result === "skipped"
        ) {
            // The Explore reducer has no skip transition. Legacy callers may
            // still record aggregate-only skips without a revision, but a
            // checkpointed run must fail closed instead of creating a tail it
            // cannot resume.
            throw new ExplorePersistenceConflictError(
                "checkpointed exploration attempts cannot be skipped",
            );
        }

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
                        const appliedRevision = getAppliedCheckpointRevision(run, attemptKey);
                        if (appliedRevision !== undefined) {
                            assertIdempotentCheckpointRevision(input, appliedRevision);
                            return createReceipt(existingEvent, appliedRevision);
                        }
                        if (input.expectedCheckpointRevision === undefined) {
                            return createReceipt(existingEvent);
                        }

                        const checkpoint = assertExpectedCheckpointRevision(
                            run,
                            input.expectedCheckpointRevision,
                        );
                        const reconciled = foldExploreAnswerTail({
                            checkpoint,
                            event: existingEvent,
                        });
                        const reconciledRun: ExploreRunRecord = {
                            ...run,
                            activeCheckpoint: reconciled,
                            updatedAt: Math.max(run.updatedAt, reconciled.updatedAt),
                        };
                        assertExploreCheckpointMatchesRunAggregates(reconciled, reconciledRun);
                        const reconciledKey = await database.exploreRuns.put(reconciledRun);
                        if (reconciledKey !== run.runId) {
                            throw new Error(`Failed to reconcile checkpoint for ${run.runId}`);
                        }
                        return createReceipt(existingEvent, reconciled.revision);
                    }

                    if (run.status !== "active") {
                        throw new ExplorePersistenceConflictError(
                            `runId ${run.runId} is not active`,
                        );
                    }

                    const checkpoint = input.expectedCheckpointRevision === undefined
                        ? undefined
                        : assertExpectedCheckpointRevision(
                            run,
                            input.expectedCheckpointRevision,
                        );
                    if (checkpoint) {
                        assertExploreCheckpointMatchesRunAggregates(checkpoint, run);
                    }

                    const increment = getAggregateIncrement(input.result);
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

                    const nextCheckpoint = checkpoint
                        ? foldExploreAnswerTail({ checkpoint, event })
                        : undefined;
                    const nextRun: ExploreRunRecord = {
                        ...run,
                        problemsAnswered: run.problemsAnswered + 1,
                        correctCount: run.correctCount + increment.correctCount,
                        incorrectCount: run.incorrectCount + increment.incorrectCount,
                        skippedCount: run.skippedCount + increment.skippedCount,
                        activeCheckpoint: nextCheckpoint ?? run.activeCheckpoint,
                        updatedAt: Math.max(run.updatedAt, input.committedAt),
                    };
                    if (nextCheckpoint) {
                        assertExploreActiveCheckpointForRun(nextCheckpoint, nextRun);
                        assertExploreCheckpointMatchesRunAggregates(nextCheckpoint, nextRun);
                    }
                    const updated = await database.exploreRuns.put(nextRun);
                    if (updated !== run.runId) {
                        throw new Error(`Failed to update run ${run.runId}`);
                    }
                    await database.exploreRunEvents.add(event);
                    return createReceipt(event, nextCheckpoint?.revision);
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
            const appliedRevision = getAppliedCheckpointRevision(run, attemptKey);
            assertIdempotentCheckpointRevision(input, appliedRevision);
            return createReceipt(
                existingEvent,
                appliedRevision,
            );
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
                if (
                    input.expectedCheckpointRevision !== undefined
                    && run.activeCheckpoint?.revision !== input.expectedCheckpointRevision
                ) {
                    throw new ExplorePersistenceConflictError(
                        `finished run ${run.runId} checkpoint revision does not match ${input.expectedCheckpointRevision}`,
                    );
                }
                return createFinishReceipt(
                    run,
                    input.expectedCheckpointRevision === undefined
                        ? undefined
                        : run.activeCheckpoint?.revision,
                );
            }

            const checkpoint = input.expectedCheckpointRevision === undefined
                ? undefined
                : assertExpectedCheckpointRevision(run, input.expectedCheckpointRevision);
            if (checkpoint) {
                assertExploreCheckpointMatchesRunAggregates(checkpoint, run);
                const state = checkpoint.state;
                const expectedEnergyUsed = Math.max(0, state.maxEnergy - state.energy);
                const discoveriesMatch = input.discoveries.length === state.temporaryFinds.length
                    && input.discoveries.every((find, index) => (
                        find.id === state.temporaryFinds[index]?.id
                    ));
                const routeMatches = input.routeSummary.length === state.openedNodeIds.length
                    && input.routeSummary.every((nodeId, index) => (
                        nodeId === state.openedNodeIds[index]
                    ));
                if (
                    Math.max(0, Math.round(input.energyUsed)) !== expectedEnergyUsed
                    || !discoveriesMatch
                    || !routeMatches
                ) {
                    throw new ExplorePersistenceConflictError(
                        `finish data does not match checkpoint for ${run.runId}`,
                    );
                }
                if (
                    (input.status === "returned" && (state.pendingProblem || state.rescuePending))
                    || (input.status === "rescued" && (!state.rescuePending || state.energy !== 0))
                ) {
                    throw new ExplorePersistenceConflictError(
                        `checkpoint cannot finish ${run.runId} as ${input.status}`,
                    );
                }
            }

            const terminalRun: ExploreRunRecord = {
                ...run,
                status: input.status,
                endedAt: input.endedAt,
                energyUsed: checkpoint
                    ? Math.max(0, checkpoint.state.maxEnergy - checkpoint.state.energy)
                    : Math.max(0, Math.round(input.energyUsed)),
                discoveries: checkpoint
                    ? [...checkpoint.state.temporaryFinds]
                    : input.discoveries,
                routeSummary: checkpoint
                    ? [...checkpoint.state.openedNodeIds]
                    : input.routeSummary,
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
            return createFinishReceipt(terminalRun, checkpoint?.revision);
        },
    ),
});

const explorePersistenceRepository = createExplorePersistenceRepository(db);

export const startExploreRun = explorePersistenceRepository.startExploreRun;
export const getResumableExploreRun = explorePersistenceRepository.getResumableExploreRun;
export const saveExploreRunCheckpoint = explorePersistenceRepository.saveExploreRunCheckpoint;
export const reserveExploreLearningAssignment = (
    input: ReserveExploreLearningAssignmentInput,
    options?: { signal?: AbortSignal },
) => explorePersistenceRepository.reserveExploreLearningAssignment(input, options);
export const commitExploreAttempt = explorePersistenceRepository.commitExploreAttempt;
export const finishExploreRun = explorePersistenceRepository.finishExploreRun;
