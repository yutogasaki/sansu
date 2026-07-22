import type { DiscoveryPageFeatureId, DiscoveryPageId } from "./discoveryPage";
import type {
    ExploreEncounterId,
    ExploreObservationId,
    ExploreRunState,
} from "./types";

export interface ExploreObservationDefinition {
    readonly id: ExploreObservationId;
    readonly encounterId: ExploreEncounterId;
    readonly pageId: DiscoveryPageId;
    readonly featureId: DiscoveryPageFeatureId;
    readonly prerequisiteFeatureIds: readonly DiscoveryPageFeatureId[];
    readonly camera: {
        readonly key: string;
        readonly objectPosition: string;
    };
    readonly copy: {
        readonly kicker: string;
        readonly title: string;
        readonly action: string;
        readonly reaction: string;
        readonly finding: string;
    };
}

export interface CommittedExploreWorldReactionIdentity {
    readonly attemptKey: string;
    readonly gateId: string;
    readonly attemptNumber: number;
    readonly nodeId: string;
    readonly encounterId?: ExploreEncounterId;
    readonly recordedSkillId: string;
    readonly result: "correct";
}

export interface SelectExploreObservationInput {
    readonly state: Pick<
        ExploreRunState,
        "attempts" | "committedAttemptKeys" | "lastEvent" | "temporaryFinds"
    >;
    readonly reaction: CommittedExploreWorldReactionIdentity | null | undefined;
    readonly revealedDiscoveryId: string | null | undefined;
    readonly getDefinition: (
        observationId: ExploreObservationId | undefined,
    ) => ExploreObservationDefinition | undefined;
}

/**
 * Joins the receipt-gated world reaction to the reducer-created discovery.
 * A raw correct answer or an API response that has not been accepted by the
 * reducer can never produce an observation presentation.
 */
export const selectExploreObservation = ({
    state,
    reaction,
    revealedDiscoveryId,
    getDefinition,
}: SelectExploreObservationInput): ExploreObservationDefinition | undefined => {
    if (!reaction || !reaction.encounterId || !revealedDiscoveryId) return undefined;
    if (!state.committedAttemptKeys.includes(reaction.attemptKey)) return undefined;
    if (state.lastEvent.type !== "discovery") return undefined;
    const discovery = state.lastEvent.discovery;
    if (discovery.id !== revealedDiscoveryId) return undefined;
    if (discovery.nodeId !== reaction.nodeId) return undefined;

    const source = discovery.source;
    if (!source) return undefined;
    if (
        source.attemptKey !== reaction.attemptKey
        || source.gateId !== reaction.gateId
        || source.attemptNumber !== reaction.attemptNumber
        || source.nodeId !== reaction.nodeId
        || source.encounterId !== reaction.encounterId
        || source.recordedSkillId !== reaction.recordedSkillId
        || source.result !== reaction.result
    ) return undefined;
    const committedAttempt = state.attempts.find((attempt) => (
        attempt.attemptKey === reaction.attemptKey
        && attempt.gateId === reaction.gateId
        && attempt.attemptNumber === reaction.attemptNumber
        && attempt.nodeId === reaction.nodeId
        && attempt.encounterId === reaction.encounterId
        && attempt.skillId === reaction.recordedSkillId
        && attempt.result === reaction.result
    ));
    if (!committedAttempt) return undefined;

    const recordedDiscovery = state.temporaryFinds.find((find) => find.id === discovery.id);
    if (
        !recordedDiscovery
        || recordedDiscovery.nodeId !== discovery.nodeId
        || recordedDiscovery.discoveryPageId !== discovery.discoveryPageId
        || recordedDiscovery.discoveryFeatureId !== discovery.discoveryFeatureId
        || recordedDiscovery.observationId !== discovery.observationId
        || recordedDiscovery.source?.attemptKey !== source.attemptKey
        || recordedDiscovery.source?.gateId !== source.gateId
        || recordedDiscovery.source?.attemptNumber !== source.attemptNumber
        || recordedDiscovery.source?.nodeId !== source.nodeId
        || recordedDiscovery.source?.encounterId !== source.encounterId
        || recordedDiscovery.source?.recordedSkillId !== source.recordedSkillId
        || recordedDiscovery.source?.result !== source.result
    ) return undefined;

    const definition = getDefinition(discovery.observationId);
    if (!definition || definition.encounterId !== reaction.encounterId) return undefined;
    if (
        discovery.discoveryPageId !== definition.pageId
        || discovery.discoveryFeatureId !== definition.featureId
    ) return undefined;

    const discoveredFeatureIds = new Set(state.temporaryFinds.flatMap((find) => (
        find.discoveryPageId === definition.pageId && find.discoveryFeatureId
            ? [find.discoveryFeatureId]
            : []
    )));
    if (!definition.prerequisiteFeatureIds.every((featureId) => discoveredFeatureIds.has(featureId))) {
        return undefined;
    }

    return definition;
};
