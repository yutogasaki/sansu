export const EXPLORE_OPENING_ANSWER_COUNT = 3;
export const EXPLORE_BIG_DISCOVERY_ANSWER_COUNT = 7;
export const EXPLORE_RUN_ANSWER_COUNT = 8;

export type ExploreRewardPhase = "opening" | "clue" | "finale" | "terminal";
export type ExplorePathChoiceMode = "routes" | "return-ready" | "invalid-dead-end";

/**
 * Run structure is gameplay policy, not presentation policy. Keeping it here
 * prevents a visual candidate or a legacy discovery page from changing when
 * research rewards begin.
 */
export const getExploreRewardPhase = (completedSteps: number): ExploreRewardPhase => (
    completedSteps >= 0 && completedSteps < EXPLORE_OPENING_ANSWER_COUNT
        ? "opening"
        : completedSteps < EXPLORE_BIG_DISCOVERY_ANSWER_COUNT - 1
            ? "clue"
            : completedSteps === EXPLORE_BIG_DISCOVERY_ANSWER_COUNT - 1
                ? "finale"
                : "terminal"
);

export const isExploreOpeningStep = (completedSteps: number): boolean => (
    getExploreRewardPhase(completedSteps) === "opening"
);

export const willCompleteExploreOpeningStep = (completedSteps: number): boolean => (
    isExploreOpeningStep(completedSteps)
    && completedSteps + 1 === EXPLORE_OPENING_ANSWER_COUNT
);

export const isExploreOpeningCompletion = (completedSteps: number): boolean => (
    completedSteps === EXPLORE_OPENING_ANSWER_COUNT
);

export const selectExplorePathChoiceMode = (
    completedSteps: number,
    availableNodeCount: number,
): ExplorePathChoiceMode => {
    if (completedSteps >= EXPLORE_RUN_ANSWER_COUNT) return "return-ready";
    return availableNodeCount > 0 ? "routes" : "invalid-dead-end";
};
