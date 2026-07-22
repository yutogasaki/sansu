import type { Problem } from "../types";
import type { DiscoveryPageFeatureId, DiscoveryPageId } from "./discoveryPage";
import type {
    ExploreAttemptCommitReceipt,
    ExploreLearningAssignment,
    ExploreRunRecord,
    ExploreRunFinishReceipt,
} from "./persistenceTypes";

export type ExploreRunStatus = "active" | "returned" | "rescued";

export type ExploreNodeKind =
    | "start"
    | "soil"
    | "crystal"
    | "fossil"
    | "root"
    | "mystery"
    | "bridge";

export type DiscoveryKind = "crystal" | "fossil" | "flower" | "map";
export type ExploreBridgePlan = "wood" | "stones" | "detour";
export type ExploreEncounterId = "light-bridge" | "root-tangle";
export type ExploreEncounterPhase = "loading" | "ready" | "incorrect" | "correct" | "resolved";
export type ExploreObservationId = `explore-observation:${string}`;

export interface ExploreNode {
    id: string;
    depth: number;
    lane: number;
    x: number;
    y: number;
    kind: ExploreNodeKind;
    encounterId?: ExploreEncounterId;
    title: string;
    hint: string;
}

export interface ExploreEdge {
    id: string;
    from: string;
    to: string;
}

export interface DiscoveryInstance {
    id: string;
    kind: DiscoveryKind;
    name: string;
    rarity: "common" | "rare";
    nodeId: string;
    discoveryPageId?: DiscoveryPageId;
    discoveryFeatureId?: DiscoveryPageFeatureId;
    observationId?: ExploreObservationId;
    source?: {
        readonly attemptKey: string;
        readonly gateId: string;
        readonly attemptNumber: number;
        readonly nodeId: string;
        readonly encounterId?: ExploreEncounterId;
        readonly recordedSkillId: string;
        readonly result: "correct";
    };
}

export interface ExploreProblemGate {
    gateId: string;
    nodeId: string;
    actionType: "dig" | "bridge";
    attemptCount: number;
    skillId?: string;
    bridgePlan?: ExploreBridgePlan;
    encounterId?: ExploreEncounterId;
    problemRefreshPending?: boolean;
    problem?: Problem;
    learningAssignment?: ExploreLearningAssignment;
}

export interface ExploreAttempt {
    attemptKey: string;
    gateId: string;
    nodeId: string;
    encounterId?: ExploreEncounterId;
    skillId: string;
    result: "correct" | "incorrect";
    attemptNumber: number;
}

export type ExploreEvent =
    | { type: "run-started" }
    | { type: "node-selected"; nodeId: string }
    | { type: "discovery"; discovery: DiscoveryInstance }
    | { type: "incorrect"; nodeId: string; attemptCount: number }
    | { type: "returned" }
    | { type: "rescued" };

export interface ExploreRunConfig {
    maxEnergy: number;
    correctEnergyCost: number;
    incorrectEnergyCost: number;
}

export interface ExploreRunState {
    runId: string;
    profileId?: string;
    seed: string;
    status: ExploreRunStatus;
    startedAt: number;
    currentNodeId: string;
    energy: number;
    maxEnergy: number;
    combo: number;
    steps: number;
    incorrectAnswers: number;
    nodes: ExploreNode[];
    edges: ExploreEdge[];
    openedNodeIds: string[];
    temporaryFinds: DiscoveryInstance[];
    confirmedFinds: DiscoveryInstance[];
    attempts: ExploreAttempt[];
    committedAttemptKeys: string[];
    pendingProblem?: ExploreProblemGate;
    lastEvent: ExploreEvent;
    rescuePending: boolean;
    config: ExploreRunConfig;
}

export type ExploreAction =
    | { type: "RESET"; state: ExploreRunState }
    | { type: "APPLY_STARTED_RUN"; run: ExploreRunRecord }
    | { type: "SELECT_NODE"; nodeId: string }
    | { type: "CHOOSE_BRIDGE"; plan: ExploreBridgePlan }
    | {
        type: "SET_PROBLEM";
        problem: Problem;
        assignment: ExploreLearningAssignment;
        encounterId?: ExploreEncounterId;
    }
    | {
        type: "APPLY_COMMITTED_ATTEMPT";
        receipt: ExploreAttemptCommitReceipt;
        expectedResult: "correct" | "incorrect";
    }
    | { type: "ADVANCE_AFTER_INCORRECT" }
    | { type: "APPLY_FINISHED_RUN"; receipt: ExploreRunFinishReceipt };

export interface CreateExploreRunOptions {
    seed?: string;
    now?: number;
    config?: Partial<ExploreRunConfig>;
}
