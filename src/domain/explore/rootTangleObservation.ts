import { FIREFLY_FLOWER_DISCOVERY_PAGE } from "./discoveryPageCatalog";
import type { ExploreObservationDefinition } from "./observation";

const ROOT_TANGLE_PREREQUISITES = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds.slice(0, -1);

export const ROOT_TANGLE_OBSERVATION = {
    id: "explore-observation:root-tangle-light-path",
    encounterId: "root-tangle",
    pageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
    featureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
    prerequisiteFeatureIds: ROOT_TANGLE_PREREQUISITES,
    visual: {
        lineageId: "pokko-field-v1",
        candidateId: "root-tangle-light-path-v2",
        mode: "observation",
        surfaceId: "explore-observation-root-tangle",
        cameraKey: "root-tangle-camera-v1",
        sceneId: "root-tangle-crossed",
        sceneSrc: "/assets/explore/root-tangle/scene-crossed-light-path-pokko-v5.jpg",
    },
    camera: {
        key: "root-tangle-camera-v1",
        // The compact observation frame is wider than the encounter's tall
        // story window. 57.5% keeps the same source-space action, Pokko, and
        // ground edge in view instead of merely copying the encounter's CSS
        // percentage into a differently shaped box.
        objectPosition: "50% 57.5%",
    },
    copy: {
        kicker: "ねっこが ほどけた！",
        title: "花の ひかり道だ！",
        action: "ひき算で、ねっこの むすびが ほどけた",
        reaction: "ねっこの むこうで、花の光が 道になった",
        finding: "花たちの光が つながって、道になった",
    },
} as const satisfies ExploreObservationDefinition;
