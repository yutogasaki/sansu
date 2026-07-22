import { getMathSkillMetadata } from "../math/curriculum";
import type { Problem } from "../types";
import type {
    ExploreBridgePlan,
    ExploreEncounterId,
    ExploreNodeKind,
    ExploreProblemGate,
    ExploreRunState,
} from "./types";

type ExploreEncounterSkillPrefix = "add_" | "sub_" | "mul_" | "div_";

interface ExploreEncounterGateRule {
    actionType?: ExploreProblemGate["actionType"];
    bridgePlan?: ExploreBridgePlan;
    nodeKinds?: readonly ExploreNodeKind[];
    nodeEncounterId?: ExploreEncounterId;
}

export interface ExploreEncounterDefinition {
    id: ExploreEncounterId;
    worldAction: "combine" | "remove" | "group" | "share";
    gate: ExploreEncounterGateRule;
    compatibleSkillIds?: readonly string[];
    compatibleSkillPrefixes: readonly ExploreEncounterSkillPrefix[];
    preferredRepresentations: readonly string[];
    correctHoldMs: number;
    revealDelayMs: number;
}

const ENCOUNTER_DEFINITIONS: readonly ExploreEncounterDefinition[] = [
    {
        id: "light-bridge",
        worldAction: "combine",
        gate: { actionType: "bridge", bridgePlan: "stones" },
        compatibleSkillIds: [
            "add_1d_1_bridge",
            "add_1d_2_bridge",
            "add_2d1d_nc_bridge",
            "add_2d1d_c_bridge",
        ],
        compatibleSkillPrefixes: ["add_"],
        preferredRepresentations: ["bridge", "concrete", "strategy", "symbol", "mental", "algorithm"],
        correctHoldMs: 320,
        revealDelayMs: 80,
    },
    {
        id: "root-tangle",
        worldAction: "remove",
        gate: {
            actionType: "dig",
            nodeKinds: ["root"],
            nodeEncounterId: "root-tangle",
        },
        compatibleSkillIds: [
            "sub_tiny",
            "sub_1d1d_nc_bridge",
            "sub_1d1d_c_bridge",
            "sub_2d1d_nc_bridge",
            "sub_2d1d_c_bridge",
        ],
        compatibleSkillPrefixes: ["sub_"],
        preferredRepresentations: ["bridge", "concrete", "strategy", "reverse", "symbol", "algorithm"],
        correctHoldMs: 320,
        revealDelayMs: 80,
    },
];

const ENCOUNTERS_BY_ID = new Map(
    ENCOUNTER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const getExploreEncounterDefinition = (
    encounterId: ExploreEncounterId | undefined,
): ExploreEncounterDefinition | undefined => (
    encounterId ? ENCOUNTERS_BY_ID.get(encounterId) : undefined
);

const gateMatches = (
    definition: ExploreEncounterDefinition,
    state: ExploreRunState,
    gate: ExploreProblemGate,
) => {
    if (definition.gate.actionType && gate.actionType !== definition.gate.actionType) return false;
    if (definition.gate.bridgePlan && gate.bridgePlan !== definition.gate.bridgePlan) return false;

    if (definition.gate.nodeKinds || definition.gate.nodeEncounterId) {
        const node = state.nodes.find((candidate) => candidate.id === gate.nodeId);
        if (!node) return false;
        if (definition.gate.nodeKinds && !definition.gate.nodeKinds.includes(node.kind)) return false;
        if (
            definition.gate.nodeEncounterId
            && node.encounterId !== definition.gate.nodeEncounterId
        ) return false;
    }

    return true;
};

export const getRequestedExploreEncounterId = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
): ExploreEncounterId | undefined => (
    ENCOUNTER_DEFINITIONS.find((definition) => gateMatches(definition, state, gate))?.id
);

export const isExploreEncounterSkillCompatible = (
    encounterId: ExploreEncounterId,
    skillId: string,
) => {
    const definition = getExploreEncounterDefinition(encounterId);
    if (definition?.compatibleSkillIds) {
        return definition.compatibleSkillIds.includes(skillId);
    }
    return Boolean(definition?.compatibleSkillPrefixes.some((prefix) => skillId.startsWith(prefix)));
};

export const getPreferredExploreEncounterSkillCandidates = (
    encounterId: ExploreEncounterId,
    candidates: string[],
) => {
    const definition = getExploreEncounterDefinition(encounterId);
    if (!definition) return [];

    const representationIndex = (skillId: string) => {
        const representation = getMathSkillMetadata(skillId).representation;
        const index = definition.preferredRepresentations.indexOf(representation);
        return index < 0 ? definition.preferredRepresentations.length : index;
    };

    return candidates
        .filter((skillId) => isExploreEncounterSkillCompatible(encounterId, skillId))
        .sort((left, right) => representationIndex(left) - representationIndex(right));
};

export const resolveExploreEncounterId = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    problem: Pick<Problem, "categoryId" | "questionVisual">,
): ExploreEncounterId | undefined => {
    const requested = getRequestedExploreEncounterId(state, gate);
    if (!requested || !problem.questionVisual) return undefined;
    return isExploreEncounterSkillCompatible(requested, problem.categoryId)
        ? requested
        : undefined;
};
