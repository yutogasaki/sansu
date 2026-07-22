import { hashExploreSeed } from "./generator";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    getDiscoveryPageDefinition,
} from "./discoveryPageCatalog";
import { getDiscoveryPageClueFeatureIds } from "./discoveryPage";
import type { DiscoveryPageFeatureId, DiscoveryPageId } from "./discoveryPage";
import { getExploreObservationForEncounter } from "./observationCatalog";
import type {
    DiscoveryInstance,
    DiscoveryKind,
    ExploreEncounterId,
    ExploreNode,
} from "./types";
import type { ExploreRewardPhase } from "./runStructure";

const DISCOVERIES: Record<DiscoveryKind, Array<{ name: string }>> = {
    crystal: [
        { name: "そらいろ水晶" },
        { name: "あさつゆ水晶" },
        { name: "にじの水晶" },
    ],
    fossil: [
        { name: "葉っぱの化石" },
        { name: "うずまき貝の化石" },
        { name: "星もようの化石" },
    ],
    flower: [
        { name: "ほたる花" },
        { name: "しずく花" },
        { name: "わたぐも花" },
    ],
    map: [
        { name: "ひみつの地図" },
        { name: "古い道しるべ" },
        { name: "星砂のメモ" },
    ],
};

const resolveDiscoveryKind = (node: ExploreNode, seed: string): DiscoveryKind => {
    if (node.kind === "crystal") return "crystal";
    if (node.kind === "fossil") return "fossil";
    if (node.kind === "root") return "flower";
    if (node.kind === "bridge" || node.kind === "mystery") return "map";

    const kinds: DiscoveryKind[] = ["crystal", "fossil", "flower", "map"];
    return kinds[hashExploreSeed(`${seed}:${node.id}:kind`) % kinds.length];
};

export interface DiscoveryPageAward {
    readonly pageId: DiscoveryPageId;
    readonly featureId: DiscoveryPageFeatureId;
    readonly observationId?: DiscoveryInstance["observationId"];
}

export interface SelectDiscoveryPageAwardInput {
    readonly encounterId?: ExploreEncounterId;
    readonly discoveredFeatureIds: readonly DiscoveryInstance["discoveryFeatureId"][];
    readonly rewardPhase?: Extract<ExploreRewardPhase, "clue" | "finale">;
}

/**
 * The three clue-role rewards fill the rail in order. Once all clues are
 * present, only the receipt-gated finale role completes the page so every run
 * reaches one authored payoff. A compatible encounter may add observation
 * provenance, but an incompatible learning problem must never erase the
 * payoff or pretend that encounter-specific action happened.
 */
export const selectDiscoveryPageAward = ({
    encounterId,
    discoveredFeatureIds,
    rewardPhase = "clue",
}: SelectDiscoveryPageAwardInput): DiscoveryPageAward | undefined => {
    const discovered = new Set(discoveredFeatureIds.filter((featureId) => featureId !== undefined));
    const nextClueFeatureId = getDiscoveryPageClueFeatureIds(FIREFLY_FLOWER_DISCOVERY_PAGE)
        .find((featureId) => !discovered.has(featureId));
    if (nextClueFeatureId) {
        return {
            pageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            featureId: nextClueFeatureId,
        };
    }

    const bigDiscoveryFeatureId = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId;
    if (discovered.has(bigDiscoveryFeatureId)) return undefined;
    if (rewardPhase !== "finale") return undefined;

    const observation = getExploreObservationForEncounter(encounterId);
    if (
        observation
        && observation.pageId === FIREFLY_FLOWER_DISCOVERY_PAGE.id
        && observation.featureId === bigDiscoveryFeatureId
        && observation.prerequisiteFeatureIds.every((featureId) => discovered.has(featureId))
    ) {
        return {
            pageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            featureId: observation.featureId,
            observationId: observation.id,
        };
    }

    return {
        pageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
        featureId: bigDiscoveryFeatureId,
    };
};

export interface CreateDiscoveryForNodeInput {
    readonly node: ExploreNode;
    readonly seed: string;
    readonly ordinal: number;
    readonly priorDiscoveries: readonly DiscoveryInstance[];
    readonly encounterId?: ExploreEncounterId;
    readonly kindOverride?: DiscoveryKind;
    readonly rewardPhase?: ExploreRewardPhase;
}

export const createDiscoveryForNode = ({
    node,
    seed,
    ordinal,
    priorDiscoveries,
    encounterId,
    kindOverride,
    rewardPhase = "clue",
}: CreateDiscoveryForNodeInput): DiscoveryInstance => {
    const award = rewardPhase === "clue" || rewardPhase === "finale"
        ? selectDiscoveryPageAward({
            encounterId,
            discoveredFeatureIds: priorDiscoveries.map((find) => find.discoveryFeatureId),
            rewardPhase,
        })
        : undefined;
    const kind = kindOverride ?? resolveDiscoveryKind(node, seed);
    const choices = DISCOVERIES[kind];
    const choiceIndex = hashExploreSeed(`${seed}:${node.id}:${ordinal}`) % choices.length;
    const choice = choices[choiceIndex];

    const awardedPage = award ? getDiscoveryPageDefinition(award.pageId) : undefined;
    const discovery: DiscoveryInstance = {
        id: `find-${node.id}-${ordinal}`,
        kind,
        name: choice.name,
        rarity: rewardPhase === "opening"
            ? "common"
            : award?.featureId === awardedPage?.chain.bigDiscoveryFeatureId
            ? "rare"
            : choiceIndex === choices.length - 1 && !award
                ? "rare"
                : "common",
        nodeId: node.id,
    };

    return award ? {
        ...discovery,
        discoveryPageId: award.pageId,
        discoveryFeatureId: award.featureId,
        observationId: award.observationId,
    } : discovery;
};
