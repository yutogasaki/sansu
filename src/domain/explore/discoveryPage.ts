export type DiscoveryPageId = `discovery-page:${string}`;
export type DiscoveryPageFeatureId = `discovery-feature:${string}`;
export type DiscoveryPageChainId = `discovery-chain:${string}`;

export interface DiscoveryPageFeature {
    readonly id: DiscoveryPageFeatureId;
    readonly title: string;
    /** Copy shown before this feature is found. */
    readonly clue: string;
    /** Copy recorded after this feature is found. */
    readonly finding: string;
}

export interface DiscoveryPageChain {
    readonly id: DiscoveryPageChainId;
    /** Ordered from the first small feature to the final big discovery. */
    readonly featureIds: readonly [DiscoveryPageFeatureId, ...DiscoveryPageFeatureId[]];
    readonly bigDiscoveryFeatureId: DiscoveryPageFeatureId;
}

export interface DiscoveryPageDefinition {
    readonly id: DiscoveryPageId;
    readonly title: string;
    readonly subjectName: string;
    readonly features: readonly [DiscoveryPageFeature, ...DiscoveryPageFeature[]];
    readonly chain: DiscoveryPageChain;
}

export interface DiscoveryPageClue {
    readonly pageId: DiscoveryPageId;
    readonly chainId: DiscoveryPageChainId;
    readonly targetFeatureId: DiscoveryPageFeatureId;
    readonly copy: string;
}

export interface DiscoveryPageProgress {
    readonly discoveredClueCount: number;
    readonly clueTarget: number;
    readonly isComplete: boolean;
}

export const getDiscoveryPageClueFeatureIds = (
    definition: DiscoveryPageDefinition,
): readonly DiscoveryPageFeatureId[] => definition.chain.featureIds.filter((featureId) => (
    featureId !== definition.chain.bigDiscoveryFeatureId
));

export const getDiscoveryPageProgress = (
    definition: DiscoveryPageDefinition,
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
): DiscoveryPageProgress => {
    const clueFeatureIds = getDiscoveryPageClueFeatureIds(definition);
    const discovered = new Set(discoveredFeatureIds);

    return {
        discoveredClueCount: clueFeatureIds.filter((featureId) => discovered.has(featureId)).length,
        clueTarget: clueFeatureIds.length,
        isComplete: discovered.has(definition.chain.bigDiscoveryFeatureId),
    };
};

export const getDiscoveryPageFeature = (
    definition: DiscoveryPageDefinition,
    featureId: DiscoveryPageFeatureId,
): DiscoveryPageFeature | undefined => definition.features.find((feature) => feature.id === featureId);

/**
 * Returns one deterministic clue: the first feature in the chain that has not
 * been found. A completed page has no next clue.
 */
export const getNextDiscoveryPageClue = (
    definition: DiscoveryPageDefinition,
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
): DiscoveryPageClue | undefined => {
    const discovered = new Set(discoveredFeatureIds);
    const targetFeatureId = definition.chain.featureIds.find((featureId) => !discovered.has(featureId));
    if (!targetFeatureId) return undefined;

    const target = getDiscoveryPageFeature(definition, targetFeatureId);
    if (!target) {
        throw new Error(`Discovery page ${definition.id} references unknown feature ${targetFeatureId}`);
    }

    return {
        pageId: definition.id,
        chainId: definition.chain.id,
        targetFeatureId,
        copy: target.clue,
    };
};

/**
 * Appends the next feature while preserving discovery order. Re-recording an
 * existing feature is intentionally idempotent, so a repeated UI/event signal
 * cannot create duplicate discoveries.
 */
export const recordDiscoveryPageFeature = (
    definition: DiscoveryPageDefinition,
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
    featureId: DiscoveryPageFeatureId,
): readonly DiscoveryPageFeatureId[] => {
    if (discoveredFeatureIds.includes(featureId)) return discoveredFeatureIds;

    if (!getDiscoveryPageFeature(definition, featureId)) {
        throw new Error(`Discovery page ${definition.id} does not contain feature ${featureId}`);
    }

    const nextClue = getNextDiscoveryPageClue(definition, discoveredFeatureIds);
    if (!nextClue || nextClue.targetFeatureId !== featureId) {
        throw new Error(`Feature ${featureId} is not the next discovery for page ${definition.id}`);
    }

    return [...discoveredFeatureIds, featureId];
};

export const isDiscoveryPageBigDiscovery = (
    definition: DiscoveryPageDefinition,
    featureId: DiscoveryPageFeatureId,
): boolean => definition.chain.bigDiscoveryFeatureId === featureId;

export const isDiscoveryPageBigDiscoveryReady = (
    definition: DiscoveryPageDefinition,
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
): boolean => {
    const nextClue = getNextDiscoveryPageClue(definition, discoveredFeatureIds);
    return nextClue?.targetFeatureId === definition.chain.bigDiscoveryFeatureId;
};

export const isDiscoveryPageComplete = (
    definition: DiscoveryPageDefinition,
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
): boolean => discoveredFeatureIds.includes(definition.chain.bigDiscoveryFeatureId);
