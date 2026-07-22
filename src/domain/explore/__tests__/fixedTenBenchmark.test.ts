import { describe, expect, it } from "vitest";
import { createInitialExploreState } from "../reducer";
import { createFixedTenExploreBenchmarkPlan } from "../learningPlanner";
import type { ExploreProblemGate } from "../types";

const createGate = (
    runId: string,
    nodeId: string,
    attemptCount = 0,
): ExploreProblemGate => ({
    gateId: `${runId}:${nodeId}`,
    nodeId,
    actionType: "dig",
    attemptCount,
});

describe("fixed-ten Explore benchmark plan", () => {
    it("derives the fixture index from run progress without a mutable cursor", () => {
        const initial = createInitialExploreState({ seed: "fixed-ten", now: 100 });
        const state = { ...initial, steps: 3 };
        const gate = createGate(state.runId, state.nodes[1]!.id);

        const plan = createFixedTenExploreBenchmarkPlan(state, gate, 0);

        expect(plan?.problem).toMatchObject({
            questionText: "5 + 3 =",
            correctAnswer: "8",
            categoryId: "add_1d_1",
            inputType: "number",
            isReview: false,
            isMaintenanceCheck: false,
        });
        expect(plan?.problem.id).toContain(":benchmark-3:attempt-0");
    });

    it("uses an explicit second-run offset and rejects positions after Q10", () => {
        const initial = createInitialExploreState({ seed: "fixed-ten-replay", now: 200 });
        const state = { ...initial, steps: 1 };
        const gate = createGate(state.runId, state.nodes[1]!.id, 1);

        expect(createFixedTenExploreBenchmarkPlan(state, gate, 8)?.problem).toMatchObject({
            questionText: "9 + 1 =",
            correctAnswer: "10",
        });
        expect(createFixedTenExploreBenchmarkPlan({ ...state, steps: 2 }, gate, 8))
            .toBeUndefined();
    });
});
