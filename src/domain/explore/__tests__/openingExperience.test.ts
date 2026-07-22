import { describe, expect, it } from "vitest";
import {
    DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
    EXPLORE_OPENING_EXPERIENCES,
    EXPLORE_OPENING_EXPERIENCE_QUERY_PARAM,
    getExploreOpeningExperience,
    isExploreOpeningCompletionDiscovery,
    isExploreOpeningExperienceId,
    isExploreOpeningStep,
    resolveExploreOpeningExperience,
    willCompleteExploreOpeningStep,
} from "../openingExperience";

describe("explore opening experience", () => {
    it("keeps classic as the production fallback while Snap Root remains a local candidate", () => {
        expect(resolveExploreOpeningExperience().id).toBe(
            DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
        );
        expect(resolveExploreOpeningExperience({ envValue: "unknown" }).id).toBe("classic-v1");
        expect(DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID).toBe("classic-v1");
        expect(getExploreOpeningExperience("classic-v1").presentationKey).toBe("classic");
    });

    it("accepts a configured experience and trims environment input", () => {
        expect(resolveExploreOpeningExperience({
            envValue: " root-pull-v1 ",
        }).id).toBe("root-pull-v1");
        expect(isExploreOpeningExperienceId("classic-v1")).toBe(true);
        expect(isExploreOpeningExperienceId("root-pull-v1")).toBe(true);
        expect(isExploreOpeningExperienceId("root-pull-v2")).toBe(true);
        expect(isExploreOpeningExperienceId("snap-root-v1")).toBe(true);
    });

    it("lets an allowed dev or test URL override the environment", () => {
        const urlSearch = `?${EXPLORE_OPENING_EXPERIENCE_QUERY_PARAM}=root-pull-v1`;

        expect(resolveExploreOpeningExperience({
            envValue: "classic-v1",
            urlSearch,
            allowUrlOverride: true,
        }).id).toBe("root-pull-v1");
        expect(resolveExploreOpeningExperience({
            envValue: "classic-v1",
            urlSearch,
            allowUrlOverride: false,
        }).id).toBe("classic-v1");
    });

    it("ignores an invalid URL override and falls back to valid environment config", () => {
        expect(resolveExploreOpeningExperience({
            envValue: "root-pull-v1",
            urlSearch: `?${EXPLORE_OPENING_EXPERIENCE_QUERY_PARAM}=typo-v1`,
            allowUrlOverride: true,
        }).id).toBe("root-pull-v1");
    });

    it("uses presentation-neutral three-answer progress helpers", () => {
        const experience = getExploreOpeningExperience("root-pull-v1");

        expect(isExploreOpeningStep(experience, 0)).toBe(true);
        expect(isExploreOpeningStep(experience, 2)).toBe(true);
        expect(isExploreOpeningStep(experience, 3)).toBe(false);
        expect(willCompleteExploreOpeningStep(experience, 1)).toBe(false);
        expect(willCompleteExploreOpeningStep(experience, 2)).toBe(true);
    });

    it("shares legacy progress matching without changing persisted IDs", () => {
        const classic = EXPLORE_OPENING_EXPERIENCES["classic-v1"];
        const rootPull = EXPLORE_OPENING_EXPERIENCES["root-pull-v1"];
        const rootPullV2 = EXPLORE_OPENING_EXPERIENCES["root-pull-v2"];
        const snapRoot = EXPLORE_OPENING_EXPERIENCES["snap-root-v1"];

        expect(rootPull.legacyProgress).toEqual(classic.legacyProgress);
        expect(rootPullV2.legacyProgress).toEqual(classic.legacyProgress);
        expect(snapRoot.legacyProgress).toEqual(classic.legacyProgress);
        expect(isExploreOpeningCompletionDiscovery(rootPull, {
            discoveryPageId: rootPull.legacyProgress.pageId,
            discoveryFeatureId: rootPull.legacyProgress.completionFeatureId,
        })).toBe(true);
        expect(isExploreOpeningCompletionDiscovery(rootPull, {
            discoveryPageId: rootPull.legacyProgress.pageId,
            discoveryFeatureId: undefined,
        })).toBe(false);
    });

    it("keeps v1 blocking while v2 owns only validation art and inline payoff", () => {
        const rootPullV1 = EXPLORE_OPENING_EXPERIENCES["root-pull-v1"];
        const rootPullV2 = EXPLORE_OPENING_EXPERIENCES["root-pull-v2"];

        expect(rootPullV1.rootPullAssetSet).toBe("v1");
        expect(rootPullV1.completionRevealMode).toBe("blocking");
        expect(rootPullV2.rootPullAssetSet).toBe("v2");
        expect(rootPullV2.completionRevealMode).toBe("inline");
        expect(rootPullV2.answerCount).toBe(rootPullV1.answerCount);
        expect(rootPullV2.timing).toEqual(rootPullV1.timing);
        expect(EXPLORE_OPENING_EXPERIENCES["snap-root-v1"].completionRevealMode).toBe("inline");
    });
});
