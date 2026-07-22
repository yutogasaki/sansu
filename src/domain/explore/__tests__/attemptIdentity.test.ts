import { describe, expect, it } from "vitest";
import type { Problem } from "../../types";
import {
    createAttemptIdentity,
    createAttemptIdentityKey,
    createExploreAttemptRecordingTarget,
} from "../attemptIdentity";

const BASE_IDENTITY = {
    profileId: "profile-1",
    runId: "run-1",
    gateId: "gate-1",
    attemptNumber: 1,
} as const;

describe("exploration attempt identity", () => {
    it("creates a distinct key when any identity component changes", () => {
        const identities = [
            BASE_IDENTITY,
            { ...BASE_IDENTITY, profileId: "profile-2" },
            { ...BASE_IDENTITY, runId: "run-2" },
            { ...BASE_IDENTITY, gateId: "gate-2" },
            { ...BASE_IDENTITY, attemptNumber: 2 },
        ];
        const keys = identities.map((input) => (
            createAttemptIdentityKey(createAttemptIdentity(input))
        ));

        expect(new Set(keys).size).toBe(identities.length);
    });

    it("uses a stable versioned tuple for the same input", () => {
        const first = createAttemptIdentity(BASE_IDENTITY);
        const second = createAttemptIdentity({ ...BASE_IDENTITY });

        expect(first).toEqual(second);
        expect(createAttemptIdentityKey(first)).toBe(createAttemptIdentityKey(second));
        expect(JSON.parse(createAttemptIdentityKey(first))).toEqual([
            "explore-attempt-v1",
            "profile-1",
            "run-1",
            "gate-1",
            1,
        ]);
    });

    it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
        "rejects a non-positive or non-integer attempt number: %s",
        (attemptNumber) => {
            expect(() => createAttemptIdentity({
                ...BASE_IDENTITY,
                attemptNumber,
            })).toThrow(RangeError);
        },
    );

    it("records the generated problem category after an assist fallback", () => {
        const originallyRequestedSkillId = "add_1d_1";
        const fallbackProblem: Pick<Problem, "categoryId"> = {
            categoryId: "add_1d_1_bridge",
        };

        const target = createExploreAttemptRecordingTarget(BASE_IDENTITY, fallbackProblem);

        expect(target.skillId).toBe(fallbackProblem.categoryId);
        expect(target.skillId).not.toBe(originallyRequestedSkillId);
    });
});
