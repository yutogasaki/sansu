import { describe, expect, it } from "vitest";
import type { Problem } from "../../types";
import {
    getExploreEncounterDefinition,
    getPreferredExploreEncounterSkillCandidates,
    getRequestedExploreEncounterId,
    isExploreEncounterSkillCompatible,
    resolveExploreEncounterId,
} from "../encounters";
import { createInitialExploreState } from "../reducer";
import type { ExploreProblemGate } from "../types";

const ADDITION_PROBLEM: Pick<Problem, "categoryId" | "questionVisual"> = {
    categoryId: "add_1d_1_bridge",
    questionVisual: {
        kind: "addition-items",
        groups: [
            { emoji: "✨", label: "ひかり", count: 1 },
            { emoji: "✨", label: "ひかり", count: 1 },
        ],
    },
};
const SUBTRACTION_PROBLEM: Pick<Problem, "categoryId" | "questionVisual"> = {
    categoryId: "sub_1d1d_nc_bridge",
    questionVisual: {
        kind: "subtraction-items",
        group: { emoji: "🌱", label: "ねっこ", count: 2 },
        takenAwayCount: 1,
    },
};
const MULTIPLICATION_PROBLEM: Pick<Problem, "categoryId" | "questionVisual"> = {
    categoryId: "mul_99_2",
    questionVisual: undefined,
};

const createLightBridgeGate = (): ExploreProblemGate => ({
    gateId: "light-bridge",
    nodeId: "node-1-0",
    actionType: "bridge",
    bridgePlan: "stones",
    attemptCount: 0,
});

const createRootTangleGate = (state: ReturnType<typeof createInitialExploreState>): ExploreProblemGate => {
    const node = state.nodes.find((candidate) => candidate.encounterId === "root-tangle");
    if (!node) throw new Error("Expected a generated root-tangle node");
    return {
        gateId: "root-tangle",
        nodeId: node.id,
        actionType: "dig",
        attemptCount: 0,
    };
};

describe("exploration encounter registry", () => {
    it("requests the light bridge only for the matching bridge plan", () => {
        const state = createInitialExploreState({ seed: "encounter", now: 100 });
        const gate = createLightBridgeGate();

        expect(getRequestedExploreEncounterId(state, gate)).toBe("light-bridge");
        expect(getRequestedExploreEncounterId(state, { ...gate, bridgePlan: "wood" })).toBeUndefined();
    });

    it("resolves an encounter only when the selected skill matches its world action", () => {
        const state = createInitialExploreState({ seed: "encounter", now: 100 });
        const gate = createLightBridgeGate();

        expect(resolveExploreEncounterId(state, gate, ADDITION_PROBLEM)).toBe("light-bridge");
        expect(resolveExploreEncounterId(state, gate, MULTIPLICATION_PROBLEM)).toBeUndefined();
        expect(resolveExploreEncounterId(state, gate, {
            categoryId: ADDITION_PROBLEM.categoryId,
            questionVisual: undefined,
        })).toBeUndefined();
        expect(isExploreEncounterSkillCompatible("light-bridge", "add_2d1d_nc_bridge")).toBe(true);
        expect(isExploreEncounterSkillCompatible("light-bridge", "add_2d1d_nc")).toBe(false);
        expect(isExploreEncounterSkillCompatible("light-bridge", "sub_1d1d_nc")).toBe(false);
    });

    it("requests the root tangle only for its explicitly marked root node", () => {
        const state = createInitialExploreState({ seed: "root-encounter", now: 100 });
        const gate = createRootTangleGate(state);
        const genericNode = state.nodes.find((candidate) => candidate.id !== gate.nodeId);
        if (!genericNode) throw new Error("Expected a generic generated node");
        const genericRootState = {
            ...state,
            nodes: state.nodes.map((node) => node.id === genericNode.id
                ? { ...node, kind: "root" as const, encounterId: undefined }
                : node),
        };

        expect(getRequestedExploreEncounterId(state, gate)).toBe("root-tangle");
        expect(getRequestedExploreEncounterId(genericRootState, {
            ...gate,
            gateId: "generic-root",
            nodeId: genericNode.id,
        })).toBeUndefined();
    });

    it("resolves the root tangle only for subtraction skills", () => {
        const state = createInitialExploreState({ seed: "root-skill", now: 100 });
        const gate = createRootTangleGate(state);

        expect(resolveExploreEncounterId(state, gate, SUBTRACTION_PROBLEM)).toBe("root-tangle");
        expect(resolveExploreEncounterId(state, gate, ADDITION_PROBLEM)).toBeUndefined();
        expect(isExploreEncounterSkillCompatible("root-tangle", "sub_2d1d_nc_bridge")).toBe(true);
        expect(isExploreEncounterSkillCompatible("root-tangle", "sub_2d1d_diff")).toBe(false);
        expect(isExploreEncounterSkillCompatible("root-tangle", "add_2d1d_nc")).toBe(false);
    });

    it("prefers visual and strategy subtraction representations for the root tangle", () => {
        expect(getPreferredExploreEncounterSkillCandidates("root-tangle", [
            "sub_2d1d_nc",
            "sub_2d1d_diff",
            "sub_2d1d_nc_bridge",
            "add_2d1d_nc_bridge",
        ])).toEqual(["sub_2d1d_nc_bridge"]);
    });

    it("prefers bridge representations without leaving the supplied candidate group", () => {
        expect(getPreferredExploreEncounterSkillCandidates("light-bridge", [
            "sub_2d1d_nc_bridge",
            "add_2d1d_nc",
            "add_2d1d_nc_bridge",
        ])).toEqual(["add_2d1d_nc_bridge"]);
    });

    it("keeps timing with the encounter definition instead of the page", () => {
        expect(getExploreEncounterDefinition("light-bridge")).toEqual(expect.objectContaining({
            correctHoldMs: 320,
            revealDelayMs: 80,
        }));
    });
});
