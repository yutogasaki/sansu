import type { Problem } from "../types";

const EXPLORE_ATTEMPT_KEY_VERSION = "explore-attempt-v1" as const;

declare const attemptNumberBrand: unique symbol;

/** A one-based, positive, safe integer identifying an attempt within a gate. */
export type AttemptNumber = number & {
    readonly [attemptNumberBrand]: "AttemptNumber";
};

export interface AttemptIdentity {
    readonly profileId: string;
    readonly runId: string;
    readonly gateId: string;
    readonly attemptNumber: AttemptNumber;
}

export interface AttemptIdentityInput {
    readonly profileId: string;
    readonly runId: string;
    readonly gateId: string;
    readonly attemptNumber: number;
}

/**
 * The learning-record boundary for an exploration answer. `skillId` is derived
 * from the generated Problem, so an assist/fallback is recorded as the skill
 * the child actually answered rather than the gate's originally requested one.
 */
export interface ExploreAttemptRecordingTarget {
    readonly identity: AttemptIdentity;
    readonly skillId: Problem["categoryId"];
}

export const createAttemptNumber = (attemptNumber: number): AttemptNumber => {
    if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
        throw new RangeError("attemptNumber must be a one-based positive safe integer");
    }

    return attemptNumber as AttemptNumber;
};

export const createAttemptIdentity = (
    input: AttemptIdentityInput,
): AttemptIdentity => ({
    profileId: input.profileId,
    runId: input.runId,
    gateId: input.gateId,
    attemptNumber: createAttemptNumber(input.attemptNumber),
});

/** Stable, versioned idempotency key for a single exploration answer. */
export const createAttemptIdentityKey = (identity: AttemptIdentity): string => JSON.stringify([
    EXPLORE_ATTEMPT_KEY_VERSION,
    identity.profileId,
    identity.runId,
    identity.gateId,
    identity.attemptNumber,
]);

export const createExploreAttemptRecordingTarget = (
    identityInput: AttemptIdentityInput,
    problem: Pick<Problem, "categoryId">,
): ExploreAttemptRecordingTarget => ({
    identity: createAttemptIdentity(identityInput),
    skillId: problem.categoryId,
});
