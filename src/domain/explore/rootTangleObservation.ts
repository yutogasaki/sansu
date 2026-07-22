import { FIREFLY_FLOWER_DISCOVERY_PAGE } from "./discoveryPageCatalog";
import type { ExploreObservationDefinition } from "./observation";

const ROOT_TANGLE_PREREQUISITES = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds.slice(0, -1);

export const ROOT_TANGLE_OBSERVATION = {
    id: "explore-observation:root-tangle-light-path",
    encounterId: "root-tangle",
    pageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
    featureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
    prerequisiteFeatureIds: ROOT_TANGLE_PREREQUISITES,
    camera: {
        key: "root-tangle-camera-v1",
        objectPosition: "50% 48%",
    },
    copy: {
        kicker: "せかいが かんさつページに なった",
        title: "根っこの むこうに、ひかり道！",
        action: "ひく数だけ 根をほどいた",
        reaction: "根っこが ひらいて、相棒が わたった",
        finding: "花たちの光が つながって、道になった",
    },
} as const satisfies ExploreObservationDefinition;
