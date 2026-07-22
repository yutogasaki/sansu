import type {
    ExploreEncounterId,
    ExploreEncounterPhase,
} from "./types";

export type ExploreEncounterProblemPhase = Extract<
    ExploreEncounterPhase,
    "ready" | "incorrect" | "correct"
>;

export interface ExploreEncounterPhaseSnapshot {
    encounterId?: ExploreEncounterId;
    hasProblem: boolean;
    feedback: "idle" | "incorrect" | "correct";
    hasWorldReaction: boolean;
}

/**
 * Selects the encounter presentation phase from the existing page state.
 * Problem presence intentionally takes precedence over the world reaction:
 * the reaction starts as soon as an answer is correct, while the correct
 * encounter frame remains visible until the answer hold finishes.
 */
export const selectExploreEncounterPhase = ({
    encounterId,
    hasProblem,
    feedback,
    hasWorldReaction,
}: ExploreEncounterPhaseSnapshot): ExploreEncounterPhase | undefined => {
    if (!encounterId) return undefined;

    if (hasProblem) {
        if (feedback === "correct") return "correct";
        if (feedback === "incorrect") return "incorrect";
        return "ready";
    }

    return hasWorldReaction ? "resolved" : "loading";
};
