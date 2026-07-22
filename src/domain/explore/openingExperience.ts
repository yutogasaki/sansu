import type { DiscoveryInstance } from "./types";
import { MAKIMODON_DISCOVERY_PAGE } from "./discoveryPageCatalog";

export const EXPLORE_OPENING_EXPERIENCE_IDS = [
    "classic-v1",
    "root-pull-v1",
    "root-pull-v2",
    "snap-root-v1",
] as const;

export type ExploreOpeningExperienceId = typeof EXPLORE_OPENING_EXPERIENCE_IDS[number];
export type ExploreOpeningPresentationKey = "classic" | "root-pull" | "snap-root";
export type ExploreRootPullAssetSet = "v1" | "v2";
export type ExploreOpeningCompletionRevealMode = "blocking" | "inline";

export const DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID: ExploreOpeningExperienceId = "classic-v1";
export const EXPLORE_OPENING_EXPERIENCE_QUERY_PARAM = "explore_experience";

export interface ExploreOpeningExperienceDefinition {
    readonly id: ExploreOpeningExperienceId;
    /** Selects authored UI only. It must not alter problems, assignments, receipts, or reducer events. */
    readonly presentationKey: ExploreOpeningPresentationKey;
    /** Selects validation art only; it must never be derived from a problem value. */
    readonly rootPullAssetSet?: ExploreRootPullAssetSet;
    /** Inline payoff avoids a second explanatory stop after the authored third beat. */
    readonly completionRevealMode: ExploreOpeningCompletionRevealMode;
    readonly answerCount: number;
    readonly timing: {
        readonly correctHoldMs: number;
        readonly payoffHoldMs: number;
        readonly revealDelayMs: number;
        readonly reducedMotionCorrectHoldMs: number;
        readonly reducedMotionRevealDelayMs: number;
    };
    /**
     * UI prototypes reuse the current progress events so changing presentation
     * never requires a schema migration. These legacy IDs are matching keys,
     * not child-facing names or copy.
     */
    readonly legacyProgress: {
        readonly pageId: typeof MAKIMODON_DISCOVERY_PAGE.id;
        readonly completionFeatureId: typeof MAKIMODON_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId;
    };
}

const SHARED_OPENING_TIMING = {
    correctHoldMs: 180,
    payoffHoldMs: 840,
    revealDelayMs: 120,
    reducedMotionCorrectHoldMs: 90,
    reducedMotionRevealDelayMs: 70,
} as const;

const SHARED_LEGACY_PROGRESS = {
    pageId: MAKIMODON_DISCOVERY_PAGE.id,
    completionFeatureId: MAKIMODON_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
} as const;

export const EXPLORE_OPENING_EXPERIENCES = {
    "classic-v1": {
        id: "classic-v1",
        presentationKey: "classic",
        completionRevealMode: "blocking",
        answerCount: MAKIMODON_DISCOVERY_PAGE.chain.featureIds.length,
        timing: SHARED_OPENING_TIMING,
        legacyProgress: SHARED_LEGACY_PROGRESS,
    },
    "root-pull-v1": {
        id: "root-pull-v1",
        presentationKey: "root-pull",
        rootPullAssetSet: "v1",
        completionRevealMode: "blocking",
        answerCount: MAKIMODON_DISCOVERY_PAGE.chain.featureIds.length,
        timing: SHARED_OPENING_TIMING,
        legacyProgress: SHARED_LEGACY_PROGRESS,
    },
    "root-pull-v2": {
        id: "root-pull-v2",
        presentationKey: "root-pull",
        rootPullAssetSet: "v2",
        completionRevealMode: "inline",
        answerCount: MAKIMODON_DISCOVERY_PAGE.chain.featureIds.length,
        timing: SHARED_OPENING_TIMING,
        legacyProgress: SHARED_LEGACY_PROGRESS,
    },
    "snap-root-v1": {
        id: "snap-root-v1",
        presentationKey: "snap-root",
        completionRevealMode: "inline",
        answerCount: MAKIMODON_DISCOVERY_PAGE.chain.featureIds.length,
        timing: SHARED_OPENING_TIMING,
        legacyProgress: SHARED_LEGACY_PROGRESS,
    },
} as const satisfies Readonly<Record<
    ExploreOpeningExperienceId,
    ExploreOpeningExperienceDefinition
>>;

export interface ResolveExploreOpeningExperienceInput {
    /** Value injected by Vite through VITE_EXPLORE_EXPERIENCE. */
    readonly envValue?: string;
    /** Usually window.location.search. Read only once when a UI run is created. */
    readonly urlSearch?: string;
    /** URL overrides are deliberately limited to local development and tests. */
    readonly allowUrlOverride?: boolean;
}

export const isExploreOpeningExperienceId = (
    value: unknown,
): value is ExploreOpeningExperienceId => (
    typeof value === "string"
    && EXPLORE_OPENING_EXPERIENCE_IDS.includes(value as ExploreOpeningExperienceId)
);

const normalizeExperienceId = (value: string | null | undefined) => {
    const normalized = value?.trim();
    return isExploreOpeningExperienceId(normalized) ? normalized : undefined;
};

export const getExploreOpeningExperience = (
    id: ExploreOpeningExperienceId,
): ExploreOpeningExperienceDefinition => EXPLORE_OPENING_EXPERIENCES[id];

/**
 * Resolves an authored presentation without touching persisted run state.
 * Callers capture the returned definition once per mounted UI session so a
 * query-string or environment change cannot swap the presentation mid-run.
 */
export const resolveExploreOpeningExperience = ({
    envValue,
    urlSearch = "",
    allowUrlOverride = false,
}: ResolveExploreOpeningExperienceInput = {}): ExploreOpeningExperienceDefinition => {
    if (allowUrlOverride) {
        const requestedId = normalizeExperienceId(
            new URLSearchParams(urlSearch).get(EXPLORE_OPENING_EXPERIENCE_QUERY_PARAM),
        );
        if (requestedId) return getExploreOpeningExperience(requestedId);
    }

    const envId = normalizeExperienceId(envValue);
    return getExploreOpeningExperience(envId ?? DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID);
};

export const isExploreOpeningStep = (
    experience: ExploreOpeningExperienceDefinition,
    completedSteps: number,
): boolean => completedSteps >= 0 && completedSteps < experience.answerCount;

export const willCompleteExploreOpeningStep = (
    experience: ExploreOpeningExperienceDefinition,
    completedSteps: number,
): boolean => isExploreOpeningStep(experience, completedSteps)
    && completedSteps + 1 === experience.answerCount;

export const isExploreOpeningCompletionDiscovery = (
    experience: ExploreOpeningExperienceDefinition,
    discovery: Pick<DiscoveryInstance, "discoveryPageId" | "discoveryFeatureId">,
): boolean => (
    discovery.discoveryPageId === experience.legacyProgress.pageId
    && discovery.discoveryFeatureId === experience.legacyProgress.completionFeatureId
);
