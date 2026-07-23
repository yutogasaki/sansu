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
        candidateId: "root-tangle-carry-bloom-v4",
        mode: "observation",
        surfaceId: "explore-observation-root-tangle",
        cameraKey: "root-tangle-side-v4",
        sceneId: "root-tangle-dew-gag",
        sceneSrc: "/assets/explore/root-tangle/scene-crossed-carry-bloom-pokko-v7.jpg",
    },
    camera: {
        key: "root-tangle-side-v4",
        objectPosition: "50% 50%",
    },
    copy: {
        kicker: "ねっこが するん！",
        title: "しずくの道が ひらいた！",
        action: "ひき算で、ねっこの わっかが ほどけた",
        reaction: "四つのしずくが走って、一滴が 葉帽子へ ぽとん",
        finding: "ねっこが ほどけ、四つのしずくが 一本の道を走った",
    },
} as const satisfies ExploreObservationDefinition;
