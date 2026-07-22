import type { ExploreObservationDefinition } from "./observation";
import { ROOT_TANGLE_OBSERVATION } from "./rootTangleObservation";
import type { ExploreEncounterId, ExploreObservationId } from "./types";

export const EXPLORE_OBSERVATION_CATALOG: readonly ExploreObservationDefinition[] = [
    ROOT_TANGLE_OBSERVATION,
];

const OBSERVATIONS_BY_ID = new Map(
    EXPLORE_OBSERVATION_CATALOG.map((definition) => [definition.id, definition]),
);

const OBSERVATIONS_BY_ENCOUNTER = new Map(
    EXPLORE_OBSERVATION_CATALOG.map((definition) => [definition.encounterId, definition]),
);

export const getExploreObservationDefinition = (
    observationId: ExploreObservationId | undefined,
): ExploreObservationDefinition | undefined => (
    observationId ? OBSERVATIONS_BY_ID.get(observationId) : undefined
);

export const getExploreObservationForEncounter = (
    encounterId: ExploreEncounterId | undefined,
): ExploreObservationDefinition | undefined => (
    encounterId ? OBSERVATIONS_BY_ENCOUNTER.get(encounterId) : undefined
);
