import { createExploreMap, getAvailableNodeIds } from "./generator";
import { resolveExploreEncounterId } from "./encounters";
import { createAttemptIdentityKey } from "./attemptIdentity";
import { isExploreProblemCompatible } from "./problemAdapter";
import { createDiscoveryForNode } from "./rewards";
import { MAKIMODON_DISCOVERY_PAGE } from "./discoveryPageCatalog";
import type {
    CreateExploreRunOptions,
    ExploreAction,
    ExploreRunConfig,
    ExploreRunState,
} from "./types";

export const DEFAULT_EXPLORE_CONFIG: ExploreRunConfig = {
    maxEnergy: 12,
    correctEnergyCost: 1,
    incorrectEnergyCost: 1,
};

const normalizeInteger = (value: number | undefined, fallback: number, minimum: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(minimum, Math.round(value as number));
};

const normalizeConfig = (config: Partial<ExploreRunConfig> = {}): ExploreRunConfig => ({
    maxEnergy: normalizeInteger(config.maxEnergy, DEFAULT_EXPLORE_CONFIG.maxEnergy, 1),
    correctEnergyCost: normalizeInteger(
        config.correctEnergyCost,
        DEFAULT_EXPLORE_CONFIG.correctEnergyCost,
        0,
    ),
    incorrectEnergyCost: normalizeInteger(
        config.incorrectEnergyCost,
        DEFAULT_EXPLORE_CONFIG.incorrectEnergyCost,
        0,
    ),
});

const createRunId = (seed: string, now: number) => `explore-${seed}-${now}`;

export const createInitialExploreState = (
    options: CreateExploreRunOptions = {},
): ExploreRunState => {
    const now = options.now ?? Date.now();
    const seed = options.seed ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const config = normalizeConfig(options.config);
    const { nodes, edges } = createExploreMap(seed);

    return {
        runId: createRunId(seed, now),
        seed,
        status: "active",
        startedAt: now,
        currentNodeId: "start",
        energy: config.maxEnergy,
        maxEnergy: config.maxEnergy,
        combo: 0,
        steps: 0,
        incorrectAnswers: 0,
        nodes,
        edges,
        openedNodeIds: ["start"],
        temporaryFinds: [],
        confirmedFinds: [],
        attempts: [],
        committedAttemptKeys: [],
        lastEvent: { type: "run-started" },
        rescuePending: false,
        config,
    };
};

const finishRescue = (state: ExploreRunState): ExploreRunState => ({
    ...state,
    energy: 0,
    status: "rescued",
    pendingProblem: undefined,
    confirmedFinds: [...state.temporaryFinds],
    rescuePending: false,
    lastEvent: { type: "rescued" },
});

const isReceiptForPendingGate = (
    state: ExploreRunState,
    action: Extract<ExploreAction, { type: "APPLY_COMMITTED_ATTEMPT" }>,
) => {
    const gate = state.pendingProblem;
    const { receipt, expectedResult } = action;
    if (!gate?.problem || !gate.learningAssignment) return false;
    if (gate.actionType === "bridge" && !gate.bridgePlan) return false;
    if (receipt.result !== "correct" && receipt.result !== "incorrect") return false;
    if (receipt.result !== expectedResult) return false;
    if (!state.profileId || receipt.identity.profileId !== state.profileId) return false;
    if (receipt.affectsSrs !== gate.learningAssignment.affectsSrs) return false;
    if (receipt.assignmentKey !== gate.learningAssignment.assignmentKey) return false;
    if (receipt.learningSource !== gate.learningAssignment.source) return false;
    if (receipt.identity.runId !== state.runId) return false;
    if (receipt.identity.gateId !== gate.gateId) return false;
    if (receipt.identity.attemptNumber !== gate.attemptCount + 1) return false;
    if (receipt.recordedSkillId !== gate.problem.categoryId) return false;
    return receipt.attemptKey === createAttemptIdentityKey(receipt.identity);
};

export const exploreReducer = (
    state: ExploreRunState,
    action: ExploreAction,
): ExploreRunState => {
    if (action.type === "RESET") return action.state;
    if (state.status !== "active") return state;
    if (state.rescuePending && action.type !== "APPLY_FINISHED_RUN") return state;

    switch (action.type) {
        case "APPLY_STARTED_RUN": {
            if (
                action.run.runId !== state.runId
                || action.run.seed !== state.seed
                || action.run.startedAt !== state.startedAt
                || action.run.status !== "active"
                || (state.profileId !== undefined && state.profileId !== action.run.profileId)
            ) return state;
            if (state.profileId === action.run.profileId) return state;
            return { ...state, profileId: action.run.profileId };
        }

        case "SELECT_NODE": {
            if (!state.profileId || state.pendingProblem || state.energy <= 0) return state;
            const availableNodeIds = getAvailableNodeIds(
                state.currentNodeId,
                state.edges,
                state.openedNodeIds,
            );
            if (!availableNodeIds.includes(action.nodeId)) return state;
            const node = state.nodes.find((candidate) => candidate.id === action.nodeId);
            if (!node) return state;

            return {
                ...state,
                pendingProblem: {
                    gateId: `${state.runId}:${node.id}`,
                    nodeId: node.id,
                    actionType: node.kind === "bridge" ? "bridge" : "dig",
                    attemptCount: 0,
                },
                lastEvent: { type: "node-selected", nodeId: node.id },
            };
        }

        case "CHOOSE_BRIDGE": {
            if (!state.pendingProblem || state.pendingProblem.actionType !== "bridge") return state;
            if (state.pendingProblem.problem || state.pendingProblem.bridgePlan) return state;
            return {
                ...state,
                pendingProblem: { ...state.pendingProblem, bridgePlan: action.plan },
            };
        }

        case "SET_PROBLEM": {
            const gate = state.pendingProblem;
            if (!gate || gate.problem) return state;
            if (gate.actionType === "bridge" && !gate.bridgePlan) return state;
            if (!isExploreProblemCompatible(action.problem)) {
                return state;
            }
            if (
                !action.assignment
                || !state.profileId
                || action.assignment.profileId !== state.profileId
                || action.assignment.runId !== state.runId
                || action.assignment.gateId !== gate.gateId
                || action.assignment.problemId !== action.problem.id
                || action.assignment.categoryId !== action.problem.categoryId
            ) return state;
            const expectedEncounterId = resolveExploreEncounterId(state, gate, action.problem);
            if (action.encounterId !== expectedEncounterId) return state;
            return {
                ...state,
                pendingProblem: {
                    ...gate,
                    skillId: gate.skillId ?? action.problem.categoryId,
                    encounterId: action.encounterId,
                    problemRefreshPending: false,
                    problem: action.problem,
                    learningAssignment: action.assignment,
                },
            };
        }

        case "APPLY_COMMITTED_ATTEMPT": {
            if (state.committedAttemptKeys.includes(action.receipt.attemptKey)) return state;
            if (!isReceiptForPendingGate(state, action)) return state;
            if (action.receipt.result === "incorrect") {
                const gate = state.pendingProblem;
                if (!gate?.problem) return state;
                const energy = Math.max(0, state.energy - state.config.incorrectEnergyCost);
                const attemptCount = action.receipt.identity.attemptNumber;
                const rescuePending = energy === 0;
                return {
                    ...state,
                    energy,
                    combo: 0,
                    incorrectAnswers: state.incorrectAnswers + 1,
                    committedAttemptKeys: [
                        ...state.committedAttemptKeys,
                        action.receipt.attemptKey,
                    ],
                    attempts: [
                        ...state.attempts,
                        {
                            attemptKey: action.receipt.attemptKey,
                            gateId: gate.gateId,
                            nodeId: gate.nodeId,
                            encounterId: gate.encounterId,
                            skillId: action.receipt.recordedSkillId,
                            result: "incorrect",
                            attemptNumber: attemptCount,
                        },
                    ],
                    pendingProblem: rescuePending
                        ? undefined
                        : {
                            ...gate,
                            skillId: action.receipt.recordedSkillId,
                            attemptCount,
                            problemRefreshPending: attemptCount >= 2,
                            problem: gate.problem,
                        },
                    lastEvent: {
                        type: "incorrect",
                        nodeId: gate.nodeId,
                        attemptCount,
                    },
                    rescuePending,
                };
            }

            const gate = state.pendingProblem;
            if (!gate?.problem) return state;
            const node = state.nodes.find((candidate) => candidate.id === gate.nodeId);
            if (!node) return state;
            const bridgeDiscoveryKind = gate.bridgePlan === "stones"
                ? "crystal"
                : gate.bridgePlan === "detour"
                    ? "flower"
                    : gate.bridgePlan === "wood"
                        ? "map"
                        : undefined;
            const discovery = {
                ...createDiscoveryForNode({
                node,
                seed: state.seed,
                ordinal: state.temporaryFinds.length,
                priorDiscoveries: state.temporaryFinds,
                encounterId: gate.encounterId,
                kindOverride: bridgeDiscoveryKind,
                preferMakimodon: state.steps < MAKIMODON_DISCOVERY_PAGE.chain.featureIds.length,
                }),
                source: {
                    attemptKey: action.receipt.attemptKey,
                    gateId: gate.gateId,
                    attemptNumber: action.receipt.identity.attemptNumber,
                    nodeId: gate.nodeId,
                    encounterId: gate.encounterId,
                    recordedSkillId: action.receipt.recordedSkillId,
                    result: "correct" as const,
                },
            };
            const actionEnergyCost = gate.bridgePlan === "stones"
                ? state.config.correctEnergyCost + 1
                : state.config.correctEnergyCost;
            const energy = Math.max(0, state.energy - actionEnergyCost);

            return {
                ...state,
                currentNodeId: node.id,
                energy,
                combo: state.combo + 1,
                steps: state.steps + 1,
                openedNodeIds: [...state.openedNodeIds, node.id],
                temporaryFinds: [...state.temporaryFinds, discovery],
                committedAttemptKeys: [
                    ...state.committedAttemptKeys,
                    action.receipt.attemptKey,
                ],
                attempts: [
                    ...state.attempts,
                    {
                        attemptKey: action.receipt.attemptKey,
                        gateId: gate.gateId,
                        nodeId: gate.nodeId,
                        encounterId: gate.encounterId,
                        skillId: action.receipt.recordedSkillId,
                        result: "correct",
                        attemptNumber: action.receipt.identity.attemptNumber,
                    },
                ],
                pendingProblem: undefined,
                lastEvent: { type: "discovery", discovery },
                rescuePending: energy === 0,
            };
        }

        case "ADVANCE_AFTER_INCORRECT": {
            const gate = state.pendingProblem;
            if (!gate?.problemRefreshPending) return state;
            return {
                ...state,
                pendingProblem: {
                    ...gate,
                    problemRefreshPending: false,
                    problem: undefined,
                    learningAssignment: undefined,
                },
            };
        }

        case "APPLY_FINISHED_RUN": {
            const { receipt } = action;
            if (receipt.runId !== state.runId) return state;
            if (!state.profileId || receipt.profileId !== state.profileId) return state;
            if (receipt.status === "returned") {
                if (state.rescuePending || state.pendingProblem) return state;
                return {
                    ...state,
                    status: "returned",
                    pendingProblem: undefined,
                    confirmedFinds: [...state.temporaryFinds],
                    rescuePending: false,
                    lastEvent: { type: "returned" },
                };
            }
            if (receipt.status === "rescued" && state.rescuePending && state.energy === 0) {
                return finishRescue(state);
            }
            return state;
        }
    }
};

export const getAvailableExploreNodes = (state: ExploreRunState) => {
    const ids = getAvailableNodeIds(state.currentNodeId, state.edges, state.openedNodeIds);
    return state.nodes.filter((node) => ids.includes(node.id));
};
