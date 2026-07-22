import { describe, expect, it } from "vitest";
import {
    DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
    EXPLORE_OPENING_EXPERIENCES,
    EXPLORE_OPENING_EXPERIENCE_QUERY_PARAM,
    getExploreOpeningExperience,
    isExploreOpeningExperienceId,
    resolveExploreOpeningExperience,
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

    it("keeps presentation candidates out of run structure and persisted progress", () => {
        const rootPullV1 = EXPLORE_OPENING_EXPERIENCES["root-pull-v1"];
        const rootPullV2 = EXPLORE_OPENING_EXPERIENCES["root-pull-v2"];

        expect(rootPullV1.rootPullAssetSet).toBe("v1");
        expect(rootPullV2.rootPullAssetSet).toBe("v2");
        expect(rootPullV2.timing).toEqual(rootPullV1.timing);
        Object.values(EXPLORE_OPENING_EXPERIENCES).forEach((experience) => {
            expect(experience).not.toHaveProperty("answerCount");
            expect(experience).not.toHaveProperty("legacyProgress");
            expect(experience).not.toHaveProperty("completionRevealMode");
        });
    });
});
