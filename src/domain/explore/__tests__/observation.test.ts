import { describe, expect, it } from "vitest";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
} from "../discoveryPageCatalog";
import {
    getExploreObservationDefinition,
    getExploreObservationForEncounter,
} from "../observationCatalog";
import { selectExploreObservation } from "../observation";
import { ROOT_TANGLE_OBSERVATION } from "../rootTangleObservation";
import { selectDiscoveryPageAward } from "../rewards";
import type { DiscoveryInstance, ExploreRunState } from "../types";

const [DEW, WARM, PETALS, LIGHT_PATH] = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds;

const discovery = (
    id: string,
    featureId: typeof FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds[number],
    options: Partial<DiscoveryInstance> = {},
): DiscoveryInstance => ({
    id,
    kind: "flower",
    name: "ほたる花",
    rarity: featureId === LIGHT_PATH ? "rare" : "common",
    nodeId: options.nodeId ?? "node-5-0",
    discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
    discoveryFeatureId: featureId,
    ...options,
});

describe("exploration observation catalog", () => {
    it("keeps root-specific semantics behind stable generic lookups", () => {
        expect(getExploreObservationForEncounter("root-tangle")).toBe(ROOT_TANGLE_OBSERVATION);
        expect(getExploreObservationDefinition(ROOT_TANGLE_OBSERVATION.id)).toBe(ROOT_TANGLE_OBSERVATION);
        expect(getExploreObservationForEncounter("light-bridge")).toBeUndefined();
    });
});

describe("semantic discovery page award", () => {
    it("awards the three Makimodon body-rule beats to generic rapid successes", () => {
        const [TRIP, PATH, PAYOFF] = MAKIMODON_DISCOVERY_PAGE.chain.featureIds;

        expect(selectDiscoveryPageAward({
            preferMakimodon: true,
            discoveredFeatureIds: [],
        })).toEqual({ pageId: MAKIMODON_DISCOVERY_PAGE.id, featureId: TRIP });
        expect(selectDiscoveryPageAward({
            preferMakimodon: true,
            discoveredFeatureIds: [TRIP],
        })).toEqual({ pageId: MAKIMODON_DISCOVERY_PAGE.id, featureId: PATH });
        expect(selectDiscoveryPageAward({
            preferMakimodon: true,
            discoveredFeatureIds: [TRIP, PATH],
        })).toEqual({ pageId: MAKIMODON_DISCOVERY_PAGE.id, featureId: PAYOFF });
        expect(selectDiscoveryPageAward({
            preferMakimodon: true,
            discoveredFeatureIds: [TRIP, PATH, PAYOFF],
        })?.featureId).toBe(DEW);
    });

    it("awards the three ordinary clues but not an ordinal fourth discovery", () => {
        expect(selectDiscoveryPageAward({
            discoveredFeatureIds: [],
        })?.featureId).toBe(DEW);
        expect(selectDiscoveryPageAward({
            discoveredFeatureIds: [DEW],
        })?.featureId).toBe(WARM);
        expect(selectDiscoveryPageAward({
            discoveredFeatureIds: [DEW, WARM],
        })?.featureId).toBe(PETALS);
        expect(selectDiscoveryPageAward({
            discoveredFeatureIds: [DEW, WARM, PETALS],
        })).toBeUndefined();
    });

    it("awards the final feature only to root after every prerequisite", () => {
        expect(selectDiscoveryPageAward({
            encounterId: "light-bridge",
            discoveredFeatureIds: [DEW, WARM, PETALS],
        })).toBeUndefined();
        expect(selectDiscoveryPageAward({
            encounterId: "root-tangle",
            discoveredFeatureIds: [DEW, WARM],
        })?.featureId).toBe(PETALS);
        expect(selectDiscoveryPageAward({
            encounterId: "root-tangle",
            discoveredFeatureIds: [DEW, WARM, PETALS],
        })).toEqual({
            pageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            featureId: LIGHT_PATH,
            observationId: ROOT_TANGLE_OBSERVATION.id,
        });
        expect(selectDiscoveryPageAward({
            encounterId: "root-tangle",
            discoveredFeatureIds: [DEW, WARM, PETALS, LIGHT_PATH],
        })).toBeUndefined();
    });
});

describe("receipt-bound observation selector", () => {
    const attemptKey = "attempt-root-1";
    const priorFinds = [
        discovery("find-1", DEW),
        discovery("find-2", WARM),
        discovery("find-3", PETALS),
    ];
    const finalDiscovery = discovery("find-root", LIGHT_PATH, {
        observationId: ROOT_TANGLE_OBSERVATION.id,
        source: {
            attemptKey,
            gateId: "gate-root",
            attemptNumber: 1,
            nodeId: "node-5-0",
            encounterId: "root-tangle",
            recordedSkillId: "sub_1d1d_nc_bridge",
            result: "correct",
        },
    });
    const baseState: Pick<
        ExploreRunState,
        "attempts" | "committedAttemptKeys" | "lastEvent" | "temporaryFinds"
    > = {
        attempts: [{
            attemptKey,
            gateId: "gate-root",
            attemptNumber: 1,
            nodeId: "node-5-0",
            encounterId: "root-tangle",
            skillId: "sub_1d1d_nc_bridge",
            result: "correct",
        }],
        committedAttemptKeys: [attemptKey],
        lastEvent: { type: "discovery", discovery: finalDiscovery },
        temporaryFinds: [...priorFinds, finalDiscovery],
    };
    const reaction = {
        attemptKey,
        gateId: "gate-root",
        attemptNumber: 1,
        nodeId: finalDiscovery.nodeId,
        encounterId: "root-tangle" as const,
        recordedSkillId: "sub_1d1d_nc_bridge",
        result: "correct" as const,
    };

    const select = (
        state: typeof baseState = baseState,
        nextReaction: typeof reaction | null = reaction,
        revealedDiscoveryId: string | null = finalDiscovery.id,
    ) => selectExploreObservation({
        state,
        reaction: nextReaction,
        revealedDiscoveryId,
        getDefinition: getExploreObservationDefinition,
    });

    it("returns the definition only after the matching receipt and discovery are committed", () => {
        expect(select()).toBe(ROOT_TANGLE_OBSERVATION);
        expect(select({ ...baseState, committedAttemptKeys: [] })).toBeUndefined();
        expect(select({ ...baseState, attempts: [] })).toBeUndefined();
        expect(select({ ...baseState, lastEvent: { type: "run-started" } })).toBeUndefined();
        expect(select(baseState, { ...reaction, nodeId: "node-other" })).toBeUndefined();
        expect(select(baseState, { ...reaction, encounterId: "light-bridge" })).toBeUndefined();
        expect(select(baseState, null)).toBeUndefined();
    });

    it("rejects stale, mismatched, and prerequisite-free discoveries", () => {
        expect(select(baseState, reaction, "stale")).toBeUndefined();
        expect(select({ ...baseState, temporaryFinds: [finalDiscovery] })).toBeUndefined();
        expect(select({
            ...baseState,
            lastEvent: {
                type: "discovery",
                discovery: { ...finalDiscovery, nodeId: "node-other" },
            },
        })).toBeUndefined();
    });

    it("derives the final discovery from reducer state instead of a forged reveal object", () => {
        const ordinaryWithSameIdentity = discovery(finalDiscovery.id, PETALS, {
            nodeId: finalDiscovery.nodeId,
            source: finalDiscovery.source,
        });
        expect(select({
            ...baseState,
            lastEvent: { type: "discovery", discovery: ordinaryWithSameIdentity },
        })).toBeUndefined();
        expect(select({
            ...baseState,
            temporaryFinds: priorFinds,
        })).toBeUndefined();
    });

    it("does not let an older committed key authorize a new root discovery", () => {
        const olderAttemptKey = "attempt-old-1";
        const stateWithOnlyOldAttempt = {
            ...baseState,
            committedAttemptKeys: [olderAttemptKey],
            attempts: [{
                ...baseState.attempts[0],
                attemptKey: olderAttemptKey,
                gateId: "gate-old",
                nodeId: "node-1-0",
                encounterId: undefined,
            }],
        };
        const forgedReaction = {
            ...reaction,
            attemptKey: olderAttemptKey,
        };

        expect(select(stateWithOnlyOldAttempt, forgedReaction)).toBeUndefined();
    });

    it.each([
        ["gate", { gateId: "gate-other" }],
        ["attempt number", { attemptNumber: 2 }],
        ["skill", { recordedSkillId: "sub_tiny" }],
        ["node", { nodeId: "node-other" }],
    ])("rejects a reaction with mismatched %s provenance", (_label, mutation) => {
        expect(select(baseState, { ...reaction, ...mutation })).toBeUndefined();
    });
});
