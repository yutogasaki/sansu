import {
    getDiscoveryPageDefinition,
} from "./discoveryPageCatalog";
import { isDiscoveryPageBigDiscovery } from "./discoveryPage";
import {
    EXPLORE_OPENING_ANSWER_COUNT,
    EXPLORE_RUN_ANSWER_COUNT,
} from "./runStructure";
import type { DiscoveryInstance } from "./types";

export type ExploreDiscoveryPresentation =
    | "absorbed-opening"
    | "ambient"
    | "blocking"
    | "deferred-return";

export const isExploreBigDiscovery = (
    discovery: Pick<DiscoveryInstance, "discoveryPageId" | "discoveryFeatureId">,
): boolean => {
    if (!discovery.discoveryPageId || !discovery.discoveryFeatureId) return false;
    const definition = getDiscoveryPageDefinition(discovery.discoveryPageId);
    return Boolean(
        definition
        && isDiscoveryPageBigDiscovery(definition, discovery.discoveryFeatureId),
    );
};

export interface SelectExploreDiscoveryPresentationInput {
    readonly discovery: Pick<
        DiscoveryInstance,
        "discoveryPageId" | "discoveryFeatureId"
    >;
    /** State step count after the discovery has been committed. */
    readonly completedSteps: number;
    readonly hasAvailableNodes: boolean;
    readonly rescuePending: boolean;
}

/**
 * Stops are earned by semantic role, never by random rarity. The result is
 * selected once when a committed discovery arrives so later UI changes cannot
 * turn an ambient reward into a modal.
 */
export const selectExploreDiscoveryPresentation = ({
    discovery,
    completedSteps,
    hasAvailableNodes,
    rescuePending,
}: SelectExploreDiscoveryPresentationInput): ExploreDiscoveryPresentation => {
    if (isExploreBigDiscovery(discovery)) return "blocking";
    if (completedSteps > 0 && completedSteps <= EXPLORE_OPENING_ANSWER_COUNT) {
        return "absorbed-opening";
    }
    if (rescuePending) return "deferred-return";
    if (!hasAvailableNodes && completedSteps >= EXPLORE_RUN_ANSWER_COUNT) {
        return "deferred-return";
    }
    return "ambient";
};
