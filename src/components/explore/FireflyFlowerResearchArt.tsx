import React from "react";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    type DiscoveryPageFeatureId,
} from "../../domain/explore";
import type { DiscoveryPageArtVariant } from "./DiscoveryPageArt";
import {
    FIREFLY_FLOWER_CAMERA_KEY,
    FIREFLY_FLOWER_FIELD_BOOK_CANDIDATE_ID,
    FIREFLY_FLOWER_Q7_CANDIDATE_ID,
    FIREFLY_FLOWER_SCENES,
    type FireflyFlowerSceneStage,
} from "./fireflyFlowerSceneCatalog";

export interface FireflyFlowerResearchArtProps {
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    variant?: DiscoveryPageArtVariant;
}

const getResearchStage = (
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
): FireflyFlowerSceneStage => {
    const [dewTrailFeatureId, warmBudFeatureId, petalsFeatureId, lightPathFeatureId] = (
        FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds
    );

    if (discoveredFeatureIds.includes(lightPathFeatureId)) return "light-path";
    if (discoveredFeatureIds.includes(petalsFeatureId)) return "ringing-petals";
    if (discoveredFeatureIds.includes(warmBudFeatureId)) return "warm-bud";
    if (discoveredFeatureIds.includes(dewTrailFeatureId)) return "dew-trail";
    return "waiting";
};

/**
 * The field-book view deliberately reuses the approved same-camera painted
 * plates from the live Firefly Flower trail. The previous flat SVG introduced
 * a second flower, a second companion construction, and an unrelated string-
 * light metaphor at Q7.
 */
export const FireflyFlowerResearchArt: React.FC<FireflyFlowerResearchArtProps> = ({
    discoveredFeatureIds,
    variant = "reveal",
}) => {
    const stage = getResearchStage(discoveredFeatureIds);
    const scene = FIREFLY_FLOWER_SCENES[stage];
    const knownFeatureIds = new Set<DiscoveryPageFeatureId>(
        FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
    );
    const discoveredCount = new Set(
        discoveredFeatureIds.filter((featureId) => knownFeatureIds.has(featureId)),
    ).size;
    const isComplete = discoveredFeatureIds.includes(
        FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
    );
    const isGenericFinale = variant === "reveal" && isComplete;

    return (
        <figure
            className="relative h-full w-full overflow-hidden bg-[#12aee0]"
            role="img"
            aria-label={`ほたる花の調査絵。${scene.description}`}
            data-visual-lineage-id="pokko-field-v1"
            data-visual-candidate-id={isGenericFinale
                ? FIREFLY_FLOWER_Q7_CANDIDATE_ID
                : FIREFLY_FLOWER_FIELD_BOOK_CANDIDATE_ID}
            data-visual-mode="field-book"
            data-camera-key={FIREFLY_FLOWER_CAMERA_KEY}
            data-painted-stage={stage}
            data-clue-count={Math.min(discoveredCount, 3)}
            data-light-path={stage === "light-path"
                ? "complete"
                : stage === "ringing-petals"
                    ? "setup"
                    : "hidden"}
            data-discovery-complete={isComplete ? "true" : "false"}
            data-character-id="pokko"
        >
            <img
                src={scene.src}
                alt=""
                className="block h-full w-full object-contain"
                decoding="async"
                draggable={false}
                fetchPriority={variant === "reveal" ? "high" : "auto"}
            />
        </figure>
    );
};
