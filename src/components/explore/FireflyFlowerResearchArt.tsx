import React from "react";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    type DiscoveryPageFeatureId,
} from "../../domain/explore";
import type { DiscoveryPageArtVariant } from "./DiscoveryPageArt";

export interface FireflyFlowerResearchArtProps {
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    variant?: DiscoveryPageArtVariant;
}

type FireflyResearchStage =
    | "waiting"
    | "dew-trail"
    | "warm-bud"
    | "ringing-petals"
    | "light-path";

const FIREFLY_RESEARCH_SCENES: Record<FireflyResearchStage, {
    src: string;
    description: string;
}> = {
    waiting: {
        src: "/assets/explore/firefly-flower/scene-waiting-dew-path-pokko-v3.jpg",
        description: "葉帽子のポッコが、閉じたほたる花まで続く一本の溝と四つのしずくを見ている。",
    },
    "dew-trail": {
        src: "/assets/explore/firefly-flower/scene-dew-trail-dew-path-pokko-v3.jpg",
        description: "ポッコが先頭のしずくを押し、四つのしずくが一本の溝をころがっている。",
    },
    "warm-bud": {
        src: "/assets/explore/firefly-flower/scene-warm-bud-dew-path-pokko-v3.jpg",
        description: "しずくが溝の半分まで進み、つぼみの先が少しひらいている。",
    },
    "ringing-petals": {
        src: "/assets/explore/firefly-flower/scene-ringing-petals-dew-path-pokko-v3.jpg",
        description: "四つのしずくが花まで届き、五枚の花びらと一本の水の道ができている。",
    },
    "light-path": {
        src: "/assets/explore/firefly-flower/scene-light-path-dew-path-pokko-v3.jpg",
        description: "三つのしずくが一本の道に並び、最後の一滴が葉帽子へ落ちて、ポッコが尻もちをついている。",
    },
};

const getResearchStage = (
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[],
): FireflyResearchStage => {
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
    const scene = FIREFLY_RESEARCH_SCENES[stage];
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
                ? "firefly-q7-dew-path-v3"
                : "firefly-field-book-painted-v3"}
            data-visual-mode="field-book"
            data-camera-key="firefly-flower-side-v3"
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
